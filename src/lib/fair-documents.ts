import { supabase } from "@/integrations/supabase/client";
import {
  FAIR_DOC_CATEGORIES, REQUIRED_DOC_CATEGORIES, daysUntil,
  type DocumentItem, type Fair, type FairDocCategory,
} from "@/lib/store";

export const FAIR_BUCKET = "fair-files";

export const ACCEPTED_DOC_FILES =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";

/** Normaliza registros antigos (aba "Contratos") para o formato novo. */
export function normalizeDoc(d: DocumentItem): DocumentItem {
  const legacyMap: Record<string, FairDocCategory> = {
    "Contrato": "Contrato do terreno/espaço",
    "Termo de participação": "Documento da organização",
    "Regulamento": "Documento da organização",
    "Manual do expositor": "Manual do expositor",
    "Planta do estande": "Planta/mapa",
    "Nota fiscal": "Nota fiscal",
    "Recibo": "Comprovante de pagamento",
    "Comprovante de pagamento": "Comprovante de pagamento",
    "Orçamento": "Orçamento",
    "Autorização": "Autorização",
    "Outro": "Outro",
  };
  const category =
    d.category && (FAIR_DOC_CATEGORIES as readonly string[]).includes(d.category)
      ? d.category
      : (d.type && legacyMap[d.type]) || "Outro";
  const statusMap: Record<string, string> = {
    "Enviado para assinatura": "Em análise",
  };
  return {
    ...d,
    category,
    status: statusMap[d.status] ?? d.status ?? "Pendente",
    docDate: d.docDate ?? d.receivedAt,
  };
}

export function fairDocuments(fair: Fair): DocumentItem[] {
  return (fair.documents ?? []).map(normalizeDoc);
}

export interface DocAlert {
  key: string;
  severity: "critical" | "warning" | "info";
  label: string;
}

export function documentAlerts(fair: Fair): DocAlert[] {
  const docs = fairDocuments(fair).filter((d) => !d.archived && d.status !== "Cancelado");
  const alerts: DocAlert[] = [];

  const expired = docs.filter((d) => {
    if (d.status === "Vencido") return true;
    const dd = daysUntil(d.dueDate);
    return dd != null && dd < 0 && d.status !== "Pago" && d.status !== "Arquivado";
  });
  if (expired.length) alerts.push({ key: "expired", severity: "critical", label: `${expired.length} documento(s) vencido(s)` });

  const dueSoon = docs.filter((d) => {
    const dd = daysUntil(d.dueDate);
    return dd != null && dd >= 0 && dd <= 7 && d.status !== "Pago";
  });
  if (dueSoon.length) alerts.push({ key: "due-soon", severity: "warning", label: `${dueSoon.length} documento(s) vencendo em até 7 dias` });

  const pending = docs.filter((d) => d.status === "Pendente");
  if (pending.length) alerts.push({ key: "pending", severity: "warning", label: `${pending.length} documento(s) pendente(s)` });

  const unsigned = docs.filter((d) => d.category?.startsWith("Contrato") && d.status !== "Assinado" && d.status !== "Arquivado");
  if (unsigned.length) alerts.push({ key: "unsigned", severity: "critical", label: `${unsigned.length} contrato(s) sem assinatura` });

  const paidWithoutReceipt = docs.filter((d) => d.status === "Pago" && !d.filePath);
  if (paidWithoutReceipt.length) alerts.push({ key: "receipt", severity: "warning", label: `${paidWithoutReceipt.length} pagamento(s) sem comprovante anexado` });

  const missingRequired = REQUIRED_DOC_CATEGORIES.filter(
    (c) => !docs.some((d) => d.category === c && d.filePath),
  );
  if (missingRequired.length)
    alerts.push({
      key: "required",
      severity: "critical",
      label: `Documento obrigatório sem anexo: ${missingRequired.join(" · ")}`,
    });

  const noFile = docs.filter((d) => !d.filePath && !d.link);
  if (noFile.length) alerts.push({ key: "nofile", severity: "info", label: `${noFile.length} documento(s) sem arquivo anexado` });

  return alerts;
}

export async function uploadDocFile(fairId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `documents/${fairId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(FAIR_BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return { path, name: file.name, type: file.type };
}

export async function docSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(FAIR_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error("Não foi possível abrir o arquivo.");
  return data.signedUrl;
}

export async function removeDocFile(path?: string) {
  if (!path) return;
  await supabase.storage.from(FAIR_BUCKET).remove([path]);
}
