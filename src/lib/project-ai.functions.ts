import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MediaSchema = z.object({
  name: z.string().min(1),
  mime: z.string().min(1),
  dataBase64: z.string().min(1),
});

const MetaSchema = z.object({
  name: z.string().default(""),
  relatedFair: z.string().default(""),
  referenceYear: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  objective: z.string().default(""),
  notes: z.string().default(""),
});

const AnalyzeInput = z.object({
  media: z.array(MediaSchema).min(1).max(8),
  meta: MetaSchema,
});

const GenerateInput = z.object({
  kind: z.enum(["briefing", "checklist", "quote"]),
  meta: MetaSchema,
  analysis: z.unknown(),
});

const MODEL = "google/gemini-3-flash-preview";
const NO_MEASURE = "Medida não identificada pela imagem — confirmar manualmente.";

const BASE_RULES = `Regras obrigatórias:
- Responda sempre em português do Brasil.
- NUNCA invente medidas exatas. Se a imagem não permitir medir, escreva: "${NO_MEASURE}".
- Separe claramente o que foi IDENTIFICADO nas imagens do que é SUGESTÃO da IA.
- Seja objetivo, técnico e profissional. Nada de markdown com ** ou #.`;

async function callGateway(body: unknown) {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    throw new Error(`Falha na análise (${res.status}): ${errText.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("A IA não retornou JSON válido.");
    return JSON.parse(match[0]);
  }
}

function metaText(m: z.infer<typeof MetaSchema>) {
  return `Projeto: ${m.name || "—"}
Feira relacionada: ${m.relatedFair || "—"}
Ano da referência: ${m.referenceYear || "—"}
Cidade/UF: ${[m.city, m.state].filter(Boolean).join("/") || "—"}
Objetivo do novo projeto: ${m.objective || "—"}
Observações do usuário: ${m.notes || "—"}`;
}

const ANALYSIS_PROMPT = `Você é um especialista em projetos de estandes para feiras agropecuárias e industriais no Brasil (cliente: CCM do Brasil / Kawashima).
Analise visualmente as imagens enviadas (fotos de estandes, montagens anteriores ou referências) e produza um diagnóstico técnico.

Procure identificar, quando visível: tipo de cobertura, tipo de piso, área de atendimento, testeira, comunicação visual, logotipos, cores predominantes, depósito, balcões, mesas, cadeiras, TVs, painéis, expositores, produtos expostos, iluminação, circulação, área de demonstração.

${BASE_RULES}

Responda SOMENTE em JSON válido com esta estrutura EXATA:
{
  "identified": ["elemento identificado com breve descrição"],
  "positives": ["ponto positivo"],
  "improvements": ["ponto de melhoria"],
  "missing": ["item ausente, pouco claro ou que precisa de confirmação manual"],
  "suggestions": ["sugestão da IA sobre layout, exposição, circulação, comunicação visual e organização"],
  "complexity": "Simples|Intermediário|Complexo|Premium",
  "complexityReason": "justificativa citando estruturas, expositores, comunicação visual, iluminação, mobiliário, produtos, área externa e montagem especial",
  "comparison": {
    "keep": ["o que manter da feira anterior"],
    "improve": ["o que melhorar"],
    "remove": ["o que remover"],
    "add": ["o que adicionar"],
    "attention": ["pontos de atenção e possíveis problemas de montagem"],
    "costIdeas": ["ideias para reduzir custo"]
  }
}`;

export const analyzeProjectImages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data }) => {
    const blocks = data.media.map((m) =>
      m.mime.startsWith("image/")
        ? { type: "image_url", image_url: { url: `data:${m.mime};base64,${m.dataBase64}` } }
        : { type: "file", file: { filename: m.name, file_data: `data:${m.mime};base64,${m.dataBase64}` } },
    );

    const content = await callGateway({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Contexto informado pelo usuário:\n${metaText(data.meta)}\n\nAnalise as ${data.media.length} referência(s) anexada(s) e retorne o JSON pedido.` },
            ...blocks,
          ],
        },
      ],
    });

    const parsed = parseJson(content) as Record<string, unknown>;
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    const cmp = (parsed['comparison'] ?? {}) as Record<string, unknown>;
    return {
      identified: arr(parsed['identified']),
      positives: arr(parsed['positives']),
      improvements: arr(parsed['improvements']),
      missing: arr(parsed['missing']),
      suggestions: arr(parsed['suggestions']),
      complexity: String(parsed['complexity'] ?? "Intermediário"),
      complexityReason: String(parsed['complexityReason'] ?? ""),
      comparison: {
        keep: arr(cmp['keep']),
        improve: arr(cmp['improve']),
        remove: arr(cmp['remove']),
        add: arr(cmp['add']),
        attention: arr(cmp['attention']),
        costIdeas: arr(cmp['costIdeas']),
      },
    };
  });

const BRIEFING_PROMPT = `Você é um projetista de estandes. Gere um BRIEFING TÉCNICO pronto para enviar à montadora, em texto puro (sem markdown), organizado exatamente nestes tópicos numerados:
1. Dados gerais da feira
2. Objetivo do estande
3. Implantação no terreno
4. Cobertura
5. Piso
6. Área de atendimento
7. Depósito
8. Comunicação visual
9. Testeira
10. Expositores
11. Produtos
12. Iluminação
13. Área de demonstração
14. Materiais fornecidos pela CCM
15. Responsabilidades da montadora
16. Observações finais

${BASE_RULES}
Retorne JSON: { "text": "briefing completo" }`;

const CHECKLIST_PROMPT = `Gere um CHECKLIST DE MONTAGEM para a montadora, cobrindo no mínimo: tenda/cobertura, piso, rampa, depósito, testeira, logo, comunicação visual, TVs, mesas, cadeiras, balcão, expositores, iluminação, produtos, área externa, segurança, limpeza e desmontagem.

${BASE_RULES}
Responsável deve ser "CCM" ou "Montadora" (ou ambos). Status inicial sempre "Pendente".
Retorne JSON: { "rows": [ { "item": "", "description": "", "responsible": "", "status": "Pendente", "note": "" } ] }`;

const QUOTE_PROMPT = `Gere um RESUMO COMERCIAL CURTO para solicitar orçamento a montadoras/fornecedores. Máximo 20 linhas, tom cordial e direto, listando o escopo essencial e pedindo prazo, valores e condições.

${BASE_RULES}
Retorne JSON: { "text": "resumo para cotação" }`;

export const generateProjectDoc = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => GenerateInput.parse(data))
  .handler(async ({ data }) => {
    const prompt =
      data.kind === "briefing" ? BRIEFING_PROMPT : data.kind === "checklist" ? CHECKLIST_PROMPT : QUOTE_PROMPT;

    const content = await callGateway({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Contexto do projeto:\n${metaText(data.meta)}\n\nAnálise das imagens (JSON):\n${JSON.stringify(data.analysis).slice(0, 12000)}`,
        },
      ],
    });

    const parsed = parseJson(content) as Record<string, unknown>;
    if (data.kind === "checklist") {
      const rows = Array.isArray(parsed['rows']) ? (parsed['rows'] as Record<string, unknown>[]) : [];
      return {
        kind: "checklist" as const,
        rows: rows.map((r) => ({
          item: String(r['item'] ?? ""),
          description: String(r['description'] ?? ""),
          responsible: String(r['responsible'] ?? "Montadora"),
          status: String(r['status'] ?? "Pendente"),
          note: String(r['note'] ?? ""),
        })),
        text: "",
      };
    }
    return { kind: data.kind, rows: [], text: String(parsed['text'] ?? "") };
  });
