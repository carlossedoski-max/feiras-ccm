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

export interface ChecklistItem {
  id: string;
  phase: ChecklistPhase;
  title: string;
  status: ChecklistStatus;
  responsible?: string;
  deadline?: string;
  notes?: string;
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
  createdAt: string;
}

const DEFAULT_CHECKLIST: Array<{ phase: ChecklistPhase; title: string }> = [
  ...["Solicitar proposta comercial","Avaliar valor do espaço","Aprovar participação","Receber contrato","Enviar contrato para assinatura","Confirmar pagamento da taxa","Solicitar nota fiscal/recibo","Solicitar credenciais","Definir equipe participante","Definir produtos para exposição","Separar materiais gráficos","Separar brindes","Organizar transporte dos produtos","Verificar montagem do espaço","Confirmar energia elétrica","Confirmar limpeza","Confirmar internet, se necessário"].map(title => ({ phase: "Antes da feira" as ChecklistPhase, title })),
  ...["Conferir montagem do estande","Conferir produtos expostos","Conferir materiais impressos","Controlar leads recebidos","Registrar fotos e vídeos","Controlar brindes entregues","Acompanhar limpeza do espaço","Registrar problemas ocorridos"].map(title => ({ phase: "Durante a feira" as ChecklistPhase, title })),
  ...["Recolher materiais","Conferir retorno dos produtos","Organizar fotos e vídeos","Exportar leads","Enviar leads ao comercial","Fazer relatório da feira","Conferir pagamentos pendentes","Arquivar contratos e notas","Registrar pontos de melhoria"].map(title => ({ phase: "Depois da feira" as ChecklistPhase, title })),
];

export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

export function makeDefaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST.map(({ phase, title }) => ({ id: uid(), phase, title, status: "Pendente" }));
}

export function createEmptyFair(partial: Partial<Fair> = {}): Fair {
  return {
    id: uid(), name: "", year: new Date().getFullYear(), city: "", state: "",
    status: "Em análise",
    checklist: makeDefaultChecklist(),
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

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

export function fmtMoney(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
