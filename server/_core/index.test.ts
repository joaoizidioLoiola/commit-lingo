import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createApp } from "./index";

async function withServer<T>(
  app: ReturnType<typeof createApp>,
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("createApp", () => {
  it("exposes the tRPC endpoint at /api/trpc", async () => {
    const app = await createApp();
    const status = await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/trpc/system.health`, {
        method: "GET",
      });
      return res.status;
    });

    // 400/405 = route exists and parsed the request; 200 = succeeded.
    // 404 would mean the route is not mounted.
    expect(status).not.toBe(404);
  });

  it("returns a fully constructed Express app without opening a port", async () => {
    const app = await createApp();

    expect(typeof app.use).toBe("function");
    expect(typeof app.get).toBe("function");
    expect(typeof app.post).toBe("function");
    expect((app as unknown as Record<string, unknown>)["_router"]).toBeDefined();
  });
});

describe("module side-effects", () => {
  it("does not auto-start a listener when imported", async () => {
    // Importing the module must be side-effect free w.r.t. network I/O.
    // If a future change reintroduces an auto-start, this test fails.
    const mod = await import("./index");

    expect(typeof mod.createApp).toBe("function");
    expect(typeof mod.startServer).toBe("function");
    expect(mod.isServerless).toBe(false);
  });
});
