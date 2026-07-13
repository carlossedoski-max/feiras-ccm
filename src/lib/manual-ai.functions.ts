import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  filename: z.string().min(1),
  mime: z.string().min(1),
  dataBase64: z.string().min(1),
});

const SYSTEM_PROMPT = `Você é um assistente especialista em análise de MANUAIS DO EXPOSITOR de feiras e eventos B2B no Brasil.

Sua tarefa é ler o manual anexado e extrair TODOS os pontos cruciais para a organização do evento.

Responda SOMENTE em JSON válido, sem markdown, sem comentários, com esta estrutura EXATA:
{
  "summary": "resumo executivo em português, objetivo, 4 a 8 linhas",
  "deadlines": [
    { "description": "...", "date": "YYYY-MM-DD ou vazio", "importance": "Baixa|Média|Alta|Urgente", "consequence": "consequência se perder o prazo" }
  ],
  "allowed": ["item 1", "item 2"],
  "forbidden": ["item 1", "item 2"],
  "fees": [ { "name": "...", "description": "...", "estimatedValue": "R$ ... ou vazio" } ],
  "documents": ["documento exigido 1", "..."],
  "assemblyRules": ["regra 1", "..."],
  "disassemblyRules": ["regra 1", "..."],
  "attentionPoints": ["alerta 1", "..."],
  "suggestedTasks": [
    {
      "title": "título curto",
      "description": "descrição objetiva",
      "deadline": "YYYY-MM-DD ou vazio",
      "priority": "Baixa|Média|Alta|Urgente",
      "category": "Credenciais|Contratos|Taxas|Pagamentos|Energia|Limpeza|Montagem|Desmontagem|Produtos|Materiais|Documentos|Segurança|Transporte|Outros",
      "responsible": "Marketing|Financeiro|Comercial|Logística|Diretoria|Fornecedor|Organização do evento"
    }
  ]
}

Regras:
- Todo texto em português do Brasil.
- Datas SEMPRE no formato YYYY-MM-DD. Se o manual só disser "até 30 dias antes", deixe vazio.
- Não invente informações que não estejam no manual.
- Foque em prazos, taxas obrigatórias, documentos, regras de montagem/desmontagem, proibições e pontos de atenção.
- Gere entre 8 e 20 tarefas sugeridas cobrindo credenciais, contratos, pagamentos, montagem, desmontagem, materiais e documentos.`;

export const analyzeExpoManual = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const { filename, mime, dataBase64 } = data;

    // Build multimodal content block: image_url for images, file for PDFs/docs.
    let mediaBlock: Record<string, unknown>;
    if (mime.startsWith("image/")) {
      mediaBlock = { type: "image_url", image_url: { url: `data:${mime};base64,${dataBase64}` } };
    } else {
      mediaBlock = {
        type: "file",
        file: { filename, file_data: `data:${mime};base64,${dataBase64}` },
      };
    }

    const body = {
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Analise este manual do expositor (${filename}) e retorne o JSON pedido.` },
            mediaBlock,
          ],
        },
      ],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Falha ao analisar manual (${res.status}): ${errText.slice(0, 300)}`);
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // try to extract JSON block
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("A IA não retornou JSON válido.");
      parsed = JSON.parse(match[0]);
    }
    return parsed as {
      summary: string;
      deadlines: Array<{ description: string; date?: string; importance?: string; consequence?: string }>;
      allowed: string[];
      forbidden: string[];
      fees: Array<{ name: string; description?: string; estimatedValue?: string }>;
      documents: string[];
      assemblyRules: string[];
      disassemblyRules: string[];
      attentionPoints: string[];
      suggestedTasks: Array<{
        title: string;
        description?: string;
        deadline?: string;
        priority: "Baixa" | "Média" | "Alta" | "Urgente";
        category: string;
        responsible?: string;
      }>;
    };
  });
