#!/usr/bin/env -S deno run  --allow-net=localhost:5555 --allow-env --allow-read --allow-write=assets_bundle.json --allow-run

import $ from "jsr:@david/dax@0.42.0";
import { TextLineStream } from "jsr:@std/streams@1.0.5";
import { cliteRun, help, hidden } from "jsr:@jersou/clite@0.7.6";
import { DesktopWebApp } from "jsr:@jersou/desktop-web-app@0.0.2";
import assetsFromJson from "./assets_bundle.json" with { type: "json" };

const getStatus = async () =>
  ((await $`docker compose ps --all --format json`.text()) || "{}")
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
  const config = await $`docker compose config --format json --no-interpolate`
    .json();
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

class DockerComposeDashboard extends DesktopWebApp {
  @help("Keep the server alive after the last client disconnects")
  notExitIfNoClient = false;

  @hidden()
  sockets = new Set<WebSocket>();

  override routes = [
    {
      route: new URLPattern({ pathname: "/api/status" }),
      exec: async (_match: URLPatternResult, _request: Request) => {
        const body = JSON.stringify(await getConfigWithStatus());
        return new Response(body, { status: 200 });
      },
    },
    {
      route: new URLPattern({ pathname: "/api/up/:id" }),
      exec: async (match: URLPatternResult, _request: Request) => {
        const service = match.pathname.groups.id!;
        const body = await $`docker compose up -d ${service}`.text();
        return new Response(body, { status: 200 });
      },
    },
    {
      route: new URLPattern({ pathname: "/api/kill/:id" }),
      exec: async (match: URLPatternResult, _request: Request) => {
        const service = match.pathname.groups.id!;
        const body = await $`docker compose kill ${service}`.text();
        return new Response(body, { status: 200 });
      },
    },
    { // WebSocket
      route: new URLPattern({ pathname: "/api/events-ws" }),
      exec: (_match: URLPatternResult, request: Request) => {
        if (request.headers.get("upgrade") != "websocket") {
          return new Response(null, { status: 501 });
        }
        const { socket, response } = Deno.upgradeWebSocket(request);
        socket.addEventListener("open", () => {
          this.sockets.add(socket);
          console.log(`a client connected! ${this.sockets.size} clients`);
        });
        socket.addEventListener("close", () => {
          this.sockets.delete(socket);
          console.log(`a client disconnected! ${this.sockets.size} clients`);
          if (!this.notExitIfNoClient && this.sockets.size === 0) {
            console.log(`→ ExitIfNoClient → shutdown the server !`);
            Deno.exit(0);
          }
        });
        return response;
      },
    },
  ];

  constructor() {
    $.setPrintCommand(true);
    console.log(`Docker Compose Dashboard running from ${Deno.cwd()}`);
    super({ assetsFromJson });
    this.openInBrowser = "google-chrome";
  }

  override onListen = async () => {
    await this.checkCompose();
    this.#watchDockerComposeEvents().then();
  };

  // check config from current dir
  async checkCompose() {
    const res = await $`docker compose config --quiet`.noThrow();
    if (res.code !== 0) {
      console.error("ERROR: it's not a Docker Compose folder");
      Deno.exit(12);
    } else {
      return true;
    }
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
        for (const socket of this.sockets) {
          socket.send(configJson);
        }
      }
    }
  }
}

if (import.meta.main) {
  cliteRun(DockerComposeDashboard, { meta: import.meta });
}
