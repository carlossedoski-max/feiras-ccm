import type { Fair, ReadinessAnswer, ReadinessStatus } from "@/lib/store";

export interface ReadinessItemDef {
  id: string;
  label: string;
  /** Bloqueia "Pronta para execução" quando não estiver "Sim". */
  required?: boolean;
  /** Bloqueia "Pronta para envio" quando não estiver "Sim". */
  shipping?: boolean;
}

export interface ReadinessGroupDef {
  id: string;
  title: string;
  items: ReadinessItemDef[];
}

export const READINESS_GROUPS: ReadinessGroupDef[] = [
  {
    id: "contratos",
    title: "Contratos e aprovações",
    items: [
      { id: "contrato-feira", label: "Contrato da feira assinado", required: true },
      { id: "contrato-montadora", label: "Contrato da montadora assinado", required: true },
      { id: "contrato-fornecedores", label: "Contratos dos fornecedores principais assinados", required: true },
      { id: "orcamentos", label: "Orçamentos aprovados", required: true },
      { id: "pagamentos", label: "Pagamentos/taxas conferidos", required: true },
      { id: "manual", label: "Manual do expositor analisado" },
    ],
  },
  {
    id: "fornecedores",
    title: "Fornecedores",
    items: [
      { id: "montadora-confirmada", label: "Montadora confirmada", required: true },
      { id: "seguranca-confirmada", label: "Segurança confirmada", required: true },
      { id: "limpeza-confirmada", label: "Limpeza confirmada", required: true },
      { id: "transporte-confirmado", label: "Transporte confirmado", required: true, shipping: true },
      { id: "energia-confirmada", label: "Energia confirmada", required: true },
      { id: "internet-confirmada", label: "Internet confirmada, se aplicável" },
      { id: "resp-montadora", label: "Responsável da montadora definido" },
      { id: "resp-seguranca", label: "Responsável da segurança definido" },
      { id: "resp-limpeza", label: "Responsável da limpeza definido" },
    ],
  },
  {
    id: "credenciais",
    title: "Credenciais e equipe",
    items: [
      { id: "cred-solicitadas", label: "Credenciais solicitadas", required: true },
      { id: "cred-aprovadas", label: "Credenciais aprovadas", required: true },
      { id: "equipe-definida", label: "Equipe definida", required: true },
      { id: "resp-local", label: "Responsável local definido", required: true },
      { id: "contatos-equipe", label: "Contatos da equipe salvos" },
      { id: "horarios-equipe", label: "Horários da equipe definidos" },
    ],
  },
  {
    id: "produtos",
    title: "Produtos e logística",
    items: [
      { id: "lista-produtos", label: "Lista de produtos definida", required: true, shipping: true },
      { id: "produtos-separados", label: "Produtos separados", required: true, shipping: true },
      { id: "produtos-conferidos", label: "Produtos conferidos", required: true, shipping: true },
      { id: "produtos-fotografados", label: "Produtos fotografados antes do envio", shipping: true },
      { id: "produtos-enviados", label: "Produtos enviados", required: true },
      { id: "produtos-recebidos", label: "Produtos recebidos no local", required: true },
      { id: "produtos-testados", label: "Produtos testados, se aplicável" },
      { id: "acessorios", label: "Acessórios obrigatórios conferidos", shipping: true },
      { id: "ferramentas", label: "Ferramentas de apoio conferidas", shipping: true },
    ],
  },
  {
    id: "materiais",
    title: "Materiais e brindes",
    items: [
      { id: "graficos", label: "Materiais gráficos conferidos", shipping: true },
      { id: "catalogos", label: "Catálogos separados", shipping: true },
      { id: "banners", label: "Banners separados", shipping: true },
      { id: "placas", label: "Placas técnicas conferidas" },
      { id: "qrcodes", label: "QR Codes conferidos" },
      { id: "brindes", label: "Brindes separados", shipping: true },
      { id: "uniformes", label: "Uniformes separados" },
      { id: "cabos", label: "Cabos, extensões e adaptadores conferidos" },
      { id: "eletronicos", label: "TVs/tablets/notebooks conferidos, se aplicável" },
    ],
  },
  {
    id: "montagem",
    title: "Montagem e estande",
    items: [
      { id: "projeto-aprovado", label: "Projeto aprovado", required: true },
      { id: "briefing-enviado", label: "Briefing enviado à montadora", required: true },
      { id: "inicio-montagem", label: "Data de início da montagem confirmada", required: true },
      { id: "entrega-final", label: "Data de entrega final confirmada", required: true },
      { id: "vistoria", label: "Vistoria final programada" },
      { id: "estande-conferido", label: "Estande conferido", required: true },
      { id: "pendencias-montagem", label: "Pendências de montagem resolvidas", required: true },
    ],
  },
];

export const READINESS_ITEMS: ReadinessItemDef[] = READINESS_GROUPS.flatMap((g) => g.items);

export function readinessAnswer(fair: Fair, itemId: string): ReadinessAnswer | undefined {
  return fair.readiness?.items?.[itemId]?.answer;
}

export interface ReadinessSummary {
  total: number;
  answered: number;
  yes: number;
  no: number;
  na: number;
  pendingRequired: ReadinessItemDef[];
  pendingShipping: ReadinessItemDef[];
  percent: number;
  suggestedStatus: ReadinessStatus;
  canExecute: boolean;
  canShip: boolean;
}

export function readinessSummary(fair: Fair): ReadinessSummary {
  const items = READINESS_ITEMS;
  let yes = 0, no = 0, na = 0;
  const pendingRequired: ReadinessItemDef[] = [];
  const pendingShipping: ReadinessItemDef[] = [];

  for (const item of items) {
    const a = readinessAnswer(fair, item.id);
    if (a === "Sim") yes++;
    else if (a === "Não") no++;
    else if (a === "Não se aplica") na++;
    const ok = a === "Sim" || a === "Não se aplica";
    if (!ok && item.required) pendingRequired.push(item);
    if (!ok && item.shipping) pendingShipping.push(item);
  }

  const answered = yes + no + na;
  const relevant = items.length - na;
  const percent = relevant > 0 ? Math.round((yes / relevant) * 100) : 0;
  const canShip = pendingShipping.length === 0;
  const canExecute = pendingRequired.length === 0;

  let suggestedStatus: ReadinessStatus = "Não pronta";
  if (canExecute) suggestedStatus = "Pronta para execução";
  else if (canShip) suggestedStatus = "Pronta para envio";
  else if (yes > 0) suggestedStatus = "Em atenção";

  return { total: items.length, answered, yes, no, na, pendingRequired, pendingShipping, percent, suggestedStatus, canExecute, canShip };
}

export const READINESS_STATUS_TONE: Record<ReadinessStatus, string> = {
  "Não pronta": "bg-destructive/15 text-destructive border-destructive/40",
  "Em atenção": "bg-warning/20 text-warning-foreground border-warning/50",
  "Pronta para envio": "bg-info/15 text-info border-info/40",
  "Pronta para execução": "bg-success/15 text-success border-success/40",
  "Finalizada": "bg-muted text-muted-foreground border-border",
};
