#!/usr/bin/env -S deno run -A

import $ from "https://deno.land/x/dax@0.39.2/mod.ts";

$.setPrintCommand(true);
const subStatus = (s: any) => ({
  CreatedAt: s.CreatedAt,
  ExitCode: s.ExitCode,
  Health: s.Health,
  RunningFor: s.RunningFor,
  State: s.State,
  Status: s.Status,
});

const routes = [
  {
    route: new URLPattern({ pathname: "/api/list" }),
    async exec() {
      const services = (await $`docker compose config --services`.text())
        .split("\n");
      const body = JSON.stringify(services);
      return new Response(body, { status: 200 });
    },
  },
  {
    route: new URLPattern({ pathname: "/api/status/:id" }),
    async exec(match: URLPatternResult) {
      const service = match.pathname.groups.id;
      const out = await $`docker compose ps --all --format json ${service}`
        .json();
      const body = JSON.stringify(subStatus(out));
      return new Response(body, { status: 200 });
    },
  },
  {
    route: new URLPattern({ pathname: "/api/status" }),
    async exec(match: URLPatternResult) {
      const statuses = (await $`docker compose ps --all --format json`.text())
        .split("\n")
        .map((s) => JSON.parse(s))
        .map(subStatus);
      const body = JSON.stringify(statuses);
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
  {
    route: new URLPattern({ pathname: "/" }),
    async exec() {
      const body = // TODO
        `<html><body><div style="background-color: red">TODO</div></body></html>`;
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    },
  },
] as const;

const handler = async (request: Request) => {
  console.log(`handle ${request.url}`);
  for (const { route, exec } of routes) {
    const match = route.exec(request.url);
    if (match) {
      return await exec(match);
    }
  }
  return new Response("", { status: 404 });
};

const port = Deno.args.length ? parseInt(Deno.args[0]) : 8080;
console.log(`HTTP server running. Access it at: http://localhost:${port}/`);
Deno.serve({ hostname: "127.0.0.1", port }, handler);

// TODO :
//  - deno perm
//  - use labels in index.html
//  - docker compose config  --format json
