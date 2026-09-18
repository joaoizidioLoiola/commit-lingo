import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/_core/index";

let appPromise: Promise<Awaited<ReturnType<typeof createApp>>> | null = null;

function getApp() {
  if (!appPromise) {
    appPromise = createApp();
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  return app(req, res);
}
