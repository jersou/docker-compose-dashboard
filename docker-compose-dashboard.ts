#!/usr/bin/env -S deno run  --allow-net=localhost:5555 --allow-env --allow-read --allow-run=/usr/bin/docker

import $ from "https://deno.land/x/dax@0.39.2/mod.ts";

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

const baseRoute = new URLPattern({ pathname: "/" });
const frontendFiles = {
  "index.html": { type: "text/html" },
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
  frontendFiles[fileName].route = new URLPattern({ pathname: `/${fileName}` });
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

const routes = [
  {
    route: new URLPattern({ pathname: "/api/status" }),
    async exec(_match: URLPatternResult) {
      const config = await getConfig();
      const statuses = await getStatus();
      for (const serv in config) {
        config[serv].status = statuses[serv] ?? { Status: "unknown" };
      }
      const body = JSON.stringify(config);
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

const handler = async (request: Request) => {
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
  if (baseRoute?.exec(request.url)) {
    const file = frontendFiles["index.html"];
    const headers = { "Content-Type": file.type };
    return new Response(file.content, { status: 200, headers });
  }
  return new Response("", { status: 404 });
};
const hostname = Deno.args.length === 2 ? Deno.args[0] : "localhost";
const port = Deno.args.length === 2 ? parseInt(Deno.args[1]) : 5555;

console.log(`Docker Compose Dashboard running from ${Deno.cwd()}`);
Deno.serve({ hostname, port }, handler);
