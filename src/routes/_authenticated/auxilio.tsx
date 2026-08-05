import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Star, Trash2, Pencil, Copy, Download, Eye, Paperclip, MessageSquare,
  History, Loader2, FileText, ImageIcon, X,
} from "lucide-react";
import {
  APPROVED_OPTIONS, CONTACT_CHANNELS, HOW_WE_MET, MESSAGE_TEMPLATES, SUPPLIER_SERVICE_TYPES,
  SUPPLIER_STATUSES, UF_LIST, ACCEPTED_FILE_TYPES,
  addContactLog, deleteContactLog, deleteSupplier, emptySupplier, fetchAllContacts, fetchSuppliers,
  patchSupplier, removeAttachment, saveSupplier, signedUrl, uploadAttachment, whatsappLink,
  type Supplier, type SupplierContact, type SupplierInput,
} from "@/lib/suppliers";
import { exportCSV, fmtDate } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/auxilio")({
  head: () => ({
    meta: [
      { title: "Fornecedores | CCM Feira Control" },
      { name: "description", content: "Cadastro rápido de fornecedores de feiras: contatos, orçamentos, anexos de cartões e histórico de negociação da CCM do Brasil." },
      { property: "og:title", content: "Fornecedores | CCM Feira Control" },
      { property: "og:description", content: "Cadastro rápido de fornecedores de feiras: contatos, orçamentos, anexos e histórico de negociação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuxilioPage,
});

const STATUS_COLORS: Record<string, string> = {
  "Novo contato": "bg-muted text-foreground",
  "Em análise": "bg-muted text-foreground",
  "Orçamento solicitado": "bg-warning/15 text-warning-foreground border-warning/40",
  "Orçamento recebido": "bg-info/15 text-info border-info/40",
  "Aprovado para cotação": "bg-success/15 text-success border-success/40",
  "Contratado": "bg-primary/15 text-primary border-primary/40",
  "Não aprovado": "bg-destructive/15 text-destructive border-destructive/40",
  "Arquivado": "bg-secondary/15 text-secondary-foreground border-secondary/30",
};

function SupplierStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("border font-medium whitespace-nowrap", STATUS_COLORS[status] ?? "bg-muted")}>
      {status}
    </Badge>
  );
}

const ALL = "__all__";

function AuxilioPage() {
  const qc = useQueryClient();
  const { data: suppliers = [], isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: contacts = [] } = useQuery({ queryKey: ["supplier_contacts"], queryFn: fetchAllContacts });

  const [search, setSearch] = useState("");
  const [fService, setFService] = useState(ALL);
  const [fState, setFState] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fEvent, setFEvent] = useState(ALL);
  const [fApproved, setFApproved] = useState(ALL);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [historyFor, setHistoryFor] = useState<Supplier | null>(null);
  const [messageFor, setMessageFor] = useState<Supplier | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["supplier_contacts"] });
  };

  const lastContactBySupplier = useMemo(() => {
    const map = new Map<string, SupplierContact>();
    for (const c of contacts) {
      const cur = map.get(c.supplier_id);
      if (!cur || c.contact_date > cur.contact_date) map.set(c.supplier_id, c);
    }
    return map;
  }, [contacts]);

  const events = useMemo(
    () => Array.from(new Set(suppliers.map(s => s.related_event).filter((v): v is string => !!v))).sort(),
    [suppliers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter(s => {
      if (fService !== ALL && s.service_type !== fService) return false;
      if (fState !== ALL && (s.state ?? "") !== fState) return false;
      if (fStatus !== ALL && s.status !== fStatus) return false;
      if (fEvent !== ALL && (s.related_event ?? "") !== fEvent) return false;
      if (fApproved !== ALL && s.approved !== fApproved) return false;
      if (onlyFavorites && !s.favorite) return false;
      if (!q) return true;
      return [s.name, s.contact_name, s.city, s.service_type]
        .some(v => (v ?? "").toLowerCase().includes(q));
    });
  }, [suppliers, search, fService, fState, fStatus, fEvent, fApproved, onlyFavorites]);

  const stats = useMemo(() => ({
    total: suppliers.length,
    novos: suppliers.filter(s => s.status === "Novo contato").length,
    solicitados: suppliers.filter(s => s.status === "Orçamento solicitado").length,
    recebidos: suppliers.filter(s => s.status === "Orçamento recebido").length,
    aprovados: suppliers.filter(s => s.status === "Aprovado para cotação").length,
    contratados: suppliers.filter(s => s.status === "Contratado").length,
    arquivados: suppliers.filter(s => s.status === "Arquivado").length,
  }), [suppliers]);

  const del = useMutation({
    mutationFn: (s: Supplier) => deleteSupplier(s),
    onSuccess: () => { toast.success("Fornecedor excluído"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SupplierInput> }) => patchSupplier(id, data),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copiado`),
      () => toast.error("Não foi possível copiar"),
    );
  }

  function clearFilters() {
    setSearch(""); setFService(ALL); setFState(ALL); setFStatus(ALL);
    setFEvent(ALL); setFApproved(ALL); setOnlyFavorites(false);
  }

  function handleExport() {
    if (!filtered.length) { toast.error("Nada para exportar"); return; }
    exportCSV("fornecedores-ccm.csv", filtered.map(s => ({
      Nome: s.name, Contato: s.contact_name ?? "", WhatsApp: s.whatsapp ?? "", Telefone: s.phone ?? "",
      Email: s.email ?? "", Cidade: s.city ?? "", UF: s.state ?? "", "Tipo de serviço": s.service_type,
      Status: s.status, Evento: s.related_event ?? "", "Como conhecemos": s.how_we_met ?? "",
      Aprovado: s.approved, Favorito: s.favorite ? "Sim" : "Não",
      "Último contato": lastContactBySupplier.get(s.id)?.contact_date ?? "",
      Observações: s.notes ?? "",
    })));
  }

  const cards: { label: string; value: number; status?: string }[] = [
    { label: "Total cadastrados", value: stats.total },
    { label: "Novos contatos", value: stats.novos, status: "Novo contato" },
    { label: "Orç. solicitados", value: stats.solicitados, status: "Orçamento solicitado" },
    { label: "Orç. recebidos", value: stats.recebidos, status: "Orçamento recebido" },
    { label: "Aprovados", value: stats.aprovados, status: "Aprovado para cotação" },
    { label: "Contratados", value: stats.contratados, status: "Contratado" },
    { label: "Arquivados", value: stats.arquivados, status: "Arquivado" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Fornecedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informações úteis do dia a dia do marketing. Aqui fica a base central de fornecedores, reaproveitável em todas as feiras.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo fornecedor
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(c => (
          <button
            key={c.label}
            onClick={() => setFStatus(c.status && fStatus !== c.status ? c.status : ALL)}
            className={cn(
              "rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50",
              c.status && fStatus === c.status && "border-primary ring-1 ring-primary/30",
            )}
          >
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{c.label}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-lg font-semibold">Cadastro Rápido de Fornecedores</h2>
            <p className="text-sm text-muted-foreground">
              Cadastre em segundos qualquer fornecedor que entrar em contato ou que a equipe conhecer em uma feira,
              anexe o cartão de visita e mantenha o histórico das conversas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por fornecedor, contato, cidade ou serviço" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <FilterSelect value={fService} onChange={setFService} placeholder="Serviço" options={[...SUPPLIER_SERVICE_TYPES]} allLabel="Todos os serviços" />
            <FilterSelect value={fState} onChange={setFState} placeholder="UF" options={[...UF_LIST]} allLabel="Todas as UFs" width="w-[110px]" />
            <FilterSelect value={fStatus} onChange={setFStatus} placeholder="Status" options={[...SUPPLIER_STATUSES]} allLabel="Todos os status" />
            <FilterSelect value={fEvent} onChange={setFEvent} placeholder="Evento" options={events} allLabel="Todos os eventos" />
            <FilterSelect value={fApproved} onChange={setFApproved} placeholder="Aprovado" options={[...APPROVED_OPTIONS]} allLabel="Aprovado: todos" />
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox checked={onlyFavorites} onCheckedChange={v => setOnlyFavorites(!!v)} /> Favoritos
            </label>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> CSV</Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              {suppliers.length === 0 ? "Nenhum fornecedor cadastrado ainda." : "Nenhum fornecedor encontrado com esses filtros."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2">Fornecedor</th>
                    <th className="px-2 py-2">Contato</th>
                    <th className="px-2 py-2">WhatsApp</th>
                    <th className="px-2 py-2">E-mail</th>
                    <th className="px-2 py-2">Cidade/UF</th>
                    <th className="px-2 py-2">Serviço</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Evento</th>
                    <th className="px-2 py-2">Anexo</th>
                    <th className="px-2 py-2">Último contato</th>
                    <th className="px-2 py-2">Observações</th>
                    <th className="px-2 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const last = lastContactBySupplier.get(s.id);
                    return (
                      <tr key={s.id} className={cn("border-b align-top", s.approved === "Sim" && "bg-success/5")}>
                        <td className="px-2 py-2">
                          <div className="flex items-start gap-1.5">
                            <button
                              onClick={() => patch.mutate({ id: s.id, data: { favorite: !s.favorite } })}
                              title={s.favorite ? "Remover dos favoritos" : "Marcar como favorito"}
                            >
                              <Star className={cn("h-4 w-4", s.favorite ? "fill-warning text-warning" : "text-muted-foreground")} />
                            </button>
                            <div>
                              <div className="font-medium">{s.name}</div>
                              {s.approved === "Sim" && <span className="text-[11px] text-success">Aprovado para cotações</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2">{s.contact_name || "—"}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {s.whatsapp ? (
                            <span className="flex items-center gap-1">
                              {s.whatsapp}
                              <button onClick={() => copy(s.whatsapp!, "WhatsApp")} title="Copiar"><Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" /></button>
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-2 py-2">
                          {s.email ? (
                            <span className="flex items-center gap-1">
                              <span className="max-w-[160px] truncate">{s.email}</span>
                              <button onClick={() => copy(s.email!, "E-mail")} title="Copiar"><Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" /></button>
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{[s.city, s.state].filter(Boolean).join("/") || "—"}</td>
                        <td className="px-2 py-2">{s.service_type}</td>
                        <td className="px-2 py-2">
                          <Select value={s.status} onValueChange={v => patch.mutate({ id: s.id, data: { status: v } })}>
                            <SelectTrigger className="h-8 w-[185px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{SUPPLIER_STATUSES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                          <div className="mt-1"><SupplierStatusBadge status={s.status} /></div>
                        </td>
                        <td className="px-2 py-2">{s.related_event || "—"}</td>
                        <td className="px-2 py-2"><AttachmentCell supplier={s} /></td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {last ? (
                            <div>
                              <div>{fmtDate(last.contact_date)}</div>
                              <div className="text-[11px] text-muted-foreground">{last.channel}</div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-2 py-2"><div className="max-w-[180px] whitespace-pre-wrap text-xs text-muted-foreground">{s.notes || "—"}</div></td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Histórico de contato" onClick={() => setHistoryFor(s)}><History className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Gerar mensagem" onClick={() => setMessageFor(s)}><MessageSquare className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Editar" onClick={() => { setEditing(s); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir {s.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>O cadastro, o anexo e o histórico de contatos serão removidos. Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive hover:bg-primary-dark" onClick={() => del.mutate(s)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={editing}
        onSaved={invalidate}
      />
      <HistoryDialog supplier={historyFor} contacts={contacts} onClose={() => setHistoryFor(null)} onChanged={invalidate} />
      <MessageDialog supplier={messageFor} onClose={() => setMessageFor(null)} />
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options, allLabel, width = "w-[170px]" }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: string[]; allLabel: string; width?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={width}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function AttachmentCell({ supplier }: { supplier: Supplier }) {
  const [busy, setBusy] = useState(false);
  if (!supplier.attachment_path) return <span className="text-xs text-muted-foreground">Sem anexo</span>;

  async function open(download: boolean) {
    setBusy(true);
    try {
      const url = await signedUrl(supplier.attachment_path!, download);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Não foi possível abrir o anexo");
    } finally { setBusy(false); }
  }

  const isPdf = supplier.attachment_type === "application/pdf";
  return (
    <div className="flex items-center gap-1">
      {isPdf ? <FileText className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar" disabled={busy} onClick={() => open(false)}><Eye className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar" disabled={busy} onClick={() => open(true)}><Download className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function SupplierFormDialog({ open, onOpenChange, supplier, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; supplier: Supplier | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<SupplierInput>(emptySupplier());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  // Reinicializa o formulário toda vez que o diálogo abre
  const signature = `${open}-${supplier?.id ?? "new"}`;
  const [lastSignature, setLastSignature] = useState("");
  if (open && signature !== lastSignature) {
    setLastSignature(signature);
    setForm(supplier ? { ...(supplier as unknown as SupplierInput) } : emptySupplier());
    setPreview(null);
    setKey(k => k + 1);
  }

  const set = <K extends keyof SupplierInput>(k: K, v: SupplierInput[K]) => setForm(f => ({ ...f, [k]: v }));

  async function handleFile(file?: File) {
    if (!file) return;
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast.error("Formato não aceito. Use JPG, PNG, WEBP ou PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo maior que 10 MB."); return; }
    setBusy(true);
    try {
      if (form.attachment_path) await removeAttachment(form.attachment_path);
      const up = await uploadAttachment(file);
      setForm(f => ({
        ...f,
        attachment_path: up.path, attachment_name: up.name, attachment_type: up.type,
        attachment_uploaded_at: new Date().toISOString(),
      }));
      if (file.type.startsWith("image/")) setPreview(URL.createObjectURL(file));
      else setPreview(null);
      toast.success("Anexo enviado");
    } catch {
      toast.error("Falha ao enviar o anexo");
    } finally { setBusy(false); }
  }

  async function dropAttachment() {
    if (form.attachment_path) await removeAttachment(form.attachment_path);
    setForm(f => ({ ...f, attachment_path: null, attachment_name: null, attachment_type: null, attachment_uploaded_at: null }));
    setPreview(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Informe o nome do fornecedor"); return; }
    setBusy(true);
    try {
      await saveSupplier(form, supplier?.id);
      toast.success(supplier ? "Fornecedor atualizado" : "Fornecedor cadastrado");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          <DialogDescription>Preencha o que souber agora — o cadastro pode ser completado depois.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome do fornecedor *"><Input value={form.name} onChange={e => set("name", e.target.value)} required /></Field>
            <Field label="Nome do contato"><Input value={form.contact_name ?? ""} onChange={e => set("contact_name", e.target.value)} /></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp ?? ""} onChange={e => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" /></Field>
            <Field label="Telefone"><Input value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} /></Field>
            <Field label="E-mail"><Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} /></Field>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <Field label="Cidade"><Input value={form.city ?? ""} onChange={e => set("city", e.target.value)} /></Field>
              <Field label="Estado">
                <Select value={form.state || undefined} onValueChange={v => set("state", v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UF_LIST.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Tipo de serviço">
              <Select value={form.service_type} onValueChange={v => set("service_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUPPLIER_SERVICE_TYPES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Evento relacionado"><Input value={form.related_event ?? ""} onChange={e => set("related_event", e.target.value)} placeholder="Ex.: Agrishow 2026" /></Field>
            <Field label="Como conhecemos">
              <Select value={form.how_we_met ?? undefined} onValueChange={v => set("how_we_met", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{HOW_WE_MET.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUPPLIER_STATUSES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Aprovado para futuras cotações">
              <Select value={form.approved} onValueChange={v => set("approved", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{APPROVED_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.favorite} onCheckedChange={v => set("favorite", !!v)} /> Marcar como favorito
              </label>
            </div>
          </div>

          <Field label="Observações">
            <Textarea rows={3} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} placeholder="Condições, prazos, impressões da equipe..." />
          </Field>

          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Paperclip className="h-4 w-4" /> Cartão de visita, flyer ou apresentação</div>
            <p className="mt-1 text-xs text-muted-foreground">Aceita JPG, PNG, WEBP ou PDF (até 10 MB). O arquivo fica salvo com segurança e acessível de qualquer computador.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Input key={key} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="max-w-xs" disabled={busy} onChange={e => handleFile(e.target.files?.[0])} />
              {form.attachment_path && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                  {form.attachment_type === "application/pdf" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  <span className="max-w-[180px] truncate">{form.attachment_name}</span>
                  <button type="button" onClick={dropAttachment} title="Remover anexo"><X className="h-3.5 w-3.5 text-destructive" /></button>
                </div>
              )}
            </div>
            {preview && <img src={preview} alt="Pré-visualização do anexo do fornecedor" className="mt-3 max-h-40 rounded-md border" />}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function HistoryDialog({ supplier, contacts, onClose, onChanged }: {
  supplier: Supplier | null; contacts: SupplierContact[]; onClose: () => void; onChanged: () => void;
}) {
  const [date, setDate] = useState("");
  const [channel, setChannel] = useState<string>("WhatsApp");
  const [description, setDescription] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [responsible, setResponsible] = useState("");
  const [busy, setBusy] = useState(false);

  const list = supplier ? contacts.filter(c => c.supplier_id === supplier.id) : [];

  async function add() {
    if (!supplier) return;
    setBusy(true);
    try {
      await addContactLog({
        supplier_id: supplier.id,
        contact_date: date || new Date().toISOString().slice(0, 10),
        channel,
        description: description || null,
        next_action: nextAction || null,
        responsible: responsible || null,
      });
      setDate(""); setDescription(""); setNextAction(""); setResponsible("");
      onChanged();
      toast.success("Contato registrado");
    } catch {
      toast.error("Erro ao registrar contato");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!supplier} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de contato — {supplier?.name}</DialogTitle>
          <DialogDescription>Registre cada conversa para a equipe saber em que pé está a negociação.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <Field label="Data"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Field label="Meio de contato">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTACT_CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2"><Field label="Descrição"><Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></Field></div>
          <Field label="Próxima ação"><Input value={nextAction} onChange={e => setNextAction(e.target.value)} /></Field>
          <Field label="Responsável"><Input value={responsible} onChange={e => setResponsible(e.target.value)} /></Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button size="sm" onClick={add} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Registrar contato</Button>
          </div>
        </div>

        <div className="space-y-2">
          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum contato registrado ainda.</p>
          ) : list.map(c => (
            <div key={c.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{fmtDate(c.contact_date)} · {c.channel}</div>
                <button onClick={async () => { await deleteContactLog(c.id); onChanged(); }} title="Excluir registro">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
              {c.description && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{c.description}</p>}
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {c.next_action && <span>Próxima ação: {c.next_action}</span>}
                {c.responsible && <span>Responsável: {c.responsible}</span>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MessageDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string>("");

  const sig = supplier?.id ?? "";
  const [lastSig, setLastSig] = useState("");
  if (supplier && sig !== lastSig) {
    setLastSig(sig);
    setSelected(MESSAGE_TEMPLATES[0].key);
    setText(MESSAGE_TEMPLATES[0].build(supplier));
  }

  return (
    <Dialog open={!!supplier} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mensagem para {supplier?.name}</DialogTitle>
          <DialogDescription>Escolha um modelo, ajuste o texto e envie pelo WhatsApp ou copie para o e-mail.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {MESSAGE_TEMPLATES.map(t => (
            <Button
              key={t.key}
              type="button"
              variant={selected === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelected(t.key); if (supplier) setText(t.build(supplier)); }}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <Textarea rows={10} value={text} onChange={e => setText(e.target.value)} />

        <DialogFooter>
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(text); toast.success("Mensagem copiada"); }}>
            <Copy className="h-4 w-4" /> Copiar
          </Button>
          {supplier?.whatsapp && (
            <Button onClick={() => window.open(whatsappLink(supplier.whatsapp!, text), "_blank", "noopener")}>
              <MessageSquare className="h-4 w-4" /> Abrir no WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
