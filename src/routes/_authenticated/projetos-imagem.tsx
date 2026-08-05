import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Images, Upload, Sparkles, FileText, ListChecks, Send, Copy, Download, Trash2, Loader2,
  Search, X, Eye, Save, ArrowLeft, AlertTriangle, CheckCircle2, Lightbulb, HelpCircle, Layers,
} from "lucide-react";
import {
  ACCEPTED_PROJECT_FILES, COMPLEXITY_LEVELS, PROJECT_STATUSES, UF_LIST,
  analysisToText, checklistToText, createProject, deleteProject, downloadDoc, downloadText,
  emptyProject, fetchProjects, fileToBase64, patchProject, projectSignedUrl, removeProjectFile,
  uploadProjectFile,
  type ChecklistRow, type ImageProject, type ImageProjectInput, type ProjectImage,
} from "@/lib/image-projects";
import { analyzeProjectImages, generateProjectDoc } from "@/lib/project-ai.functions";
import { fmtDate } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projetos-imagem")({
  head: () => ({
    meta: [
      { title: "Projetos por Imagem | CCM Feira Control" },
      { name: "description", content: "Envie fotos de feiras anteriores e referências de estandes e gere briefing técnico, checklist de montagem e resumo para cotação com apoio de IA." },
      { property: "og:title", content: "Projetos por Imagem | CCM Feira Control" },
      { property: "og:description", content: "Briefing técnico, checklist de montagem e resumo para cotação gerados a partir de fotos de estandes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

const ALL = "__all__";
const MAX_MB = 15;
const MAX_FILES = 8;

const STATUS_COLORS: Record<string, string> = {
  "Rascunho": "bg-muted text-foreground",
  "Em análise": "bg-info/15 text-info border-info/40",
  "Enviado para montadora": "bg-primary/15 text-primary border-primary/40",
  "Aguardando orçamento": "bg-warning/15 text-warning-foreground border-warning/40",
  "Aprovado": "bg-success/15 text-success border-success/40",
  "Arquivado": "bg-secondary/15 text-secondary-foreground border-secondary/30",
};

const COMPLEXITY_COLORS: Record<string, string> = {
  "Simples": "bg-success/15 text-success border-success/40",
  "Intermediário": "bg-info/15 text-info border-info/40",
  "Complexo": "bg-warning/15 text-warning-foreground border-warning/40",
  "Premium": "bg-primary/15 text-primary border-primary/40",
};

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado.`),
    () => toast.error("Não foi possível copiar."),
  );
}

function metaOf(p: ImageProject | ImageProjectInput) {
  return {
    name: p.name ?? "",
    relatedFair: p.related_fair ?? "",
    referenceYear: p.reference_year ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    objective: p.objective ?? "",
    notes: p.notes ?? "",
  };
}

/* ---------------- Page ---------------- */
function ProjectsPage() {
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["image_projects"], queryFn: fetchProjects });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(ALL);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== ALL && p.status !== status) return false;
      if (!term) return true;
      return [p.name, p.related_fair, p.city, p.objective].some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [projects, q, status]);

  const current = projects.find((p) => p.id === openId) ?? null;

  if (creating) {
    return (
      <NewProject
        onCancel={() => setCreating(false)}
        onCreated={(p) => {
          qc.invalidateQueries({ queryKey: ["image_projects"] });
          setCreating(false);
          setOpenId(p.id);
        }}
      />
    );
  }

  if (current) {
    return <ProjectDetail project={current} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projetos por Imagem</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Envie fotos de feiras anteriores ou referências de estandes para gerar briefing, checklist e ideias de
            projeto para futuras feiras.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Upload className="h-4 w-4" /> Novo projeto
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar projeto, feira ou cidade" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando projetos…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <Images className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum projeto ainda. Envie fotos de um estande para começar.</p>
          <Button onClick={() => setCreating(true)}><Upload className="h-4 w-4" /> Novo projeto</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setOpenId(p.id)}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  <Badge variant="outline" className={cn("border whitespace-nowrap", STATUS_COLORS[p.status] ?? "bg-muted")}>{p.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.related_fair || "Sem feira vinculada"} · {p.reference_year || "—"} · {[p.city, p.state].filter(Boolean).join("/") || "—"}
                </p>
                {p.objective && <p className="line-clamp-2 text-sm text-muted-foreground">{p.objective}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Images className="h-3.5 w-3.5" />{p.images?.length ?? 0} arquivo(s)</span>
                  {p.complexity && <Badge variant="outline" className={cn("border", COMPLEXITY_COLORS[p.complexity] ?? "bg-muted")}>{p.complexity}</Badge>}
                  {p.briefing && <Badge variant="outline" className="border">Briefing</Badge>}
                  {p.checklist?.length ? <Badge variant="outline" className="border">Checklist</Badge> : null}
                  <span className="ml-auto">{fmtDate(p.created_at.slice(0, 10))}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- New project ---------------- */
function NewProject({ onCancel, onCreated }: { onCancel: () => void; onCreated: (p: ImageProject) => void }) {
  const [form, setForm] = useState<ImageProjectInput>(emptyProject());
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPTED_PROJECT_FILES.includes(f.type)) { toast.error(`${f.name}: formato não suportado.`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name}: maior que ${MAX_MB}MB.`); continue; }
      next.push(f);
    }
    setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
  }

  async function submit() {
    if (!form.name?.trim()) { toast.error("Informe o nome do projeto."); return; }
    if (files.length === 0) { toast.error("Envie ao menos uma imagem."); return; }
    setBusy(true);
    try {
      const images: ProjectImage[] = [];
      for (const f of files) images.push(await uploadProjectFile(f));
      const created = await createProject({ ...form, images });
      toast.success("Projeto criado.");
      onCreated(created);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar projeto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <h1 className="text-xl font-bold">Novo projeto por imagem</h1>
      </div>

      <Card><CardContent className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome do projeto *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Estande Expointer 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Feira relacionada</Label>
            <Input value={form.related_fair ?? ""} onChange={(e) => setForm({ ...form, related_fair: e.target.value })} placeholder="Ex.: Expointer" />
          </div>
          <div className="space-y-1.5">
            <Label>Ano da referência</Label>
            <Input value={form.reference_year ?? ""} onChange={(e) => setForm({ ...form, reference_year: e.target.value })} placeholder="Ex.: 2025" />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>UF</Label>
            <Select value={form.state || ALL} onValueChange={(v) => setForm({ ...form, state: v === ALL ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>—</SelectItem>
                {UF_LIST.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Objetivo do novo projeto</Label>
            <Textarea rows={2} value={form.objective ?? ""} onChange={(e) => setForm({ ...form, objective: e.target.value })}
              placeholder="Ex.: Criar briefing para Expointer 2026 com base nas fotos do estande do ano anterior." />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Imagens e referências (JPG, PNG, WEBP ou PDF — até {MAX_FILES} arquivos)</Label>
          <input ref={inputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            className="hidden" onChange={(e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }} />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Selecionar arquivos
          </Button>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{f.name}</span>
                  <button className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar projeto
          </Button>
        </div>
      </CardContent></Card>
    </div>
  );
}

/* ---------------- Detail ---------------- */
function ProjectDetail({ project, onBack }: { project: ImageProject; onBack: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [briefingDraft, setBriefingDraft] = useState(project.briefing ?? "");
  const [quoteDraft, setQuoteDraft] = useState(project.quote_summary ?? "");
  const [rows, setRows] = useState<ChecklistRow[]>(project.checklist ?? []);

  const save = useMutation({
    mutationFn: (patch: Partial<ImageProject>) => patchProject(project.id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["image_projects"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const remove = useMutation({
    mutationFn: () => deleteProject(project),
    onSuccess: () => { toast.success("Projeto excluído."); qc.invalidateQueries({ queryKey: ["image_projects"] }); onBack(); },
  });

  async function runAnalysis() {
    const imgs = (project.images ?? []).slice(0, MAX_FILES);
    if (imgs.length === 0) { toast.error("Este projeto não tem arquivos."); return; }
    setBusy("analyze");
    try {
      const media = [];
      for (const img of imgs) {
        const url = await projectSignedUrl(img.path);
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], img.name, { type: img.type || blob.type });
        media.push({ name: img.name, mime: file.type || "image/jpeg", dataBase64: await fileToBase64(file) });
      }
      const analysis = await analyzeProjectImages({ data: { media, meta: metaOf(project) } });
      await save.mutateAsync({
        analysis,
        comparison: analysis.comparison,
        complexity: analysis.complexity,
        complexity_reason: analysis.complexityReason,
        status: project.status === "Rascunho" ? "Em análise" : project.status,
      });
      toast.success("Análise concluída.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na análise.");
    } finally {
      setBusy(null);
    }
  }

  async function generate(kind: "briefing" | "checklist" | "quote") {
    if (!project.analysis) { toast.error("Analise as imagens primeiro."); return; }
    setBusy(kind);
    try {
      const res = await generateProjectDoc({ data: { kind, meta: metaOf(project), analysis: project.analysis } });
      if (kind === "checklist") {
        setRows(res.rows);
        await save.mutateAsync({ checklist: res.rows });
      } else if (kind === "briefing") {
        setBriefingDraft(res.text);
        await save.mutateAsync({ briefing: res.text });
      } else {
        setQuoteDraft(res.text);
        await save.mutateAsync({ quote_summary: res.text });
      }
      toast.success("Conteúdo gerado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar conteúdo.");
    } finally {
      setBusy(null);
    }
  }

  const a = project.analysis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <h1 className="text-xl font-bold">{project.name}</h1>
        {project.complexity && (
          <Badge variant="outline" className={cn("border", COMPLEXITY_COLORS[project.complexity] ?? "bg-muted")}>{project.complexity}</Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Select value={project.status} onValueChange={(v) => save.mutate({ status: v })}>
            <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                <AlertDialogDescription>As imagens e todo o conteúdo gerado serão removidos.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => remove.mutate()}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card><CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm text-muted-foreground">
        <span><strong className="text-foreground">Feira:</strong> {project.related_fair || "—"}</span>
        <span><strong className="text-foreground">Ano:</strong> {project.reference_year || "—"}</span>
        <span><strong className="text-foreground">Local:</strong> {[project.city, project.state].filter(Boolean).join("/") || "—"}</span>
        <span><strong className="text-foreground">Criado em:</strong> {fmtDate(project.created_at.slice(0, 10))}</span>
        {project.objective && <span className="w-full"><strong className="text-foreground">Objetivo:</strong> {project.objective}</span>}
      </CardContent></Card>

      <Tabs defaultValue="imagens">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="imagens">Imagens</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
          <TabsTrigger value="briefing">Briefing</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="cotacao">Cotação</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          <TabsTrigger value="imagem-conceitual">Imagem Conceitual</TabsTrigger>
        </TabsList>

        <TabsContent value="imagens" className="mt-4">
          <ImagesTab project={project} onChange={(images) => save.mutate({ images })} onAnalyze={runAnalysis} busy={busy === "analyze"} />
        </TabsContent>

        <TabsContent value="analise" className="mt-4 space-y-4">
          {!a ? (
            <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Sparkles className="h-9 w-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Ainda não há análise. Envie as imagens e clique em “Analisar imagens”.</p>
              <Button onClick={runAnalysis} disabled={busy === "analyze"}>
                {busy === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analisar imagens
              </Button>
            </CardContent></Card>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => copy(analysisToText(project), "Análise")}><Copy className="h-4 w-4" /> Copiar análise</Button>
                <Button variant="outline" size="sm" onClick={() => downloadDoc(`analise-${project.name}.doc`, `Análise — ${project.name}`, analysisToText(project))}><Download className="h-4 w-4" /> Word</Button>
                <Button variant="outline" size="sm" onClick={runAnalysis} disabled={busy === "analyze"}>
                  {busy === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Refazer análise
                </Button>
              </div>
              <ListBlock title="Elementos identificados na imagem" icon={<Eye className="h-4 w-4" />} items={a.identified} tone="identified" />
              <ListBlock title="Pontos positivos" icon={<CheckCircle2 className="h-4 w-4" />} items={a.positives} tone="good" />
              <ListBlock title="Pontos de melhoria" icon={<AlertTriangle className="h-4 w-4" />} items={a.improvements} tone="warn" />
              <ListBlock title="Itens ausentes ou pouco claros" icon={<HelpCircle className="h-4 w-4" />} items={a.missing} tone="muted" />
              <ListBlock title="Sugestões da IA" icon={<Lightbulb className="h-4 w-4" />} items={a.suggestions} tone="info" />
              <Card><CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4" /> Estimativa de complexidade</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={project.complexity ?? "Intermediário"} onValueChange={(v) => save.mutate({ complexity: v })}>
                    <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{COMPLEXITY_LEVELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">Classificação sugerida pela IA — ajuste se necessário.</span>
                </div>
                <p className="text-sm text-muted-foreground">{project.complexity_reason || a.complexityReason}</p>
              </CardContent></Card>
              <p className="text-xs text-muted-foreground">
                A IA apoia a análise, mas não substitui a validação humana. Medidas não confirmadas pelas imagens devem ser verificadas manualmente.
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="briefing" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => generate("briefing")} disabled={busy === "briefing"}>
              {busy === "briefing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Gerar briefing técnico
            </Button>
            <Button variant="outline" onClick={() => save.mutate({ briefing: briefingDraft })}><Save className="h-4 w-4" /> Salvar edição</Button>
            <Button variant="outline" onClick={() => copy(briefingDraft, "Briefing")}><Copy className="h-4 w-4" /> Copiar</Button>
            <Button variant="outline" onClick={() => downloadDoc(`briefing-${project.name}.doc`, `Briefing técnico — ${project.name}`, briefingDraft)}><Download className="h-4 w-4" /> Word</Button>
            <Button variant="outline" onClick={() => downloadText(`briefing-${project.name}.txt`, briefingDraft)}><Download className="h-4 w-4" /> TXT</Button>
          </div>
          <Textarea rows={26} value={briefingDraft} onChange={(e) => setBriefingDraft(e.target.value)}
            placeholder="O briefing gerado aparecerá aqui e pode ser editado antes de salvar ou enviar." className="font-mono text-sm" />
        </TabsContent>

        <TabsContent value="checklist" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => generate("checklist")} disabled={busy === "checklist"}>
              {busy === "checklist" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />} Gerar checklist da montagem
            </Button>
            <Button variant="outline" onClick={() => save.mutate({ checklist: rows })}><Save className="h-4 w-4" /> Salvar edição</Button>
            <Button variant="outline" onClick={() => copy(checklistToText(rows), "Checklist")}><Copy className="h-4 w-4" /> Copiar</Button>
            <Button variant="outline" onClick={() => downloadDoc(`checklist-${project.name}.doc`, `Checklist de montagem — ${project.name}`, checklistToText(rows))}><Download className="h-4 w-4" /> Word</Button>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum checklist gerado ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Item</th><th className="p-2">Descrição</th><th className="p-2">Responsável</th>
                    <th className="p-2">Status</th><th className="p-2">Observação</th><th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="p-2 font-medium">{r.item}</td>
                      <td className="p-2 text-muted-foreground">{r.description}</td>
                      <td className="p-2">
                        <Input value={r.responsible} className="h-8 w-32"
                          onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, responsible: e.target.value } : x)))} />
                      </td>
                      <td className="p-2">
                        <Select value={r.status || "Pendente"} onValueChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, status: v } : x)))}>
                          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Pendente", "Em andamento", "Concluído", "Não se aplica"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input value={r.note} className="h-8 min-w-[150px]"
                          onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                      </td>
                      <td className="p-2">
                        <button className="text-muted-foreground hover:text-destructive" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cotacao" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => generate("quote")} disabled={busy === "quote"}>
              {busy === "quote" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Gerar resumo para cotação
            </Button>
            <Button variant="outline" onClick={() => save.mutate({ quote_summary: quoteDraft })}><Save className="h-4 w-4" /> Salvar edição</Button>
            <Button variant="outline" onClick={() => copy(quoteDraft, "Resumo")}><Copy className="h-4 w-4" /> Copiar</Button>
            <Button variant="outline" onClick={() => downloadDoc(`cotacao-${project.name}.doc`, `Resumo para cotação — ${project.name}`, quoteDraft)}><Download className="h-4 w-4" /> Word</Button>
          </div>
          <Textarea rows={16} value={quoteDraft} onChange={(e) => setQuoteDraft(e.target.value)}
            placeholder="Resumo comercial curto para enviar a montadoras e fornecedores." className="text-sm" />
        </TabsContent>

        <TabsContent value="comparativo" className="mt-4 space-y-4">
          {!project.comparison ? (
            <p className="text-sm text-muted-foreground">Disponível após a análise das imagens.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Comparativo com a feira anterior{project.related_fair ? ` (${project.related_fair} ${project.reference_year ?? ""})` : ""}.
              </p>
              <ListBlock title="O que manter" items={project.comparison.keep} tone="good" />
              <ListBlock title="O que melhorar" items={project.comparison.improve} tone="warn" />
              <ListBlock title="O que remover" items={project.comparison.remove} tone="muted" />
              <ListBlock title="O que adicionar" items={project.comparison.add} tone="info" />
              <ListBlock title="Pontos de atenção" items={project.comparison.attention} tone="warn" />
              <ListBlock title="Ideias para reduzir custo" items={project.comparison.costIdeas} tone="good" />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Images tab ---------------- */
function ImagesTab({
  project, onChange, onAnalyze, busy,
}: { project: ImageProject; onChange: (images: ProjectImage[]) => void; onAnalyze: () => void; busy: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const img of project.images ?? []) {
        if (!img.type?.startsWith("image/")) continue;
        try { next[img.path] = await projectSignedUrl(img.path); } catch { /* ignore */ }
      }
      setUrls(next);
    })();
  }, [project.images]);

  async function addMore(list: FileList | null) {
    if (!list) return;
    setUploading(true);
    try {
      const added: ProjectImage[] = [];
      for (const f of Array.from(list)) {
        if (!ACCEPTED_PROJECT_FILES.includes(f.type)) { toast.error(`${f.name}: formato não suportado.`); continue; }
        if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name}: maior que ${MAX_MB}MB.`); continue; }
        added.push(await uploadProjectFile(f));
      }
      if (added.length) onChange([...(project.images ?? []), ...added]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input ref={inputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="hidden" onChange={(e) => { addMore(e.target.files); if (inputRef.current) inputRef.current.value = ""; }} />
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Adicionar arquivos
        </Button>
        <Button onClick={onAnalyze} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analisar imagens
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(project.images ?? []).map((img) => (
          <Card key={img.path} className="overflow-hidden">
            <CardContent className="space-y-2 p-2">
              {urls[img.path] ? (
                <img src={urls[img.path]} alt={`Referência de estande: ${img.name}`} loading="lazy" className="h-36 w-full rounded object-cover" />
              ) : (
                <div className="grid h-36 w-full place-items-center rounded bg-muted text-muted-foreground"><FileText className="h-8 w-8" /></div>
              )}
              <div className="flex items-center gap-1">
                <span className="truncate text-xs" title={img.name}>{img.name}</span>
                <button
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await removeProjectFile(img.path);
                    onChange((project.images ?? []).filter((i) => i.path !== img.path));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Shared ---------------- */
function ListBlock({
  title, items, icon, tone = "muted",
}: { title: string; items: string[]; icon?: React.ReactNode; tone?: "good" | "warn" | "info" | "muted" | "identified" }) {
  const dot: Record<string, string> = {
    good: "bg-success", warn: "bg-warning", info: "bg-info", muted: "bg-muted-foreground", identified: "bg-primary",
  };
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
        {items?.length ? (
          <ul className="space-y-1.5">
            {items.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot[tone])} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nada registrado.</p>
        )}
      </CardContent>
    </Card>
  );
}
