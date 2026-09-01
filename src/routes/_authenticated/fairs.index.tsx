import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Download, MapPin, Calendar } from "lucide-react";
import { useStore, actions, createEmptyFair, FAIR_STATUSES, fmtDate, fmtMoney, exportCSV, type FairStatus } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import { EmptyState, ProgressBar } from "@/components/ccm-ui";

export const Route = createFileRoute("/_authenticated/fairs/")({
  head: () => ({ meta: [{ title: "Feiras e Eventos — CCM Feira Control" }] }),
  component: FairsList,
});

function FairsList() {
  const fairs = useStore(s => s.fairs);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    return fairs.filter(f => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (q && !`${f.name} ${f.city} ${f.state}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [fairs, q, statusFilter]);

  function handleExport() {
    if (!filtered.length) { toast.error("Nada para exportar"); return; }
    exportCSV("feiras.csv", filtered.map(f => ({
      Nome: f.name, Ano: f.year, Cidade: f.city, UF: f.state, Local: f.venue ?? "",
      Início: f.startDate ?? "", Fim: f.endDate ?? "", Status: f.status,
      Responsável: f.responsible ?? "", Comercial: f.commercial ?? "",
      Área: f.areaSize ?? "", "Valor do espaço": f.spaceValue ?? "",
    })));
  }

  return (
    <div className="ccm-fade space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Feiras e Eventos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ficha completa por feira: contratos, taxas, credenciais, produtos e mais.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" /> Exportar CSV</Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-dark"><Plus className="h-4 w-4" /> Nova feira</Button></DialogTrigger>
            <NewFairDialog onCreated={(id) => { setOpenNew(false); navigate({ to: "/fairs/$fairId", params: { fairId: id } }); }} />
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome, cidade ou UF..." value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {FAIR_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="ccm-lift"><CardContent className="p-0">
          <EmptyState title={fairs.length === 0 ? "Nenhuma feira cadastrada" : "Nenhuma feira encontrada"} description={fairs.length === 0 ? "Cadastre a primeira feira para organizar prazos, documentos e equipe." : "Ajuste a busca ou os filtros para encontrar uma feira."} action={<Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Nova feira</Button>} />
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f, i) => {
            const pend = f.checklist.filter(c => c.status !== "Concluído" && c.status !== "Não se aplica").length;
            const done = f.checklist.filter(c => c.status === "Concluído").length;
            const pct = f.checklist.length ? Math.round((done / f.checklist.length) * 100) : 0;
            return (
              <Card key={f.id} className="ccm-rise ccm-lift group relative overflow-hidden" style={{ animationDelay: `${i * 55}ms` }}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to="/fairs/$fairId" params={{ fairId: f.id }} className="block truncate text-base font-semibold hover:text-primary">{f.name || "Sem nome"}</Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{f.city || "—"}/{f.state || "—"}</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(f.startDate)}</span>
                        <span>{f.year}</span>
                      </div>
                    </div>
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-muted-foreground">Valor</div><div className="mt-0.5 font-semibold">{fmtMoney(f.spaceValue)}</div></div>
                    <div><div className="text-muted-foreground">Checklist</div><div className="mt-0.5 font-semibold">{pct}%</div></div>
                    <div><div className="text-muted-foreground">Pendências</div><div className="mt-0.5 font-semibold text-primary">{pend}</div></div>
                  </div>
                  <ProgressBar value={pct} className="mt-4 h-1.5" />
                  <div className="mt-4 flex items-center justify-between">
                    <Link to="/fairs/$fairId" params={{ fairId: f.id }} className="text-sm font-medium text-primary hover:underline">Abrir ficha →</Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir feira?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os dados vinculados à feira "{f.name}" serão removidos.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { actions.deleteFair(f.id); toast.success("Feira excluída"); }} className="bg-destructive hover:bg-primary-dark">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewFairDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: "", year: new Date().getFullYear(), city: "", state: "", venue: "", startDate: "", endDate: "", status: "Em análise" as FairStatus, responsible: "", commercial: "", areaSize: "", spaceValue: "", notes: "" });

  function submit() {
    if (!form.name.trim()) { toast.error("Informe o nome da feira"); return; }
    const fair = createEmptyFair({
      name: form.name.trim(), year: Number(form.year) || new Date().getFullYear(),
      city: form.city, state: form.state, venue: form.venue,
      startDate: form.startDate || undefined, endDate: form.endDate || undefined,
      status: form.status, responsible: form.responsible, commercial: form.commercial,
      areaSize: form.areaSize, spaceValue: form.spaceValue ? Number(form.spaceValue) : undefined,
      notes: form.notes,
    });
    actions.addFair(fair);
    toast.success("Feira criada");
    onCreated(fair.id);
  }

  const set = (k: keyof typeof form) => (v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Nova feira</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Nome da feira *</Label><Input value={form.name} onChange={e => set("name")(e.target.value)} /></div>
        <div><Label>Ano</Label><Input type="number" value={form.year} onChange={e => set("year")(e.target.value)} /></div>
        <div><Label>Status</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as FairStatus }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FAIR_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Cidade</Label><Input value={form.city} onChange={e => set("city")(e.target.value)} /></div>
        <div><Label>Estado (UF)</Label><Input maxLength={2} value={form.state} onChange={e => set("state")(e.target.value.toUpperCase())} /></div>
        <div className="sm:col-span-2"><Label>Local do evento</Label><Input value={form.venue} onChange={e => set("venue")(e.target.value)} /></div>
        <div><Label>Data inicial</Label><Input type="date" value={form.startDate} onChange={e => set("startDate")(e.target.value)} /></div>
        <div><Label>Data final</Label><Input type="date" value={form.endDate} onChange={e => set("endDate")(e.target.value)} /></div>
        <div><Label>Responsável interno</Label><Input value={form.responsible} onChange={e => set("responsible")(e.target.value)} /></div>
        <div><Label>Comercial envolvido</Label><Input value={form.commercial} onChange={e => set("commercial")(e.target.value)} /></div>
        <div><Label>Tamanho da área</Label><Input placeholder="ex: 20m²" value={form.areaSize} onChange={e => set("areaSize")(e.target.value)} /></div>
        <div><Label>Valor do espaço (R$)</Label><Input type="number" value={form.spaceValue} onChange={e => set("spaceValue")(e.target.value)} /></div>
        <div className="sm:col-span-2"><Label>Observações gerais</Label><Textarea rows={3} value={form.notes} onChange={e => set("notes")(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button onClick={submit} className="bg-primary hover:bg-primary-dark">Criar feira</Button>
      </DialogFooter>
    </DialogContent>
  );
}
