import { supabase } from "@/integrations/supabase/client";

export const PROJECT_BUCKET = "project-images";

export const PROJECT_STATUSES = [
  "Rascunho",
  "Em análise",
  "Aguardando ajustes",
  "Aprovado internamente",
  "Enviado para montadora",
  "Aguardando orçamento",
  "Arquivado",
] as const;


export const COMPLEXITY_LEVELS = ["Simples", "Intermediário", "Complexo", "Premium"] as const;

export const ACCEPTED_PROJECT_FILES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export interface ProjectImage {
  path: string;
  name: string;
  type: string;
}

export interface ProjectAnalysis {
  identified: string[];
  positives: string[];
  improvements: string[];
  missing: string[];
  suggestions: string[];
  complexity: string;
  complexityReason: string;
  comparison: {
    keep: string[];
    improve: string[];
    remove: string[];
    add: string[];
    attention: string[];
    costIdeas: string[];
  };
}

export interface ChecklistRow {
  item: string;
  description: string;
  responsible: string;
  status: string;
  note: string;
}

export interface ImageProject {
  id: string;
  name: string;
  related_fair: string | null;
  reference_year: string | null;
  city: string | null;
  state: string | null;
  objective: string | null;
  notes: string | null;
  responsible: string | null;
  status: string;
  images: ProjectImage[];
  analysis: ProjectAnalysis | null;
  briefing: string | null;
  checklist: ChecklistRow[] | null;
  quote_summary: string | null;
  comparison: ProjectAnalysis["comparison"] | null;
  complexity: string | null;
  complexity_reason: string | null;
  target_budget: string | null;
  budget_tier: string | null;
  main_brand: string | null;
  fair_type: string | null;
  required_items: string[];
  supplier_id: string | null;
  supplier_sent_at: string | null;
  quote_status: string | null;
  estimated_value: number | null;
  supplier_notes: string | null;
  history?: ProjectHistoryEntry[];
  created_at: string;
  updated_at: string;
}

/** Histórico de tentativas e versões do projeto. */
export interface ProjectHistoryEntry {
  id: string;
  at: string;
  action: string;
  status: string;
  mode: "OpenAI API" | "Lovable AI" | "Template" | "Manual";
  model?: string;
  error?: string;
  detail?: string;
}

export function historyEntry(e: Omit<ProjectHistoryEntry, "id" | "at">): ProjectHistoryEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), ...e };
}



export type ImageProjectInput = Partial<Omit<ImageProject, "id" | "created_at" | "updated_at">> & {
  name: string;
};

export function emptyProject(): ImageProjectInput {
  return {
    name: "",
    related_fair: "",
    reference_year: String(new Date().getFullYear() - 1),
    city: "",
    state: "",
    objective: "",
    notes: "",
    responsible: "Marketing",
    status: "Rascunho",
    images: [],
  };
}

// ---- Queries ----
export async function fetchProjects(): Promise<ImageProject[]> {
  const { data, error } = await supabase
    .from("image_projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ImageProject[];
}

export async function createProject(input: ImageProjectInput): Promise<ImageProject> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("image_projects")
    .insert({ ...input, created_by: userData.user?.id ?? null } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ImageProject;
}

export async function patchProject(id: string, patch: Partial<ImageProject>): Promise<ImageProject> {
  const { data, error } = await supabase
    .from("image_projects")
    .update(patch as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ImageProject;
}

export async function deleteProject(p: ImageProject) {
  if (p.images?.length) {
    await supabase.storage.from(PROJECT_BUCKET).remove(p.images.map((i) => i.path));
  }
  const { error } = await supabase.from("image_projects").delete().eq("id", p.id);
  if (error) throw error;
}

// ---- Storage ----
export async function uploadProjectFile(file: File): Promise<ProjectImage> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PROJECT_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return { path, name: file.name, type: file.type };
}

export async function removeProjectFile(path: string) {
  await supabase.storage.from(PROJECT_BUCKET).remove([path]);
}

export async function projectSignedUrl(path: string, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROJECT_BUCKET)
    .createSignedUrl(path, 3600, { download });
  if (error) throw error;
  return data.signedUrl;
}

// ---- Helpers ----
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function analysisToText(p: ImageProject): string {
  const a = p.analysis;
  if (!a) return "";
  const block = (title: string, items: string[]) =>
    items?.length ? `\n${title}\n${items.map((i) => `- ${i}`).join("\n")}\n` : "";
  return (
    `ANÁLISE DE IMAGENS — ${p.name}\n` +
    `Feira: ${p.related_fair || "—"} | Ano da referência: ${p.reference_year || "—"} | Local: ${[p.city, p.state].filter(Boolean).join("/") || "—"}\n` +
    block("ELEMENTOS IDENTIFICADOS NA IMAGEM", a.identified) +
    block("PONTOS POSITIVOS", a.positives) +
    block("PONTOS DE MELHORIA", a.improvements) +
    block("ITENS AUSENTES OU POUCO CLAROS", a.missing) +
    block("SUGESTÕES DA IA", a.suggestions) +
    `\nCOMPLEXIDADE: ${a.complexity}\n${a.complexityReason}\n`
  );
}

export function checklistToText(rows: ChecklistRow[]): string {
  return rows
    .map(
      (r, i) =>
        `${i + 1}. ${r.item}\n   Descrição: ${r.description || "—"}\n   Responsável: ${r.responsible || "—"}\n   Status: ${r.status || "—"}\n   Observação: ${r.note || "—"}`,
    )
    .join("\n\n");
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function downloadDoc(filename: string, title: string, content: string) {
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>` +
    `<h2>${escapeHtml(title)}</h2><pre style="font-family:Arial,sans-serif;font-size:11pt;white-space:pre-wrap">${escapeHtml(content)}</pre>` +
    `</body></html>`;
  triggerDownload(new Blob([html], { type: "application/msword" }), filename);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
