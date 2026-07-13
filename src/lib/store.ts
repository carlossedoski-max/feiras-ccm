import { useSyncExternalStore } from "react";

export type FairStatus =
  | "Em análise"
  | "Aguardando aprovação"
  | "Confirmada"
  | "Em preparação"
  | "Em andamento"
  | "Finalizada"
  | "Cancelada"
  | "Arquivada";

export const FAIR_STATUSES: FairStatus[] = [
  "Em análise",
  "Aguardando aprovação",
  "Confirmada",
  "Em preparação",
  "Em andamento",
  "Finalizada",
  "Cancelada",
  "Arquivada",
];

export type ChecklistPhase = "Antes da feira" | "Durante a feira" | "Depois da feira";
export type ChecklistStatus = "Pendente" | "Em andamento" | "Concluído" | "Atrasado" | "Não se aplica";
export const CHECKLIST_STATUSES: ChecklistStatus[] = ["Pendente", "Em andamento", "Concluído", "Atrasado", "Não se aplica"];

export type Priority = "Baixa" | "Média" | "Alta" | "Urgente";
export const PRIORITIES: Priority[] = ["Baixa", "Média", "Alta", "Urgente"];

export const RESPONSIBLE_SUGGESTIONS = [
  "Marketing", "Financeiro", "Comercial", "Logística", "Diretoria", "Fornecedor", "Organização do evento",
];

export interface ChecklistItem {
  id: string;
  phase: ChecklistPhase;
  title: string;
  status: ChecklistStatus;
  responsible?: string;
  deadline?: string;
  priority?: Priority;
  notes?: string;
  category?: string;
  origin?: string;
}

export interface SuggestedTask {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  priority: Priority;
  category: string;
  responsible?: string;
}

export interface ManualAnalysisDeadline { description: string; date?: string; importance?: string; consequence?: string }
export interface ManualAnalysisFee { name: string; description?: string; estimatedValue?: string }
export interface ManualAnalysis {
  filename: string;
  analyzedAt: string;
  summary: string;
  deadlines: ManualAnalysisDeadline[];
  allowed: string[];
  forbidden: string[];
  fees: ManualAnalysisFee[];
  documents: string[];
  assemblyRules: string[];
  disassemblyRules: string[];
  attentionPoints: string[];
  suggestedTasks: SuggestedTask[];
  addedTaskIds: string[];
}

export const DOCUMENT_TYPES = ["Contrato","Termo de participação","Regulamento","Manual do expositor","Planta do estande","Nota fiscal","Recibo","Comprovante de pagamento","Orçamento","Autorização","Outro"] as const;
export const DOCUMENT_STATUSES = ["Pendente","Recebido","Enviado para assinatura","Assinado","Arquivado","Cancelado"] as const;
export interface DocumentItem {
  id: string; name: string; type: typeof DOCUMENT_TYPES[number]; supplier?: string;
  receivedAt?: string; status: typeof DOCUMENT_STATUSES[number]; link?: string; notes?: string;
}

export const COST_CATEGORIES = ["Espaço","Energia","Limpeza","Segurança","Montagem","Credenciais","Internet","Transporte","Hospedagem","Alimentação","Brindes","Impressos","Outros"] as const;
export const PAYMENT_STATUSES = ["Aguardando orçamento","Aguardando aprovação","Aguardando pagamento","Pago","Cancelado"] as const;
export interface CostItem {
  id: string; category: typeof COST_CATEGORIES[number]; description: string; supplier?: string;
  estimated: number; closed: number; dueDate?: string; status: typeof PAYMENT_STATUSES[number];
  invoiceReceived: boolean; receiptAttached: boolean; notes?: string;
}

export const CREDENTIAL_TYPES = ["Expositor","Montagem","Apoio","Comercial","Visitante","Outro"] as const;
export const CREDENTIAL_STATUSES = ["Pendente","Solicitada","Aprovada","Recebida","Enviada ao participante"] as const;
export interface CredentialItem {
  id: string; name: string; company?: string; role?: string; cpf?: string; phone?: string;
  email?: string; type: typeof CREDENTIAL_TYPES[number]; status: typeof CREDENTIAL_STATUSES[number];
  sentAt?: string; notes?: string;
}

export const EXPO_TYPES = ["Produto destaque","Demonstração","Apenas exposição","Peças/acessórios","Venda no local"] as const;
export const LOGISTIC_STATUSES = ["A definir","Separar","Separado","Enviado","Recebido no evento","Retornou","Pendente retorno"] as const;
export interface ProductItem {
  id: string; code: string; description: string; brand?: string; quantity: number;
  expoType: typeof EXPO_TYPES[number]; working: boolean; needsFuel: boolean;
  needsPower: boolean; needsOperator: boolean; responsible?: string;
  logisticStatus: typeof LOGISTIC_STATUSES[number]; returned: boolean; notes?: string;
}

export const MATERIAL_CATEGORIES = ["Catálogo","Banner","Placa técnica","Totem","Uniforme","Brinde","QR Code","Material comercial","Outro"] as const;
export const MATERIAL_STATUSES = ["Pendente","Em produção","Separado","Enviado","Recebido no evento","Retornou"] as const;
export interface MaterialItem {
  id: string; item: string; category: typeof MATERIAL_CATEGORIES[number];
  needed: number; available: number; responsible?: string;
  status: typeof MATERIAL_STATUSES[number]; notes?: string;
}

export const SUPPLIER_SERVICES = ["Organização do evento","Montagem","Limpeza","Transporte","Hotel","Gráfica","Brindes","Energia","Internet","Segurança","Outro"] as const;
export interface SupplierItem {
  id: string; name: string; service: typeof SUPPLIER_SERVICES[number]; contact?: string;
  whatsapp?: string; email?: string; value: number; status: string; notes?: string;
}

export interface FairReport {
  totalLeads?: number; interestedResellers?: string; topProducts?: string;
  totalCost?: number; positives?: string; problems?: string; improvements?: string;
  photos?: string; worthAgain?: "Sim" | "Não" | "Avaliar melhor"; finalNotes?: string;
}

export interface Fair {
  id: string; name: string; year: number; city: string; state: string; venue?: string;
  startDate?: string; endDate?: string; status: FairStatus;
  responsible?: string; commercial?: string; areaSize?: string;
  spaceValue?: number; notes?: string;
  checklist: ChecklistItem[];
  documents: DocumentItem[];
  costs: CostItem[];
  credentials: CredentialItem[];
  products: ProductItem[];
  materials: MaterialItem[];
  suppliers: SupplierItem[];
  report: FairReport;
  manualAnalysis?: ManualAnalysis;
  createdAt: string;
}

// Default checklist template with suggested deadline (days before startDate) and priority.
interface DefaultChecklistEntry { phase: ChecklistPhase; title: string; daysBefore: number; priority: Priority }
const DEFAULT_CHECKLIST: DefaultChecklistEntry[] = [
  // Antes da feira — offsets negativos = antes da data inicial
  { phase: "Antes da feira", title: "Solicitar proposta comercial", daysBefore: 75, priority: "Alta" },
  { phase: "Antes da feira", title: "Avaliar valor do espaço", daysBefore: 70, priority: "Média" },
  { phase: "Antes da feira", title: "Confirmar participação", daysBefore: 60, priority: "Alta" },
  { phase: "Antes da feira", title: "Receber contrato", daysBefore: 50, priority: "Alta" },
  { phase: "Antes da feira", title: "Enviar contrato para assinatura", daysBefore: 47, priority: "Alta" },
  { phase: "Antes da feira", title: "Pagamento da taxa do espaço", daysBefore: 45, priority: "Urgente" },
  { phase: "Antes da feira", title: "Solicitar nota fiscal/recibo", daysBefore: 40, priority: "Média" },
  { phase: "Antes da feira", title: "Definir equipe participante", daysBefore: 35, priority: "Média" },
  { phase: "Antes da feira", title: "Solicitar credenciais", daysBefore: 30, priority: "Alta" },
  { phase: "Antes da feira", title: "Definir produtos para exposição", daysBefore: 30, priority: "Alta" },
  { phase: "Antes da feira", title: "Separar materiais gráficos", daysBefore: 30, priority: "Alta" },
  { phase: "Antes da feira", title: "Separar brindes", daysBefore: 15, priority: "Média" },
  { phase: "Antes da feira", title: "Organizar transporte dos produtos", daysBefore: 15, priority: "Alta" },
  { phase: "Antes da feira", title: "Confirmar montagem do espaço", daysBefore: 15, priority: "Alta" },
  { phase: "Antes da feira", title: "Confirmar energia elétrica", daysBefore: 15, priority: "Média" },
  { phase: "Antes da feira", title: "Confirmar limpeza", daysBefore: 15, priority: "Média" },
  { phase: "Antes da feira", title: "Confirmar internet, se necessário", daysBefore: 15, priority: "Baixa" },
  { phase: "Antes da feira", title: "Conferência final", daysBefore: 7, priority: "Alta" },
  { phase: "Antes da feira", title: "Montagem e organização do estande", daysBefore: 1, priority: "Urgente" },
  // Durante — usar data inicial da feira
  { phase: "Durante a feira", title: "Conferir montagem do estande", daysBefore: 0, priority: "Alta" },
  { phase: "Durante a feira", title: "Conferir produtos expostos", daysBefore: 0, priority: "Alta" },
  { phase: "Durante a feira", title: "Conferir materiais impressos", daysBefore: 0, priority: "Média" },
  { phase: "Durante a feira", title: "Controlar leads recebidos", daysBefore: 0, priority: "Alta" },
  { phase: "Durante a feira", title: "Registrar fotos e vídeos", daysBefore: 0, priority: "Média" },
  { phase: "Durante a feira", title: "Controlar brindes entregues", daysBefore: 0, priority: "Baixa" },
  { phase: "Durante a feira", title: "Acompanhar limpeza do espaço", daysBefore: 0, priority: "Baixa" },
  { phase: "Durante a feira", title: "Registrar problemas ocorridos", daysBefore: 0, priority: "Média" },
  // Depois — offsets positivos após a feira
  { phase: "Depois da feira", title: "Recolher materiais", daysBefore: -1, priority: "Alta" },
  { phase: "Depois da feira", title: "Conferir retorno dos produtos", daysBefore: -3, priority: "Alta" },
  { phase: "Depois da feira", title: "Organizar fotos e vídeos", daysBefore: -5, priority: "Baixa" },
  { phase: "Depois da feira", title: "Exportar leads", daysBefore: -3, priority: "Alta" },
  { phase: "Depois da feira", title: "Enviar leads ao comercial", daysBefore: -5, priority: "Urgente" },
  { phase: "Depois da feira", title: "Fazer relatório da feira", daysBefore: -10, priority: "Alta" },
  { phase: "Depois da feira", title: "Conferir pagamentos pendentes", daysBefore: -7, priority: "Alta" },
  { phase: "Depois da feira", title: "Arquivar contratos e notas", daysBefore: -14, priority: "Média" },
  { phase: "Depois da feira", title: "Registrar pontos de melhoria", daysBefore: -14, priority: "Baixa" },
];

export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(base: Date, delta: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + delta);
  return d;
}

export function makeDefaultChecklist(startDate?: string): ChecklistItem[] {
  const start = parseLocalDate(startDate);
  return DEFAULT_CHECKLIST.map(({ phase, title, daysBefore, priority }) => {
    const deadline = start ? toISODate(addDays(start, -daysBefore)) : undefined;
    return { id: uid(), phase, title, status: "Pendente", priority, deadline };
  });
}

export function createEmptyFair(partial: Partial<Fair> = {}): Fair {
  const startDate = partial.startDate;
  return {
    id: uid(), name: "", year: new Date().getFullYear(), city: "", state: "",
    status: "Em análise",
    checklist: makeDefaultChecklist(startDate),
    documents: [], costs: [], credentials: [], products: [], materials: [], suppliers: [],
    report: {}, createdAt: new Date().toISOString(),
    ...partial,
  };
}

// ---- Store ----
const KEY = "ccm-feira-control:v1";
type State = { fairs: Fair[] };
const listeners = new Set<() => void>();
let state: State = load();
let snapshot: State = state;

function load(): State {
  if (typeof window === "undefined") return { fairs: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {}
  return { fairs: [] };
}
function persist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
function emit() {
  snapshot = { ...state, fairs: [...state.fairs] };
  persist();
  listeners.forEach(l => l());
}
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot(): State { return snapshot; }
function getServerSnapshot(): State { return { fairs: [] }; }

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getServerSnapshot()));
}

export const actions = {
  addFair(f: Fair) { state.fairs = [f, ...state.fairs]; emit(); },
  updateFair(id: string, patch: Partial<Fair>) {
    state.fairs = state.fairs.map(f => f.id === id ? { ...f, ...patch } : f); emit();
  },
  deleteFair(id: string) { state.fairs = state.fairs.filter(f => f.id !== id); emit(); },
  updateChild<K extends keyof Fair>(fairId: string, key: K, updater: (list: Fair[K]) => Fair[K]) {
    state.fairs = state.fairs.map(f => f.id === fairId ? { ...f, [key]: updater(f[key]) } : f);
    emit();
  },
};

// ---- Date helpers ----
function parseLocalDate(iso?: string): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysUntil(iso?: string): number | null {
  const d = parseLocalDate(iso);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = parseLocalDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("pt-BR");
}

export function fmtMoney(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Retorna um "tom" baseado no prazo e status:
 * - done       → verde (concluído)
 * - overdue    → vermelho (vencido)
 * - soon       → amarelo (vence em ≤ 3 dias)
 * - week       → azul (vence em ≤ 7 dias)
 * - normal     → cinza
 * - noDeadline → laranja/warning (sem prazo definido)
 */
export type DeadlineTone = "done" | "overdue" | "soon" | "week" | "normal" | "noDeadline";
export function deadlineTone(iso: string | undefined, completed: boolean): DeadlineTone {
  if (completed) return "done";
  if (!iso) return "noDeadline";
  const d = daysUntil(iso);
  if (d == null) return "normal";
  if (d < 0) return "overdue";
  if (d <= 3) return "soon";
  if (d <= 7) return "week";
  return "normal";
}

export const toneClasses: Record<DeadlineTone, { pill: string; row: string; text: string; label: string }> = {
  done:       { pill: "bg-success/15 text-success border-success/40",           row: "border-l-4 border-l-success",     text: "text-success",                     label: "Concluído" },
  overdue:    { pill: "bg-destructive/15 text-destructive border-destructive/40", row: "border-l-4 border-l-destructive", text: "text-destructive font-semibold",  label: "Vencido" },
  soon:       { pill: "bg-warning/20 text-warning-foreground border-warning/50", row: "border-l-4 border-l-warning",     text: "text-warning-foreground font-semibold", label: "≤ 3 dias" },
  week:       { pill: "bg-info/15 text-info border-info/40",                     row: "border-l-4 border-l-info",        text: "text-info",                       label: "≤ 7 dias" },
  normal:     { pill: "bg-muted text-muted-foreground border-border",            row: "border-l-4 border-l-transparent", text: "text-muted-foreground",           label: "No prazo" },
  noDeadline: { pill: "bg-orange-500/15 text-orange-600 border-orange-500/40",   row: "border-l-4 border-l-orange-500",  text: "text-orange-600 font-semibold",   label: "Sem prazo" },
};

export function isThisWeek(iso?: string): boolean {
  const d = parseLocalDate(iso);
  if (!d) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay(); // 0 = domingo
  const start = new Date(now); start.setDate(now.getDate() - day);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

export function isThisWeekCompleted(iso?: string): boolean {
  return isThisWeek(iso);
}

export function exportCSV(filename: string, rowsIn: readonly object[]) {
  const rows = rowsIn as readonly Record<string, unknown>[];
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(";"), ...rows.map(r => headers.map(h => esc(r[h])).join(";"))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
