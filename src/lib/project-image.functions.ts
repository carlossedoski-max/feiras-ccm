import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PromptInput = z.object({
  briefing: z.string().default(""),
  style: z.string().default("Imagem conceitual realista"),
  period: z.string().default("Dia"),
  ambience: z.string().default("Mais aberto"),
  budgetTier: z.string().default("Intermediário"),
  targetBudget: z.string().default(""),
  fairType: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  mainBrand: z.string().default(""),
  requiredItems: z.array(z.string()).default([]),
  extraNotes: z.string().default(""),
  variationHint: z.string().default(""),
  brandFidelity: z.string().default("Alta — cores e logos exatamente como a marca"),
  mode: z.enum(["openai", "lovable", "auto"]).default("auto"),
});

const ImageInput = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(10),
});

const PLAN_PROMPT = `Você é um projetista de estandes para feiras agropecuárias e industriais no Brasil (cliente: CCM do Brasil / Kawashima).
Com base no briefing técnico e nas opções informadas, escreva um PROMPT VISUAL em inglês para um modelo de geração de imagens criar uma imagem CONCEITUAL do estande.

Regras:
- O prompt em inglês deve descrever a cena completa: estrutura, cobertura, piso, testeira com logotipo, comunicação visual, expositores, produtos, mobiliário, iluminação, circulação, pessoas ao fundo, e o entorno da feira.
- Respeite rigorosamente os itens obrigatórios informados.
- Respeite a faixa e o orçamento-alvo: quando econômico, nada de materiais nobres, telões enormes ou estruturas complexas.
- Nunca invente medidas exatas.
- As listas de itens devem estar em português do Brasil.

Responda SOMENTE em JSON válido:
{
  "imagePrompt": "prompt detalhado em inglês",
  "definedItems": ["item que estava explicitamente definido no briefing ou nos itens obrigatórios"],
  "aiItems": ["item ou decisão que a IA interpretou/assumiu por conta própria"],
  "visualSummary": "resumo visual do projeto em português, 4 a 8 linhas, texto puro"
}`;

/**
 * SOMENTE TEXTO — nunca chama API de imagem, nunca consome crédito de imagem.
 */
export const generateConceptPrompt = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PromptInput.parse(data))
  .handler(async ({ data }) => {
    const { callTextAi, parseJsonContent } = await import("./ai-provider.server");

    const contextText = `Briefing técnico:
${data.briefing?.slice(0, 12000) || "(sem briefing — use as opções abaixo)"}

Opções escolhidas:
- Estilo visual da imagem: ${data.style}
- Período do evento: ${data.period}
- Ambiente: ${data.ambience}
- Faixa de orçamento: ${data.budgetTier}
- Orçamento-alvo: ${data.targetBudget || "não informado"}
- Tipo de feira: ${data.fairType || "não informado"}
- Cidade/UF: ${[data.city, data.state].filter(Boolean).join("/") || "não informado"}
- Marca principal: ${data.mainBrand || "CCM do Brasil / Kawashima"}
- Itens obrigatórios: ${data.requiredItems.length ? data.requiredItems.join(", ") : "nenhum marcado"}
- Fidelidade de marca: ${data.brandFidelity}
- Observações extras: ${data.extraNotes || "—"}
${data.variationHint ? `- Ajuste desta variação: ${data.variationHint}` : ""}`;

    const res = await callTextAi(
      [
        { role: "system", content: PLAN_PROMPT },
        { role: "user", content: contextText },
      ],
      { mode: data.mode, jsonMode: true },
    );

    const plan = parseJsonContent(res.content);
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    const prompt = String(plan['imagePrompt'] ?? "").trim();
    if (!prompt) throw new Error("A IA não conseguiu montar o prompt visual.");

    return {
      prompt,
      definedItems: arr(plan['definedItems']),
      aiItems: arr(plan['aiItems']),
      visualSummary: String(plan['visualSummary'] ?? ""),
      provider: res.provider,
      model: res.model,
    };
  });

async function openAiImage(prompt: string): Promise<Uint8Array | null> {
  const { openaiKey } = await import("./ai-provider.server");
  const key = openaiKey();
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt: prompt.slice(0, 3800), size: "1536x1024" }),
  });
  if (!res.ok) throw new Error(`OpenAI (imagem): ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  return b64 ? toBytes(b64) : null;
}

async function lovableImage(prompt: string): Promise<Uint8Array | null> {
  const { lovableKey } = await import("./ai-provider.server");
  const key = lovableKey();
  if (!key) return null;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image",
      messages: [{ role: "user", content: `${prompt}\n\nConceptual trade show booth rendering, professional, clean, realistic lighting, no text artifacts, no watermark.` }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 402) throw new Error("Créditos de imagem indisponíveis no momento.");
    if (res.status === 429) throw new Error("Limite de requisições de imagem atingido. Tente novamente em instantes.");
    throw new Error(`Falha na geração de imagem (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  return b64 ? toBytes(b64) : null;
}

function toBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * SOMENTE IMAGEM — recebe um prompt já pronto (template, IA ou editado pelo usuário).
 */
export const generateConceptImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ImageInput.parse(data))
  .handler(async ({ data, context }) => {
    const errors: string[] = [];
    let bytes: Uint8Array | null = null;
    let provider = "";

    try {
      bytes = await openAiImage(data.prompt);
      if (bytes) provider = "OpenAI API";
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
    if (!bytes) {
      try {
        bytes = await lovableImage(data.prompt);
        if (bytes) provider = "Lovable AI";
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (!bytes) {
      throw new Error(
        errors.join(" · ") ||
          "Não foi possível gerar imagem agora. Você pode gerar o prompt, salvar o briefing ou enviar uma imagem manualmente.",
      );
    }

    const path = `renders/${data.projectId}/${crypto.randomUUID()}.png`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("project-images")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new Error(`Falha ao salvar a imagem: ${error.message}`);

    return { imagePath: path, provider, userId: context.userId };
  });
