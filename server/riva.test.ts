import { appRouter } from "./routers";
import { describe, expect, it, vi } from "vitest";

const RIVA_URL = (process.env.RIVA_URL || "https://integrate.api.nvidia.com").replace(/\/+$/, "");

describe("NVIDIA NIM credentials", () => {
  it("authenticates with the configured API key", async () => {
    const apiKey = process.env.RIVA_API_KEY;
    expect(apiKey, "RIVA_API_KEY must be configured before running this test").toBeTruthy();

    const response = await fetch(`${RIVA_URL}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.ok, `NVIDIA NIM returned HTTP ${response.status}`).toBe(true);
    const payload = (await response.json()) as { data?: unknown[] };
    expect(Array.isArray(payload.data)).toBe(true);
  }, 20_000);

  it("translates through the tRPC procedure with the Riva model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "feat: adicionar botão de login" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const caller = appRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: null,
    });
    const result = await caller.translation.translate({
      text: "feat: add login button",
      sourceLanguage: "inglês",
      targetLanguage: "português do Brasil",
    });

    expect(result).toEqual({
      translatedText: "feat: adicionar botão de login",
      model: "nvidia/riva-translate-4b-instruct-v2",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${RIVA_URL}/v1/chat/completions`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"content":"en-pt-br"'),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("normalizes pasted line breaks and splits long commits into Riva-sized requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "feat: adiciona uma melhoria extensa" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "continua a descrição da melhoria" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null });
    const longText = `feat: add a very large feature\n\n${"This is a long technical detail. ".repeat(90)}`;
    await caller.translation.translate({
      text: longText,
      sourceLanguage: "inglês",
      targetLanguage: "português do Brasil",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const request = JSON.parse(String(call[1]?.body)) as { messages: Array<{ role: string; content: string }> };
      expect(request.messages[1]?.content).not.toMatch(/\r|\n/);
      expect(request.messages[1]?.content.length).toBeLessThanOrEqual(1925);
    }
    vi.unstubAllGlobals();
  });
});
