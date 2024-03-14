#!/usr/bin/env -S deno run  --allow-net=localhost:5555 --allow-env --allow-read --allow-run=/usr/bin/docker

import $ from "https://deno.land/x/dax@0.39.2/mod.ts";
import { TextLineStream } from "https://deno.land/std@0.219.0/streams/text_line_stream.ts";
import { cliteRun } from "https://deno.land/x/clite_parser@0.2.1/clite_parser.ts";
$.setPrintCommand(true);
// check config from current dir
await $`docker compose config --quiet`;

const subStatus = (s: any) => ({
  Service: s.Service,
  CreatedAt: s.CreatedAt,
  ExitCode: s.ExitCode,
  Health: s.Health,
  RunningFor: s.RunningFor,
  State: s.State,
  Status: s.Status,
});

const wsRoute = new URLPattern({ pathname: "/api/events-ws" });
const frontendFiles = {
  "index.html": { type: "text/html", route: new URLPattern({ pathname: "/" }) },
  "main.js": { type: "text/javascript" },
  "favicon.png": { type: "image/png" },
  "style.css": { type: "text/css" },
  "htm@3.1.1-preact-standalone.module.js": { type: "text/javascript" },
  "material-symbols-outlined.woff2": { type: "application/font-woff2" },
} as {
  [k: string]: { type: string; content?: Uint8Array; route?: URLPattern };
};

const resolve = (path: string) =>
  $.path(import.meta).resolve(`../frontend/${path}`).toString();

for (const fileName in frontendFiles) {
  frontendFiles[fileName].content = await Deno.readFile(resolve(fileName));
  if (!frontendFiles[fileName].route) {
    frontendFiles[fileName].route = new URLPattern({
      pathname: `/${fileName}`,
    });
  }
}

const getStatus = async () =>
  (await $`docker compose ps --all --format json`.text())
    .split("\n")
    .map((s) => JSON.parse(s))
    .map(subStatus).reduce((obj, serv) => {
      obj[serv.Service as string] = serv;
      return obj;
    }, {} as { [key: string]: any });

const labelSplitRegex = /^([^=]*)=(.*)/;
const getConfig = async () => {
  const config = await $`docker compose config --format json`.json();
  return Object.entries(config.services)
    .map(([k, v]) => {
      const labels = (v as any).labels;
      if (Array.isArray(labels)) {
        (v as any).labels = labels
          .map((e: string) => labelSplitRegex.exec(e)?.splice(1) ?? [])
          .reduce((obj, [k, v]) => {
            obj[k] = v;
            return obj;
          }, {} as { [key: string]: string });
      }
      return [k, v] as [string, unknown];
    })
    .filter(([_, v]) => !(v as any).labels?.["dashboard.hide"])
    .reduce((obj, [k, v]) => {
      obj[k] = { labels: (v as any).labels, name: k };
      return obj;
    }, {} as { [key: string]: any });
};

const getConfigWithStatus = async () => {
  const config = await getConfig();
  const statuses = await getStatus();
  for (const serv in config) {
    config[serv].status = statuses[serv] ?? { Status: "unknown" };
  }
  return config;
};

const routes = [
  {
    route: new URLPattern({ pathname: "/api/status" }),
    async exec(_match: URLPatternResult) {
      const body = JSON.stringify(await getConfigWithStatus());
      return new Response(body, { status: 200 });
    },
  },
  {
    route: new URLPattern({ pathname: "/api/up/:id" }),
    async exec(match: URLPatternResult) {
      const service = match.pathname.groups.id;
      const body = await $`docker compose up -d ${service}`.text();
      return new Response(body, { status: 200 });
    },
  },
  {
    route: new URLPattern({ pathname: "/api/kill/:id" }),
    async exec(match: URLPatternResult) {
      const service = match.pathname.groups.id;
      const body = await $`docker compose kill ${service}`.text();
      return new Response(body, { status: 200 });
    },
  },
] as const;

const sockets = new Set<WebSocket>();

class DockerComposeDashboard {
  hostname = "localhost";
  port = 5555;
  update = false;
  _update_desc = "update assets_bundle.json";

  async handleRequest(request: Request) {
    console.log(`handle ${request.url}`);
    for (const { route, exec } of routes) {
      const match = route.exec(request.url);
      if (match) {
        const resp = await exec(match);
        resp.headers.set("Access-Control-Allow-Origin", "*");
        return resp;
      }
    }
    for (const file of Object.values(frontendFiles)) {
      if (file.route?.exec(request.url)) {
        const headers = { "Content-Type": file.type };
        return new Response(file.content, { status: 200, headers });
      }
    }
    if (wsRoute.exec(request.url)) {
      if (request.headers.get("upgrade") != "websocket") {
        return new Response(null, { status: 501 });
      }
      const { socket, response } = Deno.upgradeWebSocket(request);
      socket.addEventListener("open", () => {
        sockets.add(socket);
        console.log(`a client connected! ${sockets.size} clients`);
      });
      socket.addEventListener("close", () => {
        sockets.delete(socket);
        console.log(`a client disconnected! ${sockets.size} clients`);
      });
      return response;
    }
    return new Response("", { status: 404 });
  }

  async watchDockerComposeEvents() {
    const eventProcess = $`docker compose events --json `.stdout("piped")
      .spawn();
    const lines = eventProcess.stdout()
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());
    for await (const line of lines) {
      const event = JSON.parse(line);
      if (event.action && !event.action.startsWith("exec_")) {
        console.log(`>>>> event >>>> ${event.action}`);
        // TODO debounce
        const config = await getConfigWithStatus();
        const configJson = JSON.stringify(config);
        for (const socket of sockets) {
          socket.send(configJson);
        }
      }
    }
  }

  async main() {
    console.log(`Docker Compose Dashboard running from ${Deno.cwd()}`);

    this.watchDockerComposeEvents().then();

    Deno.serve(
      { hostname: this.hostname, port: this.port },
      (r) => this.handleRequest(r),
    );
  }
}

// if the file is imported, do not execute this block
if (import.meta.main) {
  cliteRun(new DockerComposeDashboard());
}
