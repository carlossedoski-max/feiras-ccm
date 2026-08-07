/**
 * Camada única de provedores de IA de texto/visão.
 *
 * Ordem de tentativa:
 *  1. OpenAI API (quando OPENAI_API_KEY estiver configurada no backend)
 *  2. Lovable AI Gateway (créditos do workspace)
 *
 * A chave NUNCA sai do backend: nada aqui é exportado para o navegador.
 */

export type AiMode = "openai" | "lovable" | "auto";
export type AiProviderUsed = "OpenAI API" | "Lovable AI";

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
export const LOVABLE_MODEL = "google/gemini-3-flash-preview";

export interface AiCallResult {
  content: string;
  provider: AiProviderUsed;
  model: string;
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export function openaiKey(): string | undefined {
  const k = process.env['OPENAI_API_KEY'];
  return k && k.trim() ? k.trim() : undefined;
}

export function openaiModel(): string {
  const m = process.env['OPENAI_MODEL'];
  return m && m.trim() ? m.trim() : DEFAULT_OPENAI_MODEL;
}

export function lovableKey(): string | undefined {
  const k = process.env['LOVABLE_API_KEY'];
  return k && k.trim() ? k.trim() : undefined;
}

function friendlyError(provider: string, status: number, text: string): string {
  if (status === 401 || status === 403) return `${provider}: chave inválida ou sem permissão.`;
  if (status === 429) return `${provider}: limite de uso atingido. Tente novamente em instantes.`;
  if (status === 402) return `${provider}: créditos/saldo insuficientes.`;
  return `${provider}: erro ${status}. ${text.slice(0, 200)}`;
}

type Msg = { role: "system" | "user"; content: unknown };

async function callOpenAi(messages: Msg[], jsonMode: boolean): Promise<AiCallResult> {
  const key = openaiKey();
  if (!key) throw new AiUnavailableError("OPENAI_API_KEY não configurada.");
  const model = openaiModel();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new AiUnavailableError(friendlyError("OpenAI API", res.status, await res.text()));
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { content: json.choices?.[0]?.message?.content ?? "", provider: "OpenAI API", model };
}

async function callLovable(messages: Msg[], jsonMode: boolean): Promise<AiCallResult> {
  const key = lovableKey();
  if (!key) throw new AiUnavailableError("Lovable AI não configurada.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: LOVABLE_MODEL,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new AiUnavailableError(friendlyError("Lovable AI", res.status, await res.text()));
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { content: json.choices?.[0]?.message?.content ?? "", provider: "Lovable AI", model: LOVABLE_MODEL };
}

/** Executa a chamada respeitando o modo escolhido, com fallback automático em "auto". */
export async function callTextAi(
  messages: Msg[],
  opts: { mode?: AiMode; jsonMode?: boolean } = {},
): Promise<AiCallResult> {
  const mode = opts.mode ?? "auto";
  const jsonMode = opts.jsonMode ?? true;

  if (mode === "openai") return callOpenAi(messages, jsonMode);
  if (mode === "lovable") return callLovable(messages, jsonMode);

  const errors: string[] = [];
  if (openaiKey()) {
    try {
      return await callOpenAi(messages, jsonMode);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  try {
    return await callLovable(messages, jsonMode);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  throw new AiUnavailableError(
    errors.join(" · ") ||
      "Nenhum provedor de IA disponível. Configure a OPENAI_API_KEY ou use os modos manual/template.",
  );
}

export function parseJsonContent(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("A IA não retornou JSON válido.");
    return JSON.parse(m[0]) as Record<string, unknown>;
  }
}

/** Bloco multimodal compatível com OpenAI e Lovable Gateway. */
export function mediaBlock(name: string, mime: string, dataBase64: string) {
  if (mime.startsWith("image/")) {
    return { type: "image_url", image_url: { url: `data:${mime};base64,${dataBase64}` } };
  }
  return { type: "file", file: { filename: name, file_data: `data:${mime};base64,${dataBase64}` } };
}
