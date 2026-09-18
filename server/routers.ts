import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const RIVA_MODEL = "nvidia/riva-translate-4b-instruct-v2";
const DEFAULT_RIVA_URL = "https://integrate.api.nvidia.com";
const MAX_RIVA_CHARS = 1925;

function getRivaUrl() {
  return (process.env.RIVA_URL || DEFAULT_RIVA_URL).replace(/\/+$/, "");
}

function languageCode(language: string) {
  const normalized = language.toLowerCase().trim();
  if (normalized.includes("inglês") || normalized.includes("english")) return "en";
  if (normalized.includes("português") || normalized.includes("portuguese")) return "pt-br";
  if (normalized.includes("espanhol") || normalized.includes("spanish")) return "es-us";
  if (normalized.includes("francês") || normalized.includes("french")) return "fr";
  if (normalized.includes("alemão") || normalized.includes("german")) return "de";
  return normalized.split(/\s+/)[0] || "en";
}

function getTranslatedContent(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } })?.message;
  return typeof message?.content === "string" ? message.content.trim() : null;
}

function normalizeText(text: string) {
  return text.replace(/\r?\n|\r/g, " ").replace(/[ \t]+/g, " ").trim();
}

function splitForRiva(text: string) {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_RIVA_CHARS) {
    const window = remaining.slice(0, MAX_RIVA_CHARS + 1);
    let cut = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf("; "),
    );
    if (cut < Math.floor(MAX_RIVA_CHARS * 0.55)) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = MAX_RIVA_CHARS;
    else cut += 1;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function formatTranslatedCommit(text: string) {
  const flattened = normalizeText(text);
  const headerMatch = flattened.match(/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([^)]*\))?(!)?:\s*(.*)$/i);
  if (!headerMatch) return text.trim();

  const [, type, scope, breaking, rest] = headerMatch;
  const bulletPattern = /\s+(?=[-•]\s+)/g;
  const parts = rest.split(bulletPattern).map((part) => part.trim()).filter(Boolean);
  const header = `${type}${scope ?? ""}${breaking ?? ""}: ${parts.shift() ?? ""}`;
  if (parts.length === 0) return header;
  return `${header}\n\n${parts.map((part) => (part.startsWith("-") || part.startsWith("•") ? part.replace(/^•/, "-") : `- ${part}`)).join("\n")}`;
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  translation: router({
    translate: publicProcedure
      .input(
        z.object({
          text: z.string().trim().min(1, "Digite uma mensagem para traduzir.").max(20000),
          sourceLanguage: z.string().trim().min(1).max(40),
          targetLanguage: z.string().trim().min(1).max(40),
        }),
      )
      .mutation(async ({ input }) => {
        const apiKey = process.env.RIVA_API_KEY;
        if (!apiKey) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A chave do NVIDIA NIM ainda não foi configurada." });
        }

        const normalizedText = normalizeText(input.text);
        const languagePair = `${languageCode(input.sourceLanguage)}-${languageCode(input.targetLanguage)}`;
        const chunks = splitForRiva(normalizedText);
        const translatedChunks: string[] = [];

        for (const chunk of chunks) {
          let response: Response;
          try {
            response = await fetch(`${getRivaUrl()}/v1/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: RIVA_MODEL,
                messages: [
                  { role: "system", content: languagePair },
                  { role: "user", content: chunk },
                ],
                temperature: 0,
                top_p: 0.9,
                max_tokens: 4096,
                stream: false,
              }),
            });
          } catch (error) {
            console.error("[NVIDIA NIM] Network error:", error);
            throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Não foi possível conectar ao NVIDIA NIM." });
          }

          const data = await response.json().catch(() => null);
          if (!response.ok) {
            console.error("[NVIDIA NIM] Request failed:", response.status, data);
            throw new TRPCError({ code: "BAD_GATEWAY", message: "O NVIDIA NIM recusou a tradução. Verifique a API key e a configuração do endpoint." });
          }

          const translatedChunk = getTranslatedContent(data);
          if (!translatedChunk) {
            console.error("[NVIDIA NIM] Unexpected response shape:", data);
            throw new TRPCError({ code: "BAD_GATEWAY", message: "O NVIDIA NIM retornou uma resposta sem tradução." });
          }
          translatedChunks.push(translatedChunk);
        }

        return { translatedText: formatTranslatedCommit(translatedChunks.join(" ")), model: RIVA_MODEL };
      }),
  }),
});

export type AppRouter = typeof appRouter;
