import { createServerFn } from "@tanstack/react-start";

export interface AiStatus {
  openaiConfigured: boolean;
  openaiModel: string;
  lovableConfigured: boolean;
}

export const getAiStatus = createServerFn({ method: "GET" }).handler(async (): Promise<AiStatus> => {
  const { openaiKey, openaiModel, lovableKey } = await import("./ai-provider.server");
  return {
    openaiConfigured: !!openaiKey(),
    openaiModel: openaiModel(),
    lovableConfigured: !!lovableKey(),
  };
});

export const testOpenAiConnection = createServerFn({ method: "POST" }).handler(async () => {
  const { callTextAi } = await import("./ai-provider.server");
  const started = Date.now();
  try {
    const res = await callTextAi(
      [
        { role: "system", content: 'Responda apenas com o JSON {"ok":true}.' },
        { role: "user", content: "teste de conexão" },
      ],
      { mode: "openai", jsonMode: true },
    );
    return {
      ok: true as const,
      provider: res.provider,
      model: res.model,
      ms: Date.now() - started,
      message: "Conexão com a OpenAI API funcionando.",
    };
  } catch (e) {
    return {
      ok: false as const,
      provider: "OpenAI API" as const,
      model: "",
      ms: Date.now() - started,
      message: e instanceof Error ? e.message : "Falha ao conectar na OpenAI API.",
    };
  }
});
