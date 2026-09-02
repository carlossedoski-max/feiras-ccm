import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Download, FileText, Check } from "lucide-react";
import {
  useStore, actions, uid, fmtDate, fmtMoney, exportCSV, deadlineTone, toneClasses,
  FAIR_STATUSES, CHECKLIST_STATUSES,
  COST_CATEGORIES, PAYMENT_STATUSES, CREDENTIAL_TYPES, CREDENTIAL_STATUSES,
  EXPO_TYPES, LOGISTIC_STATUSES, MATERIAL_CATEGORIES, MATERIAL_STATUSES, SUPPLIER_SERVICES,
  PRIORITIES, RESPONSIBLE_SUGGESTIONS,
  type Fair, type ChecklistItem, type ChecklistPhase, type CostItem,

  type CredentialItem, type ProductItem, type MaterialItem, type SupplierItem, type FairStatus, type Priority,
} from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/status-badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ManualTab } from "@/components/manual-tab";
import { FairDocumentsTab } from "@/components/fair-documents-tab";
import { BrushDivider, ProgressBar } from "@/components/ccm-ui";

import { ReadinessTab } from "@/components/readiness-tab";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchSuppliers, type Supplier as AuxSupplier } from "@/lib/suppliers";

export const Route = createFileRoute("/_authenticated/fairs/$fairId")({
  loader: ({ params }) => ({ fairId: params.fairId }),
  head: () => ({ meta: [{ title: "Ficha da feira — CCM Feira Control" }] }),
  component: FairDetail,
  notFoundComponent: () => (
    <div className="text-center py-16"><p className="text-muted-foreground">Feira não encontrada.</p>
    <Link to="/fairs" className="mt-4 inline-block text-primary hover:underline">Voltar para lista</Link></div>
  ),
});

function FairDetail() {
  const { fairId } = Route.useLoaderData();
  const fair = useStore(s => s.fairs.find(f => f.id === fairId));
  const navigate = useNavigate();
  if (!fair) throw notFound();

  const update = (patch: Partial<Fair>) => actions.updateFair(fair.id, patch);

  return (
    <div className="ccm-fade space-y-6">
      <div className="ccm-hinomaru flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border/60 p-4 sm:p-5">
        <div className="min-w-0">
          <Link to="/fairs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl truncate">{fair.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{fair.city}/{fair.state} · {fair.year}</span>
            <span>{fmtDate(fair.startDate)} – {fmtDate(fair.endDate)}</span>
            <StatusBadge status={fair.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={fair.status} onValueChange={v => update({ status: v as FairStatus })}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{FAIR_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /> Excluir</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Excluir feira?</AlertDialogTitle>
              <AlertDialogDescription>Todos os dados desta feira serão removidos. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive hover:bg-primary-dark" onClick={() => { actions.deleteFair(fair.id); toast.success("Feira excluída"); navigate({ to: "/fairs" }); }}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="inline-flex h-auto flex-nowrap border border-border/70 bg-card/80 p-1 shadow-sm">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="readiness">Feira pronta?</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="documents">Documentos da Feira</TabsTrigger>
            <TabsTrigger value="costs">Taxas e Custos</TabsTrigger>
            <TabsTrigger value="credentials">Credenciais</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="materials">Materiais e Brindes</TabsTrigger>
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
            <TabsTrigger value="manual">Manual do Expositor — IA</TabsTrigger>
            <TabsTrigger value="report">Relatório Pós-Feira</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="ccm-fade"><OverviewTab fair={fair} onUpdate={update} /></TabsContent>
        <TabsContent value="readiness" className="ccm-fade"><ReadinessTab fair={fair} /></TabsContent>
        <TabsContent value="checklist" className="ccm-fade"><ChecklistTab fair={fair} /></TabsContent>
        <TabsContent value="documents" className="ccm-fade"><FairDocumentsTab fair={fair} /></TabsContent>
        <TabsContent value="costs" className="ccm-fade"><CostsTab fair={fair} /></TabsContent>
        <TabsContent value="credentials" className="ccm-fade"><CredentialsTab fair={fair} /></TabsContent>
        <TabsContent value="products" className="ccm-fade"><ProductsTab fair={fair} /></TabsContent>
        <TabsContent value="materials" className="ccm-fade"><MaterialsTab fair={fair} /></TabsContent>
        <TabsContent value="suppliers" className="ccm-fade"><SuppliersTab fair={fair} /></TabsContent>
        <TabsContent value="manual" className="ccm-fade"><ManualTab fair={fair} /></TabsContent>
        <TabsContent value="report" className="ccm-fade"><ReportTab fair={fair} /></TabsContent>

        <BrushDivider className="!my-0" />
      </Tabs>
    </div>
  );
}

// ============ VISÃO GERAL ============
const TIMELINE_STEPS: FairStatus[] = ["Em análise", "Confirmada", "Em preparação", "Em andamento", "Finalizada"];

function OverviewTab({ fair, onUpdate }: { fair: Fair; onUpdate: (p: Partial<Fair>) => void }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(fair);

  const closedTotal = fair.costs.reduce((s, c) => s + (c.closed || 0), 0);
  const done = fair.checklist.filter(c => c.status === "Concluído").length;
  const total = fair.checklist.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const pending = fair.checklist.filter(c => c.status !== "Concluído" && c.status !== "Não se aplica").length
    + fair.costs.filter(c => c.status !== "Pago" && c.status !== "Cancelado").length
    + fair.documents.filter(d => d.status !== "Assinado" && d.status !== "Arquivado" && d.status !== "Cancelado").length;

  const currentIndex = TIMELINE_STEPS.indexOf(fair.status);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Valor previsto" value={fmtMoney(fair.spaceValue)} />
        <StatCard label="Valor fechado" value={fmtMoney(closedTotal)} />
        <StatCard label="Pendências totais" value={String(pending)} tone="warning" />
        <StatCard label="Checklist concluído" value={`${pct}%`} tone="success" />
      </div>

      <Card className="ccm-lift">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">Linha do tempo</h3>
          <div className="flex items-center gap-1 overflow-x-auto">
            {TIMELINE_STEPS.map((step, i) => {
              const active = i <= currentIndex && currentIndex >= 0;
              return (
                <div key={step} className="flex items-center gap-1 flex-1 min-w-[120px]">
                  <div className={`flex-1 flex flex-col items-center text-center px-2`}>
                    <div className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
                    <div className={`mt-1.5 text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{step}</div>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < currentIndex ? "bg-primary" : "bg-muted"}`} />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="ccm-lift">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Informações da feira</h3>
            {edit ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setForm(fair); setEdit(false); }}>Cancelar</Button>
                <Button size="sm" className="bg-primary hover:bg-primary-dark" onClick={() => { onUpdate(form); setEdit(false); toast.success("Feira atualizada"); }}>Salvar</Button>
              </div>
            ) : <Button variant="outline" size="sm" onClick={() => { setForm(fair); setEdit(true); }}>Editar</Button>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" edit={edit} value={form.name} onChange={v => setForm({ ...form, name: v })} display={fair.name} />
            <Field label="Ano" edit={edit} value={String(form.year)} onChange={v => setForm({ ...form, year: Number(v) || fair.year })} display={String(fair.year)} type="number" />
            <Field label="Cidade" edit={edit} value={form.city} onChange={v => setForm({ ...form, city: v })} display={fair.city} />
            <Field label="Estado" edit={edit} value={form.state} onChange={v => setForm({ ...form, state: v.toUpperCase() })} display={fair.state} />
            <Field label="Local" edit={edit} value={form.venue ?? ""} onChange={v => setForm({ ...form, venue: v })} display={fair.venue || "—"} className="sm:col-span-2" />
            <Field label="Data inicial" edit={edit} type="date" value={form.startDate ?? ""} onChange={v => setForm({ ...form, startDate: v })} display={fmtDate(fair.startDate)} />
            <Field label="Data final" edit={edit} type="date" value={form.endDate ?? ""} onChange={v => setForm({ ...form, endDate: v })} display={fmtDate(fair.endDate)} />
            <Field label="Responsável interno" edit={edit} value={form.responsible ?? ""} onChange={v => setForm({ ...form, responsible: v })} display={fair.responsible || "—"} />
            <Field label="Comercial envolvido" edit={edit} value={form.commercial ?? ""} onChange={v => setForm({ ...form, commercial: v })} display={fair.commercial || "—"} />
            <Field label="Tamanho da área" edit={edit} value={form.areaSize ?? ""} onChange={v => setForm({ ...form, areaSize: v })} display={fair.areaSize || "—"} />
            <Field label="Valor do espaço (R$)" edit={edit} type="number" value={String(form.spaceValue ?? "")} onChange={v => setForm({ ...form, spaceValue: v ? Number(v) : undefined })} display={fmtMoney(fair.spaceValue)} />
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              {edit ? <Textarea rows={3} value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1" />
                : <p className="mt-1 text-sm whitespace-pre-wrap">{fair.notes || "—"}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-primary" : "text-foreground";
  return (
    <Card className="ccm-lift"><CardContent className="p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold ${toneCls}`}>{value}</div>
    </CardContent></Card>
  );
}

function Field({ label, value, onChange, edit, display, type = "text", className }: { label: string; value: string; onChange: (v: string) => void; edit: boolean; display: string; type?: string; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {edit ? <Input type={type} value={value} onChange={e => onChange(e.target.value)} className="mt-1" />
        : <div className="mt-1 text-sm font-medium">{display}</div>}
    </div>
  );
}

// ============ CHECKLIST ============
function ChecklistTab({ fair }: { fair: Fair }) {
  const phases: ChecklistPhase[] = ["Antes da feira", "Durante a feira", "Depois da feira"];
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");

  function updateItem(id: string, patch: Partial<ChecklistItem>) {
    actions.updateChild(fair.id, "checklist", list => list.map(i => i.id === id ? { ...i, ...patch } : i));
  }
  function removeItem(id: string) {
    actions.updateChild(fair.id, "checklist", list => list.filter(i => i.id !== id));
  }
  function addItem(phase: ChecklistPhase) {
    actions.updateChild(fair.id, "checklist", list => [...list, { id: uid(), phase, title: "Novo item", status: "Pendente", priority: "Média" }]);
  }

  const responsibles = Array.from(new Set(fair.checklist.map(i => i.responsible).filter((v): v is string => !!v))).sort();

  return (
    <div className="space-y-4">
      <Card className="ccm-lift"><CardContent className="p-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {CHECKLIST_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Prioridade</Label>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Responsável</Label>
          <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {responsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <datalist id="responsible-suggestions">
        {RESPONSIBLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
      </datalist>

      {phases.map(phase => {
        const items = fair.checklist.filter(i =>
          i.phase === phase
          && (statusFilter === "all" || i.status === statusFilter)
          && (priorityFilter === "all" || i.priority === priorityFilter)
          && (responsibleFilter === "all" || i.responsible === responsibleFilter)
        );
        const phaseAll = fair.checklist.filter(i => i.phase === phase);
        const phaseTotal = phaseAll.length;
        const phaseDone = phaseAll.filter(i => i.status === "Concluído" || i.status === "Não se aplica").length;
        const phasePct = phaseTotal ? Math.round((phaseDone / phaseTotal) * 100) : 0;
        return (
          <Card key={phase} className="ccm-rise ccm-lift overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
                <div className="min-w-[180px] flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{phase}</h3>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{phaseDone}/{phaseTotal} · {phasePct}%</span>
                  </div>
                  <ProgressBar value={phasePct} tone={phasePct === 100 ? "success" : "primary"} className="mt-2 h-1.5" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => addItem(phase)}><Plus className="h-4 w-4" /> Adicionar item</Button>
              </div>
              <div className="divide-y">
                {items.length === 0 && <div className="p-5 text-center text-sm text-muted-foreground">Nenhum item nesta etapa. Use “Adicionar item” para criar o próximo passo.</div>}
                {items.map(item => {
                  const done = item.status === "Concluído" || item.status === "Não se aplica";
                  const tone = deadlineTone(item.deadline, done);
                  const t = toneClasses[tone];
                  return (
                    <div key={item.id} className={`grid gap-2 p-4 sm:grid-cols-[minmax(0,2fr)_130px_150px_140px_120px_auto_auto] items-center ccm-row transition-opacity ${done ? "opacity-70" : ""} ${t.row}`}>
                      <Input value={item.title} onChange={e => updateItem(item.id, { title: e.target.value })} className={`font-medium transition-all ${done ? "text-muted-foreground line-through decoration-success/60" : ""}`} />
                      <Select value={item.status} onValueChange={v => updateItem(item.id, { status: v as ChecklistItem["status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CHECKLIST_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input
                        list="responsible-suggestions"
                        placeholder="Responsável"
                        value={item.responsible ?? ""}
                        onChange={e => updateItem(item.id, { responsible: e.target.value })}
                      />
                      <Input
                        type="date"
                        value={item.deadline ?? ""}
                        onChange={e => updateItem(item.id, { deadline: e.target.value })}
                        className={tone === "overdue" ? "border-destructive text-destructive" : tone === "noDeadline" && !done ? "border-orange-500" : ""}
                      />
                      <Select value={item.priority ?? "Média"} onValueChange={v => updateItem(item.id, { priority: v as Priority })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={done}
                        onClick={() => { updateItem(item.id, { status: "Concluído" }); toast.success("Tarefa concluída."); }}
                        className="h-8 text-success border-success/40 hover:bg-success/10 disabled:opacity-40"
                        title={done ? "Já concluído" : "Marcar como concluído"}
                      >
                        <Check className="h-3.5 w-3.5" /> Concluir
                      </Button>
                      <ConfirmDelete onDelete={() => removeItem(item.id)} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ConfirmDelete({ onDelete, label = "Excluir item?" }: { onDelete: () => void; label?: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{label}</AlertDialogTitle>
        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive hover:bg-primary-dark" onClick={onDelete}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}




// ============ CUSTOS ============
function CostsTab({ fair }: { fair: Fair }) {
  const upd = (id: string, patch: Partial<CostItem>) => actions.updateChild(fair.id, "costs", l => l.map(i => i.id === id ? { ...i, ...patch } : i));
  const add = () => actions.updateChild(fair.id, "costs", l => [...l, { id: uid(), category: "Outros", description: "Novo custo", estimated: 0, closed: 0, status: "Aguardando orçamento", invoiceReceived: false, receiptAttached: false }]);
  const del = (id: string) => actions.updateChild(fair.id, "costs", l => l.filter(i => i.id !== id));
  const totals = useMemo(() => {
    const est = fair.costs.reduce((s, c) => s + (c.estimated || 0), 0);
    const closed = fair.costs.reduce((s, c) => s + (c.closed || 0), 0);
    const paid = fair.costs.filter(c => c.status === "Pago").reduce((s, c) => s + (c.closed || c.estimated || 0), 0);
    const pending = closed - paid;
    return { est, closed, paid, pending };
  }, [fair.costs]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total previsto" value={fmtMoney(totals.est)} />
        <StatCard label="Total fechado" value={fmtMoney(totals.closed)} />
        <StatCard label="Total pago" value={fmtMoney(totals.paid)} tone="success" />
        <StatCard label="Total pendente" value={fmtMoney(totals.pending)} tone="warning" />
      </div>
      <TableCard title="Taxas e Custos" onAdd={add} onExport={() => exportCSV(`custos-${fair.name}.csv`, fair.costs)}>
        <ResponsiveTable headers={["Categoria", "Descrição", "Fornecedor", "Previsto", "Fechado", "Vencimento", "Status", "NF", "Comp.", "Obs.", ""]}>
          {fair.costs.map(c => (
            <tr key={c.id} className="border-t align-middle">
              <td className="p-2"><Select value={c.category} onValueChange={v => upd(c.id, { category: v as CostItem["category"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COST_CATEGORIES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></td>
              <td className="p-2"><Input value={c.description} onChange={e => upd(c.id, { description: e.target.value })} /></td>
              <td className="p-2"><Input value={c.supplier ?? ""} onChange={e => upd(c.id, { supplier: e.target.value })} /></td>
              <td className="p-2"><Input type="number" value={c.estimated} onChange={e => upd(c.id, { estimated: Number(e.target.value) })} className="w-24" /></td>
              <td className="p-2"><Input type="number" value={c.closed} onChange={e => upd(c.id, { closed: Number(e.target.value) })} className="w-24" /></td>
              <td className="p-2"><Input type="date" value={c.dueDate ?? ""} onChange={e => upd(c.id, { dueDate: e.target.value })} /></td>
              <td className="p-2"><Select value={c.status} onValueChange={v => upd(c.id, { status: v as CostItem["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_STATUSES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></td>
              <td className="p-2 text-center"><Checkbox checked={c.invoiceReceived} onCheckedChange={v => upd(c.id, { invoiceReceived: !!v })} /></td>
              <td className="p-2 text-center"><Checkbox checked={c.receiptAttached} onCheckedChange={v => upd(c.id, { receiptAttached: !!v })} /></td>
              <td className="p-2"><Input value={c.notes ?? ""} onChange={e => upd(c.id, { notes: e.target.value })} /></td>
              <td className="p-2"><ConfirmDelete onDelete={() => del(c.id)} /></td>
            </tr>
          ))}
        </ResponsiveTable>
      </TableCard>
    </div>
  );
}

// ============ CREDENCIAIS ============
function CredentialsTab({ fair }: { fair: Fair }) {
  const upd = (id: string, patch: Partial<CredentialItem>) => actions.updateChild(fair.id, "credentials", l => l.map(i => i.id === id ? { ...i, ...patch } : i));
  const add = () => actions.updateChild(fair.id, "credentials", l => [...l, { id: uid(), name: "Novo participante", type: "Expositor", status: "Pendente" }]);
  const del = (id: string) => actions.updateChild(fair.id, "credentials", l => l.filter(i => i.id !== id));
  return (
    <TableCard title="Credenciais" onAdd={add} onExport={() => exportCSV(`credenciais-${fair.name}.csv`, fair.credentials)}>
      <ResponsiveTable headers={["Nome", "Empresa", "Cargo", "CPF", "Celular", "E-mail", "Tipo", "Status", "Enviada em", "Obs.", ""]}>
        {fair.credentials.map(c => (
          <tr key={c.id} className="border-t align-middle">
            <td className="p-2"><Input value={c.name} onChange={e => upd(c.id, { name: e.target.value })} /></td>
            <td className="p-2"><Input value={c.company ?? ""} onChange={e => upd(c.id, { company: e.target.value })} /></td>
            <td className="p-2"><Input value={c.role ?? ""} onChange={e => upd(c.id, { role: e.target.value })} /></td>
            <td className="p-2"><Input value={c.cpf ?? ""} onChange={e => upd(c.id, { cpf: e.target.value })} /></td>
            <td className="p-2"><Input value={c.phone ?? ""} onChange={e => upd(c.id, { phone: e.target.value })} /></td>
            <td className="p-2"><Input value={c.email ?? ""} onChange={e => upd(c.id, { email: e.target.value })} /></td>
            <td className="p-2"><Select value={c.type} onValueChange={v => upd(c.id, { type: v as CredentialItem["type"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CREDENTIAL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></td>
            <td className="p-2"><Select value={c.status} onValueChange={v => upd(c.id, { status: v as CredentialItem["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CREDENTIAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></td>
            <td className="p-2"><Input type="date" value={c.sentAt ?? ""} onChange={e => upd(c.id, { sentAt: e.target.value })} /></td>
            <td className="p-2"><Input value={c.notes ?? ""} onChange={e => upd(c.id, { notes: e.target.value })} /></td>
            <td className="p-2"><ConfirmDelete onDelete={() => del(c.id)} /></td>
          </tr>
        ))}
      </ResponsiveTable>
    </TableCard>
  );
}

// ============ PRODUTOS ============
function ProductsTab({ fair }: { fair: Fair }) {
  const upd = (id: string, patch: Partial<ProductItem>) => actions.updateChild(fair.id, "products", l => l.map(i => i.id === id ? { ...i, ...patch } : i));
  const add = () => actions.updateChild(fair.id, "products", l => [...l, { id: uid(), code: "", description: "Novo produto", quantity: 1, expoType: "Apenas exposição", working: true, needsFuel: false, needsPower: false, needsOperator: false, logisticStatus: "A definir", returned: false }]);
  const del = (id: string) => actions.updateChild(fair.id, "products", l => l.filter(i => i.id !== id));
  return (
    <TableCard title="Produtos para Exposição" onAdd={add} onExport={() => exportCSV(`produtos-${fair.name}.csv`, fair.products)}>
      <ResponsiveTable headers={["Código", "Descrição", "Marca", "Qtd", "Tipo exposição", "Func.", "Comb.", "Energia", "Operador", "Responsável", "Status logístico", "Retornou", "Obs.", ""]}>
        {fair.products.map(p => (
          <tr key={p.id} className="border-t align-middle">
            <td className="p-2"><Input value={p.code} onChange={e => upd(p.id, { code: e.target.value })} className="w-24" /></td>
            <td className="p-2"><Input value={p.description} onChange={e => upd(p.id, { description: e.target.value })} /></td>
            <td className="p-2"><Input value={p.brand ?? ""} onChange={e => upd(p.id, { brand: e.target.value })} className="w-28" /></td>
            <td className="p-2"><Input type="number" value={p.quantity} onChange={e => upd(p.id, { quantity: Number(e.target.value) })} className="w-16" /></td>
            <td className="p-2"><Select value={p.expoType} onValueChange={v => upd(p.id, { expoType: v as ProductItem["expoType"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPO_TYPES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></td>
            <td className="p-2 text-center"><Checkbox checked={p.working} onCheckedChange={v => upd(p.id, { working: !!v })} /></td>
            <td className="p-2 text-center"><Checkbox checked={p.needsFuel} onCheckedChange={v => upd(p.id, { needsFuel: !!v })} /></td>
            <td className="p-2 text-center"><Checkbox checked={p.needsPower} onCheckedChange={v => upd(p.id, { needsPower: !!v })} /></td>
            <td className="p-2 text-center"><Checkbox checked={p.needsOperator} onCheckedChange={v => upd(p.id, { needsOperator: !!v })} /></td>
            <td className="p-2"><Input value={p.responsible ?? ""} onChange={e => upd(p.id, { responsible: e.target.value })} /></td>
            <td className="p-2"><Select value={p.logisticStatus} onValueChange={v => upd(p.id, { logisticStatus: v as ProductItem["logisticStatus"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LOGISTIC_STATUSES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></td>
            <td className="p-2 text-center"><Checkbox checked={p.returned} onCheckedChange={v => upd(p.id, { returned: !!v })} /></td>
            <td className="p-2"><Input value={p.notes ?? ""} onChange={e => upd(p.id, { notes: e.target.value })} /></td>
            <td className="p-2"><ConfirmDelete onDelete={() => del(p.id)} /></td>
          </tr>
        ))}
      </ResponsiveTable>
    </TableCard>
  );
}

// ============ MATERIAIS ============
function MaterialsTab({ fair }: { fair: Fair }) {
  const upd = (id: string, patch: Partial<MaterialItem>) => actions.updateChild(fair.id, "materials", l => l.map(i => i.id === id ? { ...i, ...patch } : i));
  const add = () => actions.updateChild(fair.id, "materials", l => [...l, { id: uid(), item: "Novo item", category: "Outro", needed: 1, available: 0, status: "Pendente" }]);
  const del = (id: string) => actions.updateChild(fair.id, "materials", l => l.filter(i => i.id !== id));
  return (
    <TableCard title="Materiais e Brindes" onAdd={add} onExport={() => exportCSV(`materiais-${fair.name}.csv`, fair.materials)}>
      <ResponsiveTable headers={["Item", "Categoria", "Necessário", "Disponível", "Responsável", "Status", "Obs.", ""]}>
        {fair.materials.map(m => (
          <tr key={m.id} className="border-t align-middle">
            <td className="p-2"><Input value={m.item} onChange={e => upd(m.id, { item: e.target.value })} /></td>
            <td className="p-2"><Select value={m.category} onValueChange={v => upd(m.id, { category: v as MaterialItem["category"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MATERIAL_CATEGORIES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></td>
            <td className="p-2"><Input type="number" value={m.needed} onChange={e => upd(m.id, { needed: Number(e.target.value) })} className="w-20" /></td>
            <td className="p-2"><Input type="number" value={m.available} onChange={e => upd(m.id, { available: Number(e.target.value) })} className="w-20" /></td>
            <td className="p-2"><Input value={m.responsible ?? ""} onChange={e => upd(m.id, { responsible: e.target.value })} /></td>
            <td className="p-2"><Select value={m.status} onValueChange={v => upd(m.id, { status: v as MaterialItem["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MATERIAL_STATUSES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></td>
            <td className="p-2"><Input value={m.notes ?? ""} onChange={e => upd(m.id, { notes: e.target.value })} /></td>
            <td className="p-2"><ConfirmDelete onDelete={() => del(m.id)} /></td>
          </tr>
        ))}
      </ResponsiveTable>
    </TableCard>
  );
}

// ============ FORNECEDORES ============
function SuppliersTab({ fair }: { fair: Fair }) {
  const upd = (id: string, patch: Partial<SupplierItem>) => actions.updateChild(fair.id, "suppliers", l => l.map(i => i.id === id ? { ...i, ...patch } : i));
  const add = () => actions.updateChild(fair.id, "suppliers", l => [...l, { id: uid(), name: "Novo fornecedor", service: "Outro", value: 0, status: "Pendente" }]);
  const del = (id: string) => actions.updateChild(fair.id, "suppliers", l => l.filter(i => i.id !== id));
  return (
    <div className="space-y-3">
      <ImportFromAuxilio fair={fair} />
      <TableCard title="Fornecedores" onAdd={add} onExport={() => exportCSV(`fornecedores-${fair.name}.csv`, fair.suppliers)}>
        <ResponsiveTable headers={["Fornecedor", "Serviço", "Contato", "WhatsApp", "E-mail", "Valor", "Status", "Obs.", ""]}>
          {fair.suppliers.map(s => (
            <tr key={s.id} className="border-t align-middle">
              <td className="p-2"><Input value={s.name} onChange={e => upd(s.id, { name: e.target.value })} /></td>
              <td className="p-2"><Select value={s.service} onValueChange={v => upd(s.id, { service: v as SupplierItem["service"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUPPLIER_SERVICES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></td>
              <td className="p-2"><Input value={s.contact ?? ""} onChange={e => upd(s.id, { contact: e.target.value })} /></td>
              <td className="p-2"><Input value={s.whatsapp ?? ""} onChange={e => upd(s.id, { whatsapp: e.target.value })} /></td>
              <td className="p-2"><Input value={s.email ?? ""} onChange={e => upd(s.id, { email: e.target.value })} /></td>
              <td className="p-2"><Input type="number" value={s.value} onChange={e => upd(s.id, { value: Number(e.target.value) })} className="w-28" /></td>
              <td className="p-2"><Input value={s.status} onChange={e => upd(s.id, { status: e.target.value })} className="w-32" /></td>
              <td className="p-2"><Input value={s.notes ?? ""} onChange={e => upd(s.id, { notes: e.target.value })} /></td>
              <td className="p-2"><ConfirmDelete onDelete={() => del(s.id)} /></td>
            </tr>
          ))}
        </ResponsiveTable>
      </TableCard>
    </div>
  );
}

function ImportFromAuxilio({ fair }: { fair: Fair }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<AuxSupplier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setOpen(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) { setError("Entre na sua conta para acessar a base de fornecedores da aba Fornecedores."); setList([]); return; }
      setList(await fetchSuppliers());
    } catch {
      setError("Não foi possível carregar os fornecedores.");
      setList([]);
    }
  }

  function importOne(s: AuxSupplier) {
    const service = (SUPPLIER_SERVICES as readonly string[]).includes(s.service_type)
      ? (s.service_type as SupplierItem["service"]) : "Outro";
    actions.updateChild(fair.id, "suppliers", l => [...l, {
      id: uid(), name: s.name, service, contact: s.contact_name ?? "",
      whatsapp: s.whatsapp ?? "", email: s.email ?? "", value: 0, status: s.status,
    }]);
    toast.success(`${s.name} importado para esta feira`);
  }

  const filtered = (list ?? []).filter(s =>
    !q.trim() || [s.name, s.contact_name, s.service_type, s.city].some(v => (v ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <Button variant="outline" size="sm" onClick={load}>Importar do cadastro</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar fornecedor do cadastro</DialogTitle>
            <DialogDescription>Copia os dados do cadastro central para esta feira. O cadastro original continua intacto.</DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{error}</p>
          ) : list === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <>
              <Input placeholder="Buscar fornecedor" value={q} onChange={e => setQ(e.target.value)} />
              <div className="space-y-2">
                {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum fornecedor encontrado.</p>}
                {filtered.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.service_type}{s.city ? ` · ${s.city}` : ""}{s.contact_name ? ` · ${s.contact_name}` : ""}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => importOne(s)}>Importar</Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ RELATÓRIO ============
function ReportTab({ fair }: { fair: Fair }) {
  const [r, setR] = useState(fair.report);
  const save = () => { actions.updateFair(fair.id, { report: r }); toast.success("Relatório salvo"); };
  const generate = () => {
    save();
    const totalCosts = fair.costs.reduce((s, c) => s + (c.closed || c.estimated || 0), 0);
    const lines = [
      `RELATÓRIO PÓS-FEIRA — ${fair.name}`,
      `${fair.city}/${fair.state} — ${fmtDate(fair.startDate)} a ${fmtDate(fair.endDate)}`,
      ``,
      `Total de leads captados: ${r.totalLeads ?? "—"}`,
      `Revendas interessadas: ${r.interestedResellers ?? "—"}`,
      `Produtos mais procurados: ${r.topProducts ?? "—"}`,
      `Custo total: ${fmtMoney(r.totalCost ?? totalCosts)}`,
      ``,
      `Pontos positivos: ${r.positives ?? "—"}`,
      `Problemas ocorridos: ${r.problems ?? "—"}`,
      `Melhorias sugeridas: ${r.improvements ?? "—"}`,
      ``,
      `Vale a pena participar novamente? ${r.worthAgain ?? "—"}`,
      `Observações finais: ${r.finalNotes ?? "—"}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${fair.name}.txt`;
    a.click();
  };
  return (
    <Card className="ccm-lift"><CardContent className="p-6 space-y-5">
      <h2 className="text-lg font-semibold">Relatório Pós-Feira</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Total de leads captados</Label><Input type="number" value={r.totalLeads ?? ""} onChange={e => setR({ ...r, totalLeads: Number(e.target.value) })} /></div>
        <div><Label>Custo total da feira (R$)</Label><Input type="number" value={r.totalCost ?? ""} onChange={e => setR({ ...r, totalCost: Number(e.target.value) })} /></div>
        <div className="sm:col-span-2"><Label>Revendas interessadas</Label><Textarea rows={2} value={r.interestedResellers ?? ""} onChange={e => setR({ ...r, interestedResellers: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Produtos mais procurados</Label><Textarea rows={2} value={r.topProducts ?? ""} onChange={e => setR({ ...r, topProducts: e.target.value })} /></div>
        <div><Label>Pontos positivos</Label><Textarea rows={3} value={r.positives ?? ""} onChange={e => setR({ ...r, positives: e.target.value })} /></div>
        <div><Label>Problemas ocorridos</Label><Textarea rows={3} value={r.problems ?? ""} onChange={e => setR({ ...r, problems: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>O que melhorar</Label><Textarea rows={3} value={r.improvements ?? ""} onChange={e => setR({ ...r, improvements: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Fotos principais (links ou descrições)</Label><Textarea rows={2} value={r.photos ?? ""} onChange={e => setR({ ...r, photos: e.target.value })} /></div>
        <div className="sm:col-span-2">
          <Label>Vale a pena participar novamente?</Label>
          <RadioGroup value={r.worthAgain ?? ""} onValueChange={v => setR({ ...r, worthAgain: v as "Sim" | "Não" | "Avaliar melhor" })} className="mt-2 flex flex-wrap gap-6">
            {["Sim", "Não", "Avaliar melhor"].map(o => (
              <div key={o} className="flex items-center gap-2"><RadioGroupItem value={o} id={`w-${o}`} /><Label htmlFor={`w-${o}`} className="font-normal cursor-pointer">{o}</Label></div>
            ))}
          </RadioGroup>
        </div>
        <div className="sm:col-span-2"><Label>Observações finais</Label><Textarea rows={3} value={r.finalNotes ?? ""} onChange={e => setR({ ...r, finalNotes: e.target.value })} /></div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={save}>Salvar</Button>
        <Button onClick={generate} className="bg-primary hover:bg-primary-dark"><FileText className="h-4 w-4" /> Gerar relatório</Button>
      </div>
    </CardContent></Card>
  );
}

// ============ shared ============
function TableCard({ title, onAdd, onExport, children }: { title: string; onAdd: () => void; onExport: () => void; children: React.ReactNode }) {
  return (
    <Card className="ccm-lift"><CardContent className="p-0">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport}><Download className="h-4 w-4" /> CSV</Button>
          <Button size="sm" className="bg-primary hover:bg-primary-dark" onClick={onAdd}><Plus className="h-4 w-4" /> Adicionar</Button>
        </div>
      </div>
      {children}
    </CardContent></Card>
  );
}

function ResponsiveTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{headers.map((h, i) => <th key={i} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
