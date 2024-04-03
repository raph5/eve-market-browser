import type { ServerBuild } from "@remix-run/server-runtime";
import { createRequestHandler, logDevReady } from "@remix-run/server-runtime";
import { resolve } from "node:path";
import * as build from "./build/server/index";
import Bun from "bun";

if (Bun.env.NODE_ENV === "development") {
  logDevReady(build as unknown as ServerBuild);
}

const remix = createRequestHandler(
  build as unknown as ServerBuild,
  Bun.env.NODE_ENV
);

const server = Bun.serve({
  port: Bun.env.PORT || 3000,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    let file = Bun.file(resolve(__dirname, "./build/client" + pathname));
    if (await file.exists()) return new Response(file);

    return remix(request);
  },
})

console.log(`Bun listening on ${server.url}`);