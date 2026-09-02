import { useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Paperclip, ExternalLink, Download, AlertTriangle, Archive, Search,
  FileText, FileSpreadsheet, ImageIcon, File as FileIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ccm-ui";

import {
  actions, uid, fmtDate, daysUntil,
  FAIR_DOC_CATEGORIES, FAIR_DOC_STATUSES, RESPONSIBLE_SUGGESTIONS,
  type Fair, type DocumentItem,
} from "@/lib/store";
import {
  ACCEPTED_DOC_FILES, docSignedUrl, documentAlerts, fairDocuments, removeDocFile, uploadDocFile,
} from "@/lib/fair-documents";

const ALL = "__all__";

export function FairDocumentsTab({ fair }: { fair: Fair }) {
  const docs = useMemo(() => fairDocuments(fair), [fair]);
  const alerts = useMemo(() => documentAlerts(fair), [fair]);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [showArchived, setShowArchived] = useState(false);

  const upd = (id: string, patch: Partial<DocumentItem>) =>
    actions.updateChild(fair.id, "documents", (l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const del = async (d: DocumentItem) => {
    await removeDocFile(d.filePath);
    actions.updateChild(fair.id, "documents", (l) => l.filter((i) => i.id !== d.id));
    toast.success("Documento excluído.");
  };

  const filtered = docs.filter((d) => {
    if (!showArchived && d.archived) return false;
    if (cat !== ALL && d.category !== cat) return false;
    if (status !== ALL && d.status !== status) return false;
    if (q.trim()) {
      const t = `${d.name} ${d.supplier ?? ""} ${d.notes ?? ""}`.toLowerCase();
      if (!t.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <Card className="ccm-rise border-warning/40 bg-warning/5">
          <CardContent className="space-y-1.5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas de documentação
            </div>
            <ul className="space-y-1">
              {alerts.map((a) => (
                <li key={a.key} className={cn(
                  "text-sm",
                  a.severity === "critical" ? "text-destructive" : a.severity === "warning" ? "text-warning" : "text-muted-foreground",
                )}>
                  • {a.label}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="ccm-lift">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, fornecedor ou observação" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as categorias</SelectItem>
                {FAIR_DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {FAIR_DOC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
            <Archive className="h-4 w-4" /> {showArchived ? "Ocultar arquivados" : "Ver arquivados"}
          </Button>
          <NewDocumentDialog fair={fair} />
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="ccm-lift"><CardContent className="p-0">
          <EmptyState icon={<Paperclip className="h-6 w-6" />} title="Nenhum documento encontrado" description="Adicione contratos, manuais, comprovantes e arquivos da feira nesta central." action={<NewDocumentDialog fair={fair} />} />
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DocumentCard key={d.id} fair={fair} doc={d} onUpdate={(p) => upd(d.id, p)} onDelete={() => void del(d)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileTypeIcon({ name, type }: { name?: string; type?: string }) {
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  const cls = "h-3.5 w-3.5";
  if (ext === "pdf" || type?.includes("pdf")) return <FileText className={cn(cls, "text-destructive")} />;
  if (["doc", "docx"].includes(ext)) return <FileText className={cn(cls, "text-info")} />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className={cn(cls, "text-success")} />;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return <ImageIcon className={cn(cls, "text-primary")} />;
  return <FileIcon className={cn(cls, "text-muted-foreground")} />;
}

function dueTone(d: DocumentItem) {
  if (d.status === "Pago" || d.status === "Arquivado" || d.status === "Aprovado") return "text-success";
  const dd = daysUntil(d.dueDate);
  if (dd == null) return "text-muted-foreground";
  if (dd < 0) return "text-destructive";
  if (dd <= 3) return "text-warning";
  return "text-info";
}

function DocumentCard({
  fair, doc, onUpdate, onDelete,
}: { fair: Fair; doc: DocumentItem; onUpdate: (p: Partial<DocumentItem>) => void; onDelete: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function attach(file?: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      await removeDocFile(doc.filePath);
      const up = await uploadDocFile(fair.id, file);
      onUpdate({ filePath: up.path, fileName: up.name, fileType: up.type });
      toast.success("Arquivo anexado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao anexar o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  async function open(download = false) {
    if (!doc.filePath) return;
    try {
      const url = await docSignedUrl(doc.filePath);
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName ?? "documento";
        a.click();
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch {
      toast.error("Não foi possível abrir o arquivo.");
    }
  }

  return (
    <Card className={cn("ccm-rise ccm-lift", doc.archived && "opacity-60")}>
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Nome do documento</Label>
            <Input value={doc.name} onChange={(e) => onUpdate({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={doc.category ?? "Outro"} onValueChange={(v) => onUpdate({ category: v as DocumentItem["category"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FAIR_DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={doc.status} onValueChange={(v) => onUpdate({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FAIR_DOC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fornecedor / origem</Label>
            <Input value={doc.supplier ?? ""} onChange={(e) => onUpdate({ supplier: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data do documento</Label>
            <Input type="date" value={doc.docDate ?? ""} onChange={(e) => onUpdate({ docDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vencimento</Label>
            <Input type="date" value={doc.dueDate ?? ""} onChange={(e) => onUpdate({ dueDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Responsável</Label>
            <Select value={doc.responsible ?? "Marketing"} onValueChange={(v) => onUpdate({ responsible: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RESPONSIBLE_SUGGESTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Link externo (opcional)</Label>
            <Input placeholder="https://..." value={doc.link ?? ""} onChange={(e) => onUpdate({ link: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={1} value={doc.notes ?? ""} onChange={(e) => onUpdate({ notes: e.target.value })} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className={cn("text-xs font-medium", dueTone(doc))}>
            {doc.dueDate ? `Vencimento: ${fmtDate(doc.dueDate)}` : "Sem vencimento"}
          </span>
          {doc.filePath ? (
            <>
              <Badge variant="outline" className="ccm-pop max-w-[240px] gap-1 truncate text-[11px]">
                <FileTypeIcon name={doc.fileName} type={doc.fileType} /> {doc.fileName ?? "arquivo"}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => void open(false)}><ExternalLink className="h-4 w-4" /> Abrir</Button>
              <Button variant="outline" size="sm" onClick={() => void open(true)}><Download className="h-4 w-4" /> Baixar</Button>
            </>
          ) : (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">Sem arquivo anexado</Badge>
          )}
          {doc.link && (
            <Button variant="outline" size="sm" asChild>
              <a href={doc.link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Link</a>
            </Button>
          )}
          <input ref={fileRef} type="file" accept={ACCEPTED_DOC_FILES} className="hidden"
            onChange={(e) => void attach(e.target.files?.[0])} />
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" /> {doc.filePath ? "Substituir arquivo" : "Anexar arquivo"}
          </Button>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onUpdate({ archived: !doc.archived })}>
            <Archive className="h-4 w-4" /> {doc.archived ? "Reativar" : "Arquivar"}
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewDocumentDialog({ fair }: { fair: Fair }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(FAIR_DOC_CATEGORIES[0]);
  const [supplier, setSupplier] = useState("");
  const [docDate, setDocDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [responsible, setResponsible] = useState<string>("Marketing");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (!name.trim()) { toast.error("Informe o nome do documento."); return; }
    setBusy(true);
    try {
      let file: { path: string; name: string; type: string } | null = null;
      const f = fileRef.current?.files?.[0];
      if (f) file = await uploadDocFile(fair.id, f);
      actions.updateChild(fair.id, "documents", (l) => [
        ...l,
        {
          id: uid(),
          name: name.trim(),
          category: category as DocumentItem["category"],
          supplier, docDate, dueDate, responsible, notes,
          status: file ? "Recebido" : "Pendente",
          fairName: fair.name,
          createdAt: new Date().toISOString(),
          ...(file ? { filePath: file.path, fileName: file.name, fileType: file.type } : {}),
        },
      ]);
      toast.success("Documento cadastrado.");
      setOpen(false);
      setName(""); setSupplier(""); setDocDate(""); setDueDate(""); setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o documento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto"><Plus className="h-4 w-4" /> Novo documento</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo documento da feira</DialogTitle>
          <DialogDescription>Todos os arquivos da feira ficam centralizados aqui.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome do documento</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Contrato do espaço 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FAIR_DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fornecedor / origem</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data do documento</Label>
            <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vencimento</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={responsible} onValueChange={setResponsible}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RESPONSIBLE_SUGGESTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Arquivo (PDF, Word, Excel ou imagem)</Label>
            <Input ref={fileRef} type="file" accept={ACCEPTED_DOC_FILES} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={busy}>Salvar documento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
