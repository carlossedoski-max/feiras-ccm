/**
 * Geração por TEMPLATE — nunca consome créditos nem chama API de IA.
 * Usado como alternativa segura quando a IA está indisponível.
 */

export const MISSING = "Informação não preenchida — confirmar manualmente.";

export interface TemplateData {
  fairName?: string;
  city?: string;
  state?: string;
  standType?: string;
  area?: string;
  objective?: string;
  style?: string;
  period?: string;
  ambience?: string;
  budgetTier?: string;
  targetBudget?: string;
  mainBrand?: string;
  brandColors?: string;
  logo?: string;
  products?: string;
  requiredItems?: string[];
  notes?: string;
  fairType?: string;
  brandFidelity?: string;
}

const v = (s?: string) => (s && s.trim() ? s.trim() : MISSING);

function has(items: string[] | undefined, term: string) {
  return (items ?? []).some((i) => i.toLowerCase().includes(term.toLowerCase()));
}
const yesNo = (items: string[] | undefined, term: string) => (has(items, term) ? "Sim — obrigatório" : MISSING);

/** Briefing técnico completo por template, nos 16 tópicos padrão. */
export function buildTemplateBriefing(d: TemplateData): string {
  const local = [d.city, d.state].filter(Boolean).join("/");
  const items = d.requiredItems ?? [];
  const lines: string[] = [];
  const t = (n: number, title: string, body: string) => lines.push(`${n}. ${title}\n${body}\n`);

  t(1, "Dados gerais da feira",
    `Feira: ${v(d.fairName)}\nCidade/UF: ${local || MISSING}\nTipo de feira: ${v(d.fairType)}\nÁrea do estande: ${v(d.area)}\nTipo de estande: ${v(d.standType)}\nPeríodo do evento: ${v(d.period)}\nAmbiente: ${v(d.ambience)}\nFaixa de orçamento: ${v(d.budgetTier)}\nOrçamento-alvo: ${v(d.targetBudget)}`);
  t(2, "Objetivo do estande", v(d.objective));
  t(3, "Implantação no terreno", `Ambiente ${d.ambience || MISSING}. Circulação: ${yesNo(items, "Circulação")}. Fechamento lateral: ${yesNo(items, "Fechamento")}. Proteção para chuva: ${yesNo(items, "Proteção")}.`);
  t(4, "Cobertura", has(items, "Tenda") || has(items, "cobertura") ? "Tenda/cobertura obrigatória, dimensionada conforme a área contratada. Medidas finais a confirmar com a montadora." : MISSING);
  t(5, "Piso", yesNo(items, "Piso"));
  t(6, "Área de atendimento", yesNo(items, "Área de atendimento"));
  t(7, "Depósito", yesNo(items, "Depósito"));
  t(8, "Comunicação visual", `${yesNo(items, "Comunicação visual")}\nMarca principal: ${v(d.mainBrand)}\nCores da marca: ${v(d.brandColors)}\nLogotipo: ${v(d.logo)}\nFidelidade de marca: ${v(d.brandFidelity)}`);
  t(9, "Testeira", yesNo(items, "Testeira"));
  t(10, "Expositores", yesNo(items, "Expositores"));
  t(11, "Produtos", v(d.products));
  t(12, "Iluminação", `Iluminação adequada ao período: ${v(d.period)}. Detalhamento técnico a confirmar com a montadora.`);
  t(13, "Área de demonstração", yesNo(items, "Área de demonstração"));
  t(14, "Materiais fornecidos pela CCM", "Produtos expostos, materiais gráficos, catálogos, brindes e uniformes. Confirmar lista final na aba Produtos e Materiais.");
  t(15, "Responsabilidades da montadora", "Projeto executivo, medidas finais, estrutura, montagem, desmontagem, ART/RRT quando aplicável, segurança da montagem e limpeza da área ao final.");
  t(16, "Observações finais", v(d.notes));

  return (
    `BRIEFING TÉCNICO — ${d.fairName || "Projeto de estande"}\n` +
    `Gerado por template em ${new Date().toLocaleString("pt-BR")} (sem uso de IA).\n\n` +
    lines.join("\n") +
    `\nAviso: documento base para orçamento. Não substitui projeto executivo nem medidas finais da montadora.`
  );
}

/** Prompt profissional por template — texto pronto para colar em qualquer gerador de imagem. */
export function buildTemplatePrompt(d: TemplateData): string {
  const local = [d.city, d.state].filter(Boolean).join("/");
  const items = (d.requiredItems ?? []).join(", ");
  return [
    `Professional conceptual rendering of a trade show booth for the Brazilian fair "${d.fairName || "feira agropecuária/industrial"}"${local ? ` in ${local}` : ""}.`,
    d.fairType ? `Fair type: ${d.fairType}.` : "",
    d.standType ? `Booth type: ${d.standType}.` : "",
    d.area ? `Booth area: ${d.area}.` : "",
    d.objective ? `Purpose of the booth: ${d.objective}.` : "",
    `Visual style: ${d.style || "realistic conceptual image"}, ${d.period === "Noite" ? "night lighting" : "daylight"}, ${d.ambience === "Mais fechado" ? "more enclosed layout" : "open and airy layout"}.`,
    `Budget level: ${d.budgetTier || "intermediate"}${d.targetBudget ? ` (target: ${d.targetBudget})` : ""} — materials and structures must look consistent with this budget.`,
    `Main brand: ${d.mainBrand || "CCM do Brasil / Kawashima"}${d.brandColors ? `, brand colors ${d.brandColors}` : ""}${d.logo ? `, brand logo: ${d.logo}` : ""}. Brand fidelity: ${d.brandFidelity || "high"}.`,
    items ? `Must include: ${items}.` : "",
    d.products ? `Products on display: ${d.products}.` : "",
    "Include realistic lighting, clean circulation, visitors in the background and a professional fair environment.",
    d.notes ? `Additional requirements: ${d.notes}.` : "",
    "No text artifacts, no watermark, no distorted logos. Conceptual image only — not a technical drawing.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Checklist de montagem por template (sem IA). */
export function buildTemplateChecklist(): Array<{ item: string; description: string; responsible: string; status: string; note: string }> {
  const rows: Array<[string, string, string]> = [
    ["Tenda/cobertura", "Montagem da estrutura de cobertura conforme área contratada", "Montadora"],
    ["Piso/deck", "Nivelamento e instalação do piso", "Montadora"],
    ["Rampa de acesso", "Acessibilidade e circulação", "Montadora"],
    ["Depósito", "Área fechada para estoque e pertences da equipe", "Montadora"],
    ["Testeira", "Instalação da testeira com identificação", "Montadora"],
    ["Logotipo", "Aplicação do logotipo conforme manual da marca", "Montadora"],
    ["Comunicação visual", "Banners, painéis e adesivos", "CCM / Montadora"],
    ["TVs e eletrônicos", "Fixação, cabos e testes", "CCM"],
    ["Mesas e cadeiras", "Mobiliário da área de atendimento", "Montadora"],
    ["Balcão", "Balcão de recepção", "Montadora"],
    ["Expositores", "Pedestais e suportes de produtos", "Montadora"],
    ["Iluminação", "Pontos de luz e testes elétricos", "Montadora"],
    ["Produtos", "Posicionamento e conferência dos produtos", "CCM"],
    ["Área externa", "Organização da área externa e sinalização", "Montadora"],
    ["Segurança", "Sinalização, extintor e conferência de riscos", "Montadora"],
    ["Limpeza", "Limpeza antes da abertura e durante o evento", "Montadora"],
    ["Desmontagem", "Retirada de estrutura e devolução da área", "Montadora"],
  ];
  return rows.map(([item, description, responsible]) => ({ item, description, responsible, status: "Pendente", note: "" }));
}
