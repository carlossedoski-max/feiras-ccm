import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  filename: z.string().min(1),
  mime: z.string().min(1),
  dataBase64: z.string().min(1),
  mode: z.enum(["openai", "lovable", "auto"]).default("auto"),
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
  "safetyRules": ["regra de segurança 1", "..."],
  "fineRisks": ["risco de multa/penalidade 1", "..."],
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
- Foque em prazos, taxas obrigatórias, documentos, regras de montagem/desmontagem, segurança, proibições, riscos de multa e pontos de atenção.
- Gere entre 8 e 20 tarefas sugeridas cobrindo credenciais, contratos, pagamentos, montagem, desmontagem, materiais e documentos.`;

export interface ManualAiResult {
  summary: string;
  deadlines: Array<{ description: string; date?: string; importance?: string; consequence?: string }>;
  allowed: string[];
  forbidden: string[];
  fees: Array<{ name: string; description?: string; estimatedValue?: string }>;
  documents: string[];
  assemblyRules: string[];
  disassemblyRules: string[];
  safetyRules: string[];
  fineRisks: string[];
  attentionPoints: string[];
  suggestedTasks: Array<{
    title: string;
    description?: string;
    deadline?: string;
    priority: "Baixa" | "Média" | "Alta" | "Urgente";
    category: string;
    responsible?: string;
  }>;
  provider: string;
  model: string;
}

export const analyzeExpoManual = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<ManualAiResult> => {
    const { callTextAi, parseJsonContent, mediaBlock } = await import("./ai-provider.server");
    const { filename, mime, dataBase64, mode } = data;

    const res = await callTextAi(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Analise este manual do expositor (${filename}) e retorne o JSON pedido.` },
            mediaBlock(filename, mime, dataBase64),
          ],
        },
      ],
      { mode, jsonMode: true },
    );

    const parsed = parseJsonContent(res.content);
    const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

    return {
      summary: String(parsed['summary'] ?? ""),
      deadlines: arr(parsed['deadlines']),
      allowed: strs(parsed['allowed']),
      forbidden: strs(parsed['forbidden']),
      fees: arr(parsed['fees']),
      documents: strs(parsed['documents']),
      assemblyRules: strs(parsed['assemblyRules']),
      disassemblyRules: strs(parsed['disassemblyRules']),
      safetyRules: strs(parsed['safetyRules']),
      fineRisks: strs(parsed['fineRisks']),
      attentionPoints: strs(parsed['attentionPoints']),
      suggestedTasks: arr(parsed['suggestedTasks']),
      provider: res.provider,
      model: res.model,
    };
  });
