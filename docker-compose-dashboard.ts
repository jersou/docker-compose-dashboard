#!/usr/bin/env -S deno run  --allow-net=localhost:5555 --allow-env --allow-read --allow-write=assets_bundle.json --allow-run=/usr/bin/docker

import $ from "https://deno.land/x/dax@0.39.2/mod.ts";
import { TextLineStream } from "https://deno.land/std@0.219.0/streams/text_line_stream.ts";
import {
  decodeBase64,
  encodeBase64,
} from "https://deno.land/std@0.220.0/encoding/base64.ts";
import { cliteRun } from "https://deno.land/x/clite_parser@0.2.1/clite_parser.ts";
import assetsFromJson from "./assets_bundle.json" with { type: "json" };
import { walk } from "https://deno.land/std@0.219.0/fs/walk.ts";
import { assert } from "https://deno.land/std@0.219.0/assert/assert.ts";
import { extname } from "https://deno.land/std@0.219.0/path/extname.ts";

const wsRoute = new URLPattern({ pathname: "/api/events-ws" });

const getStatus = async () =>
  (await $`docker compose ps --all --format json`.text())
    .split("\n")
    .map((s) => JSON.parse(s))
    .map((s: any) => ({
      Service: s.Service,
      CreatedAt: s.CreatedAt,
      ExitCode: s.ExitCode,
      Health: s.Health,
      RunningFor: s.RunningFor,
      State: s.State,
      Status: s.Status,
    }))
    .reduce((obj, serv) => {
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

type Assets = {
  [k: string]: { type: string; content: Uint8Array; route: URLPattern };
};

class DockerComposeDashboard {
  hostname = "localhost";
  port = 5555;
  notExitIfNoClient: boolean | string = false;
  openInBrowser: boolean | string = false;
  update: boolean | string = false;
  _update_desc = "update assets_bundle.json";
  #sockets = new Set<WebSocket>();
  #assets: Assets = {};

  async main() {
    console.log(`Docker Compose Dashboard running from ${Deno.cwd()}`);
    await this.#loadAssets();

    $.setPrintCommand(true);
    // check config from current dir
    await $`docker compose config --quiet`;

    this.#watchDockerComposeEvents().then();
    const onListen = async () => {
      if (this.openInBrowser === true || this.openInBrowser === "true") {
        if (await $.commandExists("chromium")) {
          await $`chromium --app=http://localhost:5555/`;
        } else if (await $.commandExists("google-chrome")) {
          await $`google-chrome --app=http://localhost:5555/`;
        } else {
          await $`gio open http://localhost:5555/`;
        }
      }
    };
    Deno.serve(
      { hostname: this.hostname, port: this.port, onListen },
      (r) => this.#handleRequest(r),
    );
  }

  async #handleRequest(request: Request) {
    console.log(`handle ${request.url}`);
    for (const { route, exec } of routes) {
      const match = route.exec(request.url);
      if (match) {
        const resp = await exec(match);
        resp.headers.set("Access-Control-Allow-Origin", "*");
        return resp;
      }
    }
    for (const file of Object.values(this.#assets!)) {
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
        this.#sockets.add(socket);
        console.log(`a client connected! ${this.#sockets.size} clients`);
      });
      socket.addEventListener("close", () => {
        this.#sockets.delete(socket);
        console.log(`a client disconnected! ${this.#sockets.size} clients`);
        if (
          (this.notExitIfNoClient === false ||
            this.notExitIfNoClient === "false") && this.#sockets.size === 0
        ) {
          console.log(`→ ExitIfNoClient → exit !`);
          Deno.exit(0);
        }
      });
      return response;
    }
    return new Response("", { status: 404 });
  }

  async #watchDockerComposeEvents() {
    const eventProcess = $`docker compose events --json `.stdout("piped")
      .spawn();
    const lines = eventProcess.stdout()
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());
    for await (const line of lines) {
      const event = JSON.parse(line);
      if (event.action && !event.action.startsWith("exec_")) {
        console.log(`>>>> docker compose event : ${event.action}`);
        // TODO debounce
        const config = await getConfigWithStatus();
        const configJson = JSON.stringify(config);
        for (const socket of this.#sockets) {
          socket.send(configJson);
        }
      }
    }
  }
  async updateAssets() {
    console.log("update assets_bundle.json");
    const { mimeTypes } = await import("./mime-types.ts");
    const frontendPath = $.path(import.meta).resolve(`../frontend/`).toString();
    for await (const entry of walk(frontendPath, { includeDirs: false })) {
      assert(entry.path.startsWith(frontendPath));
      const path = entry.path.substring(frontendPath.length);
      const ext = extname(path)?.substring(1);
      const type = mimeTypes[ext];
      const content = await Deno.readFile(entry.path);
      const route = new URLPattern({ pathname: path });
      this.#assets[path] = { type, route, content };
      console.log({ path, type });
    }
    const paths = Object.keys(this.#assets).sort();
    const assets: Assets = {};

    paths.forEach((path) => {
      assets[path] = this.#assets[path];
    });

    await Deno.writeTextFile(
      $.path(import.meta).resolve("../assets_bundle.json").toString(),
      JSON.stringify(assets, (key, value) => {
        if (key === "content") {
          return encodeBase64(value as Uint8Array);
        } else if (key === "route") {
          return (value as URLPattern).pathname;
        } else {
          return value;
        }
      }, "  "),
    );
  }

  async #loadAssets() {
    if (this.update === true || this.update === "true") {
      await this.updateAssets();
    } else {
      for (const [key, asset] of Object.entries(assetsFromJson)) {
        this.#assets[key] = {
          type: asset?.type,
          route: new URLPattern({ pathname: asset.route }),
          content: decodeBase64(asset.content),
        };
      }
    }
    if (this.#assets["/index.html"]) {
      const route = new URLPattern({ pathname: "/" });
      this.#assets["/"] = { ...this.#assets["/index.html"], route };
    }
  }
}

if (import.meta.main) {
  cliteRun(new DockerComposeDashboard());
}
