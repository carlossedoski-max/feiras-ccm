import { createServerFn } from "@tanstack/react-start";

export interface AiStatus {
  geminiConfigured: boolean;
  geminiModel: string;
  lovableConfigured: boolean;
}

export const getAiStatus = createServerFn({ method: "GET" }).handler(async (): Promise<AiStatus> => {
  const { geminiKey, geminiModel, lovableKey } = await import("./ai-provider.server");
  return {
    geminiConfigured: !!geminiKey(),
    geminiModel: geminiModel(),
    lovableConfigured: !!lovableKey(),
  };
});

export const testGeminiConnection = createServerFn({ method: "POST" }).handler(async () => {
  const { callTextAi } = await import("./ai-provider.server");
  const started = Date.now();
  try {
    const res = await callTextAi(
      [
        { role: "system", content: 'Responda apenas com o JSON {"ok":true}.' },
        { role: "user", content: "teste de conexão" },
      ],
      { mode: "gemini", jsonMode: true },
    );
    return {
      ok: true as const,
      provider: res.provider,
      model: res.model,
      ms: Date.now() - started,
      message: "Conexão com a Gemini API funcionando.",
    };
  } catch (e) {
    return {
      ok: false as const,
      provider: "Gemini API" as const,
      model: "",
      ms: Date.now() - started,
      message: e instanceof Error ? e.message : "Falha ao conectar na Gemini API.",
    };
  }
});
