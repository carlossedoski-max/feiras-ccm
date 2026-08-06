import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  projectId: z.string().min(1),
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
  promptOnly: z.boolean().default(false),
});

const CHAT_MODEL = "google/gemini-3-flash-preview";
const IMAGE_MODEL = "google/gemini-3.1-flash-image";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function apiKey() {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("LOVABLE_API_KEY não configurada.");
  return key;
}

function headers(key: string) {
  return {
    "Content-Type": "application/json",
    "Lovable-API-Key": key,
    Authorization: `Bearer ${key}`,
  };
}

function gatewayError(status: number, text: string): Error {
  if (status === 429) return new Error("Limite de requisições atingido. Tente novamente em instantes.");
  if (status === 402) return new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
  return new Error(`Falha na geração (${status}): ${text.slice(0, 300)}`);
}

function parseJson(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("A IA não retornou JSON válido.");
    return JSON.parse(m[0]) as Record<string, unknown>;
  }
}

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

export const generateConceptImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const key = apiKey();

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

    const planRes = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PLAN_PROMPT },
          { role: "user", content: contextText },
        ],
      }),
    });
    if (!planRes.ok) throw gatewayError(planRes.status, await planRes.text());
    const planJson = (await planRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const plan = parseJson(planJson.choices?.[0]?.message?.content ?? "");

    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    const imagePrompt = String(plan['imagePrompt'] ?? "").trim();
    if (!imagePrompt) throw new Error("A IA não conseguiu montar o prompt visual.");

    if (data.promptOnly) {
      return {
        imagePath: "",
        prompt: imagePrompt,
        definedItems: arr(plan['definedItems']),
        aiItems: arr(plan['aiItems']),
        visualSummary: String(plan['visualSummary'] ?? ""),
        userId: context.userId,
      };
    }

    const imgRes = await fetch(`${GATEWAY}/images/generations`, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [
          {
            role: "user",
            content: `${imagePrompt}\n\nConceptual trade show booth rendering, professional, clean, realistic lighting, no text artifacts, no watermark.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!imgRes.ok) throw gatewayError(imgRes.status, await imgRes.text());
    const imgJson = (await imgRes.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = imgJson.data?.[0]?.b64_json;
    if (!b64) throw new Error("A IA não retornou nenhuma imagem.");

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const path = `renders/${data.projectId}/${crypto.randomUUID()}.png`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("project-images")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new Error(`Falha ao salvar a imagem: ${error.message}`);

    return {
      imagePath: path,
      prompt: imagePrompt,
      definedItems: arr(plan['definedItems']),
      aiItems: arr(plan['aiItems']),
      visualSummary: String(plan['visualSummary'] ?? ""),
      userId: context.userId,
    };
  });
