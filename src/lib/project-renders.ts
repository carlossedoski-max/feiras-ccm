import { supabase } from "@/integrations/supabase/client";
import { PROJECT_BUCKET } from "@/lib/image-projects";

export const IMAGE_STYLES = [
  "Vista frontal",
  "Perspectiva 3D",
  "Imagem conceitual realista",
  "Croqui visual",
  "Layout com aspecto econômico",
  "Layout com aspecto intermediário",
  "Layout com aspecto premium",
  "Vista aérea conceitual",
  "Vista interna do estande",
  "Vista externa do estande",
] as const;

export const PERIODS = ["Dia", "Noite"] as const;
export const AMBIENCES = ["Mais aberto", "Mais fechado"] as const;
export const BUDGET_TIERS = ["Econômico", "Intermediário", "Premium"] as const;
export const BRAND_FIDELITY = [
  "Alta — cores e logos exatamente como a marca",
  "Média — identidade da marca, com liberdade criativa",
  "Baixa — apenas referência de cores",
  "Sem marca — estande neutro",
] as const;

export const TARGET_BUDGETS = [
  "Até R$ 50 mil",
  "Até R$ 100 mil",
  "Até R$ 150 mil",
  "Até R$ 200 mil",
  "Premium sem limite definido",
] as const;

export const REQUIRED_ITEMS = [
  "Tenda ou cobertura", "Piso/deck", "Depósito", "Testeira", "Logotipo",
  "Comunicação visual", "Expositores", "TVs", "Roçadeiras", "Motosserras",
  "Produtos maiores", "Mini escavadeira", "Cortador de grama",
  "Bancada para produtos a bateria", "Área de demonstração", "Área de atendimento",
  "Área VIP", "Circulação", "Fechamento lateral", "Proteção para chuva",
  "Totens digitais", "QR Codes", "Elemento japonês/Torii", "Paisagismo",
] as const;

export const VERSION_STATUSES = [
  "Rascunho", "Em análise", "Aguardando ajustes", "Aprovado internamente",
  "Enviado para montadora", "Arquivado",
] as const;

export const QUOTE_STATUSES = [
  "Não enviado", "Enviado", "Aguardando proposta", "Proposta recebida",
  "Em negociação", "Aprovado", "Recusado",
] as const;

export const VARIATIONS = [
  { label: "Nova variação", hint: "Gere uma nova variação mantendo o mesmo conceito, mudando ângulo e distribuição interna." },
  { label: "Mais econômica", hint: "Versão mais econômica: estruturas simples, menos acabamentos, menos tecnologia, foco em custo baixo de montagem." },
  { label: "Intermediária", hint: "Versão intermediária: bom acabamento sem excessos, equilíbrio entre custo e apresentação." },
  { label: "Mais premium", hint: "Versão premium: acabamento sofisticado, iluminação cênica, materiais nobres, forte presença de marca." },
  { label: "Mais fechada", hint: "Versão mais fechada: fechamentos laterais, ambiente mais protegido e reservado." },
  { label: "Mais aberta", hint: "Versão mais aberta: circulação livre, poucos fechamentos, acesso amplo por todos os lados." },
  { label: "Mais destaque para produtos", hint: "Versão com maior destaque para os produtos expostos, pedestais e vitrines em evidência." },
  { label: "Foco em atendimento", hint: "Versão com foco na área de atendimento, mesas de negociação e recepção." },
  { label: "Foco em demonstração", hint: "Versão com foco na área de demonstração de produtos em funcionamento." },
  { label: "Proteção para chuva", hint: "Versão reforçando proteção para chuva: cobertura ampliada, calhas, laterais protegidas e piso elevado." },
  { label: "Menor custo de montagem", hint: "Versão com menor custo de montagem: estruturas modulares, montagem rápida e reaproveitável." },
] as const;

export interface ProjectRender {
  id: string;
  project_id: string;
  version: number;
  label: string;
  image_path: string;
  image_type: string;
  prompt: string | null;
  briefing: string | null;
  style: string | null;
  period: string | null;
  ambience: string | null;
  budget_tier: string | null;
  target_budget: string | null;
  fair_type: string | null;
  city: string | null;
  state: string | null;
  main_brand: string | null;
  required_items: string[];
  defined_items: string[];
  ai_items: string[];
  visual_summary: string | null;
  notes: string | null;
  responsible: string | null;
  status: string;
  origin: string | null;
  mode: string | null;
  created_at: string;
}

export const IMAGE_ORIGINS = [
  "Gerada pela ferramenta",
  "Enviada manualmente",
  "Recebida da montadora",
  "Referência externa",
] as const;

export async function fetchRenders(projectId: string): Promise<ProjectRender[]> {
  const { data, error } = await supabase
    .from("project_renders")
    .select("*")
    .eq("project_id", projectId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProjectRender[];
}

export async function insertRender(row: Partial<ProjectRender> & { project_id: string; image_path: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("project_renders")
    .insert({ ...row, created_by: userData.user?.id ?? null } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ProjectRender;
}

export async function patchRender(id: string, patch: Partial<ProjectRender>) {
  const { data, error } = await supabase
    .from("project_renders")
    .update(patch as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ProjectRender;
}

export async function deleteRender(r: ProjectRender) {
  await supabase.storage.from(PROJECT_BUCKET).remove([r.image_path]);
  const { error } = await supabase.from("project_renders").delete().eq("id", r.id);
  if (error) throw error;
}

export function renderToText(r: ProjectRender, projectName: string): string {
  const list = (t: string, items: string[]) =>
    items?.length ? `\n${t}\n${items.map((i) => `- ${i}`).join("\n")}\n` : "";
  return (
    `IMAGEM CONCEITUAL — ${projectName}\n` +
    `Versão ${r.version} — ${r.label}\n` +
    `Gerada em: ${new Date(r.created_at).toLocaleString("pt-BR")}\n` +
    `Estilo: ${r.style || "—"} | Período: ${r.period || "—"} | Ambiente: ${r.ambience || "—"}\n` +
    `Faixa de orçamento: ${r.budget_tier || "—"} | Orçamento-alvo: ${r.target_budget || "—"}\n` +
    `Tipo de feira: ${r.fair_type || "—"} | Local: ${[r.city, r.state].filter(Boolean).join("/") || "—"} | Marca: ${r.main_brand || "—"}\n` +
    `Responsável: ${r.responsible || "—"} | Status da versão: ${r.status}\n` +
    (r.visual_summary ? `\nRESUMO VISUAL DO PROJETO\n${r.visual_summary}\n` : "") +
    list("ITENS OBRIGATÓRIOS SOLICITADOS", r.required_items ?? []) +
    list("DEFINIDO NO BRIEFING", r.defined_items ?? []) +
    list("INTERPRETADO AUTOMATICAMENTE PELA IA", r.ai_items ?? []) +
    (r.notes ? `\nOBSERVAÇÕES\n${r.notes}\n` : "") +
    (r.briefing ? `\nBRIEFING UTILIZADO\n${r.briefing}\n` : "") +
    `\nAviso: imagem meramente conceitual. Não substitui projeto executivo, planta técnica, ART/RRT, medidas finais ou a responsabilidade técnica da montadora.\n`
  );
}

export function supplierMessage(projectName: string, fairName: string): string {
  return (
    `Olá, tudo bem?\n\n` +
    `Segue briefing técnico e imagem conceitual para desenvolvimento de proposta de estande para a feira ${fairName || projectName}.\n\n` +
    `A imagem é apenas uma referência visual para facilitar o entendimento do conceito desejado. O projeto executivo, medidas finais, responsabilidades técnicas e viabilidade de montagem deverão ser avaliados pela montadora.\n\n` +
    `Pedimos, por gentileza, o envio de proposta considerando estrutura, acabamento, comunicação visual, expositores, mobiliário, iluminação, montagem, desmontagem e demais itens necessários.\n\n` +
    `Ficamos à disposição para dúvidas.\n\nAtenciosamente,\nMarketing — CCM do Brasil`
  );
}
