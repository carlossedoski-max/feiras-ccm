import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarCheck2, ClipboardList, FileWarning, CreditCard, IdCard, PackageSearch, AlertTriangle, CircleCheck, Hourglass, Layers } from "lucide-react";
import { useStore, type Fair, daysUntil, fmtDate } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — CCM Feira Control" }] }),
  component: Dashboard,
});

interface Pendency { fairId: string; fairName: string; description: string; responsible?: string; deadline?: string; status: string; }

function collectPendencies(fairs: Fair[]): Pendency[] {
  const p: Pendency[] = [];
  for (const f of fairs) {
    for (const c of f.checklist) {
      if (c.status === "Pendente" || c.status === "Em andamento" || c.status === "Atrasado") {
        p.push({ fairId: f.id, fairName: f.name, description: c.title, responsible: c.responsible, deadline: c.deadline, status: c.status });
      }
    }
    for (const c of f.costs) {
      if (c.status === "Aguardando pagamento" || c.status === "Aguardando aprovação" || c.status === "Aguardando orçamento") {
        p.push({ fairId: f.id, fairName: f.name, description: `Pagamento: ${c.description}`, deadline: c.dueDate, status: c.status });
      }
    }
    for (const d of f.documents) {
      if (d.status === "Pendente" || d.status === "Enviado para assinatura") {
        p.push({ fairId: f.id, fairName: f.name, description: `Documento: ${d.name}`, deadline: d.receivedAt, status: d.status });
      }
    }
  }
  return p.sort((a, b) => {
    const da = daysUntil(a.deadline) ?? 9999;
    const db = daysUntil(b.deadline) ?? 9999;
    return da - db;
  }).slice(0, 12);
}

function Dashboard() {
  const fairs = useStore(s => s.fairs);
  const stats = useMemo(() => {
    const total = fairs.length;
    const inPrep = fairs.filter(f => f.status === "Em preparação").length;
    const confirmed = fairs.filter(f => f.status === "Confirmada").length;
    const done = fairs.filter(f => f.status === "Finalizada").length;
    const contractsPending = fairs.reduce((n, f) => n + f.documents.filter(d => d.type === "Contrato" && (d.status === "Pendente" || d.status === "Enviado para assinatura")).length, 0);
    const paymentsPending = fairs.reduce((n, f) => n + f.costs.filter(c => c.status === "Aguardando pagamento" || c.status === "Aguardando aprovação").length, 0);
    const credentialsPending = fairs.reduce((n, f) => n + f.credentials.filter(c => c.status === "Pendente" || c.status === "Solicitada").length, 0);
    const productsToPick = fairs.reduce((n, f) => n + f.products.filter(p => p.logisticStatus === "Separar" || p.logisticStatus === "A definir").length, 0);
    const overdue = fairs.reduce((n, f) => n + f.checklist.filter(c => c.status !== "Concluído" && c.status !== "Não se aplica" && (daysUntil(c.deadline) ?? 1) < 0).length, 0);
    return { total, inPrep, confirmed, done, contractsPending, paymentsPending, credentialsPending, productsToPick, overdue };
  }, [fairs]);

  const pendencies = useMemo(() => collectPendencies(fairs), [fairs]);

  const cards = [
    { label: "Total de feiras", value: stats.total, icon: Layers, tone: "primary" },
    { label: "Em preparação", value: stats.inPrep, icon: Hourglass, tone: "info" },
    { label: "Confirmadas", value: stats.confirmed, icon: CalendarCheck2, tone: "info" },
    { label: "Finalizadas", value: stats.done, icon: CircleCheck, tone: "success" },
    { label: "Contratos pendentes", value: stats.contractsPending, icon: FileWarning, tone: "warning" },
    { label: "Pagamentos pendentes", value: stats.paymentsPending, icon: CreditCard, tone: "warning" },
    { label: "Credenciais pendentes", value: stats.credentialsPending, icon: IdCard, tone: "warning" },
    { label: "Produtos a separar", value: stats.productsToPick, icon: PackageSearch, tone: "primary" },
    { label: "Tarefas atrasadas", value: stats.overdue, icon: AlertTriangle, tone: "destructive" },
  ];

  const toneClasses: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning-foreground bg-warning/15",
    info: "text-info bg-info/10",
    destructive: "text-destructive bg-destructive/10",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral das feiras e pendências do time de marketing.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(c => (
          <Card key={c.label} className="overflow-hidden border-border/70">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{c.label}</p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums">{c.value}</p>
                </div>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${toneClasses[c.tone]}`}>
                  <c.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Próximas pendências</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            {pendencies.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma pendência registrada. Cadastre uma feira para começar.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Feira</th>
                      <th className="px-4 py-2.5 font-semibold">Pendência</th>
                      <th className="px-4 py-2.5 font-semibold">Responsável</th>
                      <th className="px-4 py-2.5 font-semibold">Prazo</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendencies.map((p, i) => {
                      const d = daysUntil(p.deadline);
                      const overdue = d != null && d < 0;
                      return (
                        <tr key={i} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-2.5">
                            <Link to="/fairs/$fairId" params={{ fairId: p.fairId }} className="font-medium text-primary hover:underline">{p.fairName || "Sem nome"}</Link>
                          </td>
                          <td className="px-4 py-2.5">{p.description}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.responsible || "—"}</td>
                          <td className={`px-4 py-2.5 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            {fmtDate(p.deadline)}{overdue && " (venceu)"}
                          </td>
                          <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
