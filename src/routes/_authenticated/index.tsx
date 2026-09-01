import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarCheck2, ClipboardList, FileWarning, CreditCard, IdCard, PackageSearch, CircleCheck, Hourglass, Layers, Flame, CalendarX2, CalendarClock, MailQuestion, ClipboardCheck, Copy, Check, Radar } from "lucide-react";
import { useStore, type Fair, type Priority, daysUntil, fmtDate, deadlineTone, toneClasses, isThisWeek, actions } from "@/lib/store";
import { readinessSummary } from "@/lib/readiness";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — CCM Feira Control" }] }),
  component: Dashboard,
});

// ============ Pendency model ============
type PendencyKind = "Checklist" | "Contrato" | "Pagamento" | "Credencial" | "Produto" | "Material";

interface Pendency {
  key: string;
  kind: PendencyKind;
  fairId: string;
  fairName: string;
  description: string;
  responsible?: string;
  deadline?: string;
  status: string;
  priority?: Priority;
  completed: boolean;
  // action to mark completed (only for items that support it)
  onComplete?: () => void;
}

function priorityRank(p?: Priority) {
  return p === "Urgente" ? 0 : p === "Alta" ? 1 : p === "Média" ? 2 : p === "Baixa" ? 3 : 2;
}

function collectPendencies(fairs: Fair[]): Pendency[] {
  const p: Pendency[] = [];
  for (const f of fairs) {
    // Effective deadline for items without their own date: fair.startDate
    const fallback = f.startDate;

    // Checklist
    for (const c of f.checklist) {
      const completed = c.status === "Concluído" || c.status === "Não se aplica";
      if (completed) continue;
      p.push({
        key: `chk-${f.id}-${c.id}`,
        kind: "Checklist",
        fairId: f.id, fairName: f.name,
        description: c.title,
        responsible: c.responsible,
        deadline: c.deadline,
        priority: c.priority,
        status: c.status,
        completed: false,
        onComplete: () => actions.updateChild(f.id, "checklist", list => list.map(i => i.id === c.id ? { ...i, status: "Concluído" as const } : i)),
      });
    }
    // Documentos (contratos)
    for (const d of f.documents) {
      const completed = d.status === "Assinado" || d.status === "Arquivado" || d.status === "Cancelado";
      if (completed) continue;
      p.push({
        key: `doc-${f.id}-${d.id}`,
        kind: "Contrato",
        fairId: f.id, fairName: f.name,
        description: `${d.type}: ${d.name}`,
        deadline: d.receivedAt ?? fallback,
        status: d.status,
        priority: d.type === "Contrato" ? "Alta" : undefined,
        completed: false,
        onComplete: () => actions.updateChild(f.id, "documents", list => list.map(i => i.id === d.id ? { ...i, status: "Assinado" as const } : i)),
      });
    }
    // Pagamentos
    for (const c of f.costs) {
      const completed = c.status === "Pago" || c.status === "Cancelado";
      if (completed) continue;
      p.push({
        key: `cost-${f.id}-${c.id}`,
        kind: "Pagamento",
        fairId: f.id, fairName: f.name,
        description: `${c.category}: ${c.description}`,
        deadline: c.dueDate ?? fallback,
        status: c.status,
        priority: c.status === "Aguardando pagamento" ? "Alta" : undefined,
        completed: false,
        onComplete: () => actions.updateChild(f.id, "costs", list => list.map(i => i.id === c.id ? { ...i, status: "Pago" as const } : i)),
      });
    }
    // Credenciais
    for (const c of f.credentials) {
      const completed = c.status === "Enviada ao participante" || c.status === "Recebida";
      if (completed) continue;
      p.push({
        key: `cred-${f.id}-${c.id}`,
        kind: "Credencial",
        fairId: f.id, fairName: f.name,
        description: `Credencial: ${c.name}${c.company ? ` (${c.company})` : ""}`,
        deadline: c.sentAt ?? fallback,
        status: c.status,
        priority: "Alta",
        completed: false,
        onComplete: () => actions.updateChild(f.id, "credentials", list => list.map(i => i.id === c.id ? { ...i, status: "Enviada ao participante" as const } : i)),
      });
    }
    // Produtos
    for (const pr of f.products) {
      if (pr.logisticStatus === "Recebido no evento" || pr.logisticStatus === "Retornou") continue;
      if (pr.logisticStatus !== "A definir" && pr.logisticStatus !== "Separar" && pr.logisticStatus !== "Pendente retorno") continue;
      p.push({
        key: `prod-${f.id}-${pr.id}`,
        kind: "Produto",
        fairId: f.id, fairName: f.name,
        description: `Produto: ${pr.description}`,
        responsible: pr.responsible,
        deadline: fallback,
        status: pr.logisticStatus,
        completed: false,
        onComplete: () => actions.updateChild(f.id, "products", list => list.map(i => i.id === pr.id ? { ...i, logisticStatus: "Separado" as const } : i)),
      });
    }
    // Materiais
    for (const m of f.materials) {
      const completed = m.status === "Retornou" || m.status === "Recebido no evento" || m.status === "Separado";
      if (completed) continue;
      p.push({
        key: `mat-${f.id}-${m.id}`,
        kind: "Material",
        fairId: f.id, fairName: f.name,
        description: `${m.category}: ${m.item}`,
        responsible: m.responsible,
        deadline: fallback,
        status: m.status,
        completed: false,
        onComplete: () => actions.updateChild(f.id, "materials", list => list.map(i => i.id === m.id ? { ...i, status: "Separado" as const } : i)),
      });
    }
  }
  // Sort: overdue/urgent first, then by nearest deadline, then priority
  return p.sort((a, b) => {
    const da = daysUntil(a.deadline);
    const db = daysUntil(b.deadline);
    // items without deadline go last unless urgent
    const va = da == null ? 9999 : da;
    const vb = db == null ? 9999 : db;
    if (va !== vb) return va - vb;
    return priorityRank(a.priority) - priorityRank(b.priority);
  });
}

function isCritical(p: Pendency): boolean {
  const d = daysUntil(p.deadline);
  if (d != null && d <= 3) return true;
  if (p.priority === "Urgente") return true;
  if (p.kind === "Credencial" || p.kind === "Contrato" || p.kind === "Pagamento") return true;
  return false;
}

// ============ Component ============
function Dashboard() {
  const fairs = useStore(s => s.fairs);
  const pendencies = useMemo(() => collectPendencies(fairs), [fairs]);

  const [filter, setFilter] = useState<"all" | "critical" | "overdue" | "week" | "noDeadline" | "urgent">("all");
  const [responsibleFilter, setResponsibleFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [summaryOpen, setSummaryOpen] = useState(false);

  const stats = useMemo(() => {
    const contractsPending = pendencies.filter(p => p.kind === "Contrato").length;
    const paymentsPending = pendencies.filter(p => p.kind === "Pagamento").length;
    const credentialsPending = pendencies.filter(p => p.kind === "Credencial").length;
    const productsToPick = pendencies.filter(p => p.kind === "Produto").length;
    const materialsPending = pendencies.filter(p => p.kind === "Material").length;
    const overdue = pendencies.filter(p => { const d = daysUntil(p.deadline); return d != null && d < 0; }).length;
    const noDeadline = pendencies.filter(p => !p.deadline).length;
    const urgent = pendencies.filter(p => p.priority === "Urgente").length;
    return { contractsPending, paymentsPending, credentialsPending, productsToPick, materialsPending, overdue, noDeadline, urgent };
  }, [pendencies]);

  const fairStats = useMemo(() => {
    const total = fairs.length;
    const inPrep = fairs.filter(f => f.status === "Em preparação").length;
    const confirmed = fairs.filter(f => f.status === "Confirmada").length;
    const done = fairs.filter(f => f.status === "Finalizada").length;
    return { total, inPrep, confirmed, done };
  }, [fairs]);

  const responsibles = useMemo(() => {
    const set = new Set<string>();
    pendencies.forEach(p => { if (p.responsible) set.add(p.responsible); });
    return Array.from(set).sort();
  }, [pendencies]);

  const filtered = useMemo(() => {
    return pendencies.filter(p => {
      if (responsibleFilter !== "all" && p.responsible !== responsibleFilter) return false;
      if (kindFilter !== "all" && p.kind !== kindFilter) return false;
      if (filter === "critical" && !isCritical(p)) return false;
      if (filter === "overdue") { const d = daysUntil(p.deadline); if (!(d != null && d < 0)) return false; }
      if (filter === "week") { const d = daysUntil(p.deadline); if (!(d != null && d >= 0 && d <= 7)) return false; }
      if (filter === "noDeadline" && p.deadline) return false;
      if (filter === "urgent" && p.priority !== "Urgente") return false;
      return true;
    });
  }, [pendencies, filter, responsibleFilter, kindFilter]);

  const cards: Array<{ label: string; value: number; icon: typeof Layers; tone: string; onClick?: () => void }> = [
    { label: "Total de feiras", value: fairStats.total, icon: Layers, tone: "primary" },
    { label: "Em preparação", value: fairStats.inPrep, icon: Hourglass, tone: "info" },
    { label: "Confirmadas", value: fairStats.confirmed, icon: CalendarCheck2, tone: "info" },
    { label: "Finalizadas", value: fairStats.done, icon: CircleCheck, tone: "success" },
    { label: "Tarefas vencidas", value: stats.overdue, icon: CalendarX2, tone: "destructive", onClick: () => { setFilter("overdue"); scrollToList(); } },
    { label: "Tarefas urgentes", value: stats.urgent, icon: Flame, tone: "destructive", onClick: () => { setFilter("urgent"); scrollToList(); } },
    { label: "Sem prazo definido", value: stats.noDeadline, icon: MailQuestion, tone: "warning", onClick: () => { setFilter("noDeadline"); scrollToList(); } },
    { label: "Contratos pendentes", value: stats.contractsPending, icon: FileWarning, tone: "warning", onClick: () => { setKindFilter("Contrato"); setFilter("all"); scrollToList(); } },
    { label: "Pagamentos pendentes", value: stats.paymentsPending, icon: CreditCard, tone: "warning", onClick: () => { setKindFilter("Pagamento"); setFilter("all"); scrollToList(); } },
    { label: "Credenciais pendentes", value: stats.credentialsPending, icon: IdCard, tone: "warning", onClick: () => { setKindFilter("Credencial"); setFilter("all"); scrollToList(); } },
    { label: "Produtos a separar", value: stats.productsToPick, icon: PackageSearch, tone: "primary", onClick: () => { setKindFilter("Produto"); setFilter("all"); scrollToList(); } },
    { label: "Materiais pendentes", value: stats.materialsPending, icon: ClipboardCheck, tone: "primary", onClick: () => { setKindFilter("Material"); setFilter("all"); scrollToList(); } },
  ];

  const toneCls: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning-foreground bg-warning/15",
    info: "text-info bg-info/10",
    destructive: "text-destructive bg-destructive/10",
  };

  function scrollToList() {
    setTimeout(() => document.getElementById("pendencias-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão geral das feiras e pendências do time de marketing.</p>
        </div>
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/5"><CalendarClock className="h-4 w-4" /> Resumo da Semana</Button>
          </DialogTrigger>
          <WeeklySummaryDialog fairs={fairs} pendencies={pendencies} />
        </Dialog>
      </div>

      {/* Radar Diário */}
      <DailyRadar fairs={fairs} pendencies={pendencies} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {cards.map((c, i) => {
          const Comp = c.onClick ? "button" : "div";
          return (
            <Comp
              key={c.label}
              onClick={c.onClick}
              className="ccm-rise text-left"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <Card className={`overflow-hidden border-border/70 h-full ccm-lift ${c.onClick ? "cursor-pointer" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground truncate">{c.label}</p>
                      <p className="mt-1.5 text-2xl font-bold tabular-nums"><CountUp value={c.value} /></p>
                    </div>
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md transition-transform duration-200 group-hover:scale-105 ${toneCls[c.tone]}`}>
                      <c.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Comp>
          );
        })}
      </div>


      {/* Filters + list */}
      <section id="pendencias-list">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Próximos Prazos</h2>
            <Badge variant="outline" className="ml-1">{filtered.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip label="Todos" active={filter === "all" && kindFilter === "all"} onClick={() => { setFilter("all"); setKindFilter("all"); }} />
            <FilterChip label="Críticas" active={filter === "critical"} tone="destructive" onClick={() => setFilter("critical")} />
            <FilterChip label="Vencidas" active={filter === "overdue"} tone="destructive" onClick={() => setFilter("overdue")} />
            <FilterChip label="Esta semana" active={filter === "week"} tone="info" onClick={() => setFilter("week")} />
            <FilterChip label="Sem prazo" active={filter === "noDeadline"} tone="warning" onClick={() => setFilter("noDeadline")} />
            <FilterChip label="Urgentes" active={filter === "urgent"} tone="destructive" onClick={() => setFilter("urgent")} />
          </div>
        </div>

        <Card className="mb-3">
          <CardContent className="p-3 grid gap-2 sm:grid-cols-2">
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {["Checklist", "Contrato", "Pagamento", "Credencial", "Produto", "Material"].map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {responsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {pendencies.length === 0 ? "Nenhuma pendência registrada. Cadastre uma feira para começar." : "Nenhuma pendência para esse filtro."}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.slice(0, 60).map(p => <PendencyRow key={p.key} p={p} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Legenda de cores */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <LegendDot cls="bg-destructive" label="Vencido" />
        <LegendDot cls="bg-warning" label="Vence em até 3 dias" />
        <LegendDot cls="bg-info" label="Vence em até 7 dias" />
        <LegendDot cls="bg-orange-500" label="Sem prazo definido" />
        <LegendDot cls="bg-success" label="Concluído" />
      </div>
    </div>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${cls}`} />{label}</span>;
}

// ============ Radar Diário ============
function DailyRadar({ fairs, pendencies }: { fairs: Fair[]; pendencies: Pendency[] }) {
  const blocks = useMemo(() => {
    const overdue = pendencies.filter(p => { const d = daysUntil(p.deadline); return d != null && d < 0; });
    const urgent = pendencies.filter(p => p.priority === "Urgente" && !overdue.includes(p));
    const critical = [...overdue, ...urgent];
    const today = pendencies.filter(p => daysUntil(p.deadline) === 0);
    const next3 = pendencies.filter(p => { const d = daysUntil(p.deadline); return d != null && d >= 1 && d <= 3; });
    const noDeadline = pendencies.filter(p => !p.deadline);

    const operation: Array<{ key: string; fairId: string; fairName: string; description: string }> = [];
    for (const f of fairs) {
      if (f.status === "Finalizada" || f.status === "Cancelada") continue;
      const s = readinessSummary(f);
      const days = daysUntil(f.startDate);
      const near = days != null && days <= 30;
      if (near && s.pendingShipping.length > 0) {
        operation.push({
          key: `ship-${f.id}`, fairId: f.id, fairName: f.name,
          description: `${s.pendingShipping.length} pendência(s) antes do envio dos produtos`,
        });
      }
      if (near && s.pendingRequired.length > 0) {
        operation.push({
          key: `ready-${f.id}`, fairId: f.id, fairName: f.name,
          description: `Feira não liberada: ${s.pendingRequired.length} item(ns) obrigatório(s) em aberto`,
        });
      }
      if (days != null && days >= 0 && days <= 7) {
        operation.push({
          key: `start-${f.id}`, fairId: f.id, fairName: f.name,
          description: days === 0 ? "Começa hoje" : `Começa em ${days} dia(s) — ${fmtDate(f.startDate)}`,
        });
      }
    }
    return { critical, today, next3, noDeadline, operation };
  }, [fairs, pendencies]);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Radar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Radar Diário</h2>
        <span className="text-xs text-muted-foreground">O que precisa da sua atenção hoje</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <RadarBlock title="Crítico" tone="destructive" items={blocks.critical} empty="Nada crítico agora." />
        <RadarBlock title="Hoje" tone="warning" items={blocks.today} empty="Nenhum prazo para hoje." />
        <RadarBlock title="Próximos 3 dias" tone="info" items={blocks.next3} empty="Nenhum prazo próximo." />
        <RadarBlock title="Sem prazo" tone="muted" items={blocks.noDeadline} empty="Todos os itens têm prazo." />
        <RadarBlock title="Operação" tone="primary" items={blocks.operation} empty="Nenhum alerta operacional." />
      </div>
    </section>
  );
}

const radarTone: Record<string, { head: string; badge: string }> = {
  destructive: { head: "border-destructive/40 bg-destructive/10 text-destructive", badge: "bg-destructive text-destructive-foreground" },
  warning: { head: "border-warning/50 bg-warning/15 text-warning-foreground", badge: "bg-warning text-warning-foreground" },
  info: { head: "border-info/40 bg-info/10 text-info", badge: "bg-info text-info-foreground" },
  muted: { head: "border-border bg-muted/50 text-muted-foreground", badge: "bg-muted-foreground text-background" },
  primary: { head: "border-primary/40 bg-primary/10 text-primary", badge: "bg-primary text-primary-foreground" },
};

function RadarBlock({
  title, tone, items, empty,
}: {
  title: string;
  tone: keyof typeof radarTone | string;
  items: Array<{ key: string; fairId: string; fairName: string; description: string; deadline?: string }>;
  empty: string;
}) {
  const t = radarTone[tone] ?? radarTone['primary']!;
  return (
    <Card className="overflow-hidden">
      <div className={`flex items-center justify-between border-b px-3 py-2 ${t.head}`}>
        <span className="text-sm font-semibold">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${t.badge}`}>{items.length}</span>
      </div>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {items.slice(0, 6).map(i => (
              <li key={i.key}>
                <Link to="/fairs/$fairId" params={{ fairId: i.fairId }} className="block px-3 py-2 hover:bg-muted/60">
                  <p className="text-xs font-medium leading-snug line-clamp-2">{i.description}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                    {i.fairName}{i.deadline ? ` · ${fmtDate(i.deadline)}` : ""}
                  </p>
                </Link>
              </li>
            ))}
            {items.length > 6 && (
              <li className="px-3 py-2 text-[11px] text-muted-foreground">+{items.length - 6} item(ns)</li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({ label, active, onClick, tone }: { label: string; active: boolean; onClick: () => void; tone?: string }) {
  const activeCls = tone === "destructive" ? "bg-destructive text-destructive-foreground border-destructive" :
                    tone === "warning"     ? "bg-warning text-warning-foreground border-warning" :
                    tone === "info"        ? "bg-info text-info-foreground border-info" :
                                             "bg-primary text-primary-foreground border-primary";
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? activeCls : "bg-background hover:bg-muted"}`}
    >{label}</button>
  );
}

function PendencyRow({ p }: { p: Pendency }) {
  const tone = deadlineTone(p.deadline, false);
  const t = toneClasses[tone];
  const d = daysUntil(p.deadline);
  const relLabel = d == null ? "Sem prazo" : d < 0 ? `Venceu há ${-d}d` : d === 0 ? "Vence hoje" : `Faltam ${d}d`;
  return (
    <div className={`grid gap-2 p-3 sm:grid-cols-[1.5fr_2fr_120px_150px_130px_100px_auto] items-center hover:bg-muted/30 ${t.row}`}>
      <div className="min-w-0">
        <Link to="/fairs/$fairId" params={{ fairId: p.fairId }} className="block truncate text-sm font-semibold text-primary hover:underline">
          {p.fairName || "Sem nome"}
        </Link>
        <div className="mt-0.5 text-xs text-muted-foreground">{p.kind}</div>
      </div>
      <div className="min-w-0 text-sm truncate" title={p.description}>{p.description}</div>
      <div className="text-xs text-muted-foreground truncate">{p.responsible || "—"}</div>
      <div className={`text-sm ${t.text}`}>
        <div>{fmtDate(p.deadline)}</div>
        <div className="text-xs opacity-80">{relLabel}</div>
      </div>
      <div><StatusBadge status={p.status} /></div>
      <div>
        {p.priority ? (
          <Badge variant="outline" className={priorityClass(p.priority)}>{p.priority}</Badge>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </div>
      <div className="flex justify-end">
        {p.onComplete && (
          <Button size="sm" variant="outline" onClick={() => { p.onComplete!(); toast.success("Pendência concluída"); }} className="h-8 text-success border-success/40 hover:bg-success/10">
            <Check className="h-3.5 w-3.5" /> Concluir
          </Button>
        )}
      </div>
    </div>
  );
}

function priorityClass(p: Priority): string {
  switch (p) {
    case "Urgente": return "bg-destructive/15 text-destructive border-destructive/50 font-semibold";
    case "Alta":    return "bg-warning/20 text-warning-foreground border-warning/50";
    case "Média":   return "bg-info/15 text-info border-info/40";
    case "Baixa":   return "bg-muted text-muted-foreground border-border";
  }
}

// ============ Weekly summary ============
function WeeklySummaryDialog({ fairs, pendencies }: { fairs: Fair[]; pendencies: Pendency[] }) {
  const overdue = pendencies.filter(p => { const d = daysUntil(p.deadline); return d != null && d < 0; });
  const thisWeek = pendencies.filter(p => isThisWeek(p.deadline));
  const urgent = pendencies.filter(p => p.priority === "Urgente");
  const noResp = pendencies.filter(p => !p.responsible);
  const noDeadline = pendencies.filter(p => !p.deadline);

  // Completed this week: scan checklist for items marked Concluído — we don't have a completion date,
  // so approximate using items with status Concluído and deadline this week.
  const completedThisWeek: string[] = [];
  fairs.forEach(f => {
    f.checklist.forEach(c => {
      if (c.status === "Concluído" && isThisWeek(c.deadline)) {
        completedThisWeek.push(`${f.name}: ${c.title}`);
      }
    });
  });

  const text = useMemo(() => {
    const lines: string[] = [];
    lines.push(`*Resumo da Semana — CCM Feira Control*`);
    lines.push(new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }));
    lines.push("");

    const section = (title: string, items: Pendency[]) => {
      lines.push(`*${title}* (${items.length})`);
      if (!items.length) { lines.push("— nenhum"); }
      else items.slice(0, 15).forEach(p => {
        lines.push(`• [${p.fairName}] ${p.description}${p.deadline ? ` — ${fmtDate(p.deadline)}` : ""}${p.responsible ? ` — ${p.responsible}` : ""}`);
      });
      lines.push("");
    };

    section("Pendências vencidas", overdue);
    section("Vencem nesta semana", thisWeek);
    section("Urgentes", urgent);
    section("Sem responsável", noResp);
    section("Sem prazo definido", noDeadline);

    lines.push(`*Concluídas nesta semana* (${completedThisWeek.length})`);
    if (!completedThisWeek.length) lines.push("— nenhuma");
    else completedThisWeek.slice(0, 15).forEach(t => lines.push(`• ${t}`));

    return lines.join("\n");
  }, [overdue, thisWeek, urgent, noResp, noDeadline, completedThisWeek]);

  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Resumo copiado. Cole no WhatsApp ou e-mail.");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Resumo da Semana</DialogTitle></DialogHeader>
      <Textarea value={text} readOnly rows={18} className="font-mono text-xs" />
      <DialogFooter>
        <Button onClick={copy} className="bg-primary hover:bg-primary-dark">
          {copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar resumo</>}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
