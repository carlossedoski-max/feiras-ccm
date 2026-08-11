/**
 * Camada única de provedores de IA de texto/visão.
 *
 * Ordem de tentativa:
 *  1. Gemini API (quando GEMINI_API_KEY estiver configurada no backend)
 *  2. Lovable AI Gateway (créditos do workspace)
 *
 * A chave NUNCA sai do backend: nada aqui é exportado para o navegador.
 */

export type AiMode = "gemini" | "lovable" | "auto";
export type AiProviderUsed = "Gemini API" | "Lovable AI";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
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

export function geminiKey(): string | undefined {
  const k = process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'];
  return k && k.trim() ? k.trim() : undefined;
}

export function geminiModel(): string {
  const m = process.env['GEMINI_MODEL'];
  return m && m.trim() ? m.trim() : DEFAULT_GEMINI_MODEL;
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

function geminiParts(content: unknown) {
  if (typeof content === "string") return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content ?? "") }];
  return content.flatMap((part) => {
    if (part?.type === "text") return [{ text: String(part.text ?? "") }];
    const raw = part?.type === "image_url" ? String(part.image_url?.url ?? "") : String(part?.file?.file_data ?? "");
    const match = raw.match(/^data:([^;]+);base64,(.*)$/);
    return match ? [{ inlineData: { mimeType: match[1], data: match[2] } }] : [];
  });
}

function geminiContents(messages: Msg[]) {
  return messages.map((message) => ({ role: message.role === "system" ? "user" : message.role, parts: geminiParts(message.content) }));
}

async function callGemini(messages: Msg[], jsonMode: boolean): Promise<AiCallResult> {
  const key = geminiKey();
  if (!key) throw new AiUnavailableError("GEMINI_API_KEY não configurada.");
  const model = geminiModel();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: geminiContents(messages), generationConfig: jsonMode ? { responseMimeType: "application/json" } : undefined }),
  });
  if (!res.ok) throw new AiUnavailableError(friendlyError("Gemini API", res.status, await res.text()));
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return { content: json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "", provider: "Gemini API", model };
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

  if (mode === "gemini") return callGemini(messages, jsonMode);
  if (mode === "lovable") return callLovable(messages, jsonMode);

  const errors: string[] = [];
  if (geminiKey()) {
    try {
      return await callGemini(messages, jsonMode);
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
      "Nenhum provedor de IA disponível. Configure a GEMINI_API_KEY ou use os modos manual/template.",
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

/** Bloco multimodal compatível com Gemini e Lovable Gateway. */
export function mediaBlock(name: string, mime: string, dataBase64: string) {
  if (mime.startsWith("image/")) {
    return { type: "image_url", image_url: { url: `data:${mime};base64,${dataBase64}` } };
  }
  return { type: "file", file: { filename: name, file_data: `data:${mime};base64,${dataBase64}` } };
}
