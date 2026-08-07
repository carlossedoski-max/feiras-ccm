import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Loader2, Copy, Download, Trash2, Image as ImageIcon, Wand2, MessageSquare,
  CalendarPlus, Building2, Save, Upload, History, FileText,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import {
  downloadDoc, historyEntry, patchProject, projectSignedUrl, uploadProjectFile,
  type ImageProject, type ProjectHistoryEntry,
} from "@/lib/image-projects";
import {
  AMBIENCES, BRAND_FIDELITY, BUDGET_TIERS, IMAGE_STYLES, IMAGE_ORIGINS, PERIODS, QUOTE_STATUSES,
  REQUIRED_ITEMS, TARGET_BUDGETS, VARIATIONS, VERSION_STATUSES,
  deleteRender, fetchRenders, insertRender, patchRender, renderToText, supplierMessage,
  type ProjectRender,
} from "@/lib/project-renders";
import { generateConceptImage, generateConceptPrompt } from "@/lib/project-image.functions";
import { buildTemplatePrompt } from "@/lib/templates";
import { AiConfigCard } from "@/components/ai-config-card";
import { fetchSuppliers, type Supplier } from "@/lib/suppliers";
import { actions, createEmptyFair } from "@/lib/store";

const NONE = "__none__";

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado.`),
    () => toast.error("Não foi possível copiar."),
  );
}

export function ConceptImageTab({
  project, briefing, onBriefingChange,
}: { project: ImageProject; briefing: string; onBriefingChange: (v: string) => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [editBriefing, setEditBriefing] = useState(false);

  const [style, setStyle] = useState<string>(IMAGE_STYLES[2]);
  const [period, setPeriod] = useState<string>(PERIODS[0]);
  const [ambience, setAmbience] = useState<string>(AMBIENCES[0]);
  const [budgetTier, setBudgetTier] = useState<string>(project.budget_tier ?? BUDGET_TIERS[1]);
  const [targetBudget, setTargetBudget] = useState<string>(project.target_budget ?? TARGET_BUDGETS[1]);
  const [fairType, setFairType] = useState<string>(project.fair_type ?? "");
  const [mainBrand, setMainBrand] = useState<string>(project.main_brand ?? "CCM do Brasil / Kawashima");
  const [brandColors, setBrandColors] = useState("Vermelho CCM, azul Kawashima, branco e grafite");
  const [extraNotes, setExtraNotes] = useState("");
  const [brandFidelity, setBrandFidelity] = useState<string>(BRAND_FIDELITY[0]);
  const [required, setRequired] = useState<string[]>(project.required_items ?? []);
  const [responsible, setResponsible] = useState(project.responsible ?? "Marketing");

  const [promptText, setPromptText] = useState("");
  const [promptSource, setPromptSource] = useState<string>("");
  const [promptSummary, setPromptSummary] = useState("");
  const [definedItems, setDefinedItems] = useState<string[]>([]);
  const [aiItems, setAiItems] = useState<string[]>([]);

  const { data: renders = [], isLoading } = useQuery({
    queryKey: ["project_renders", project.id],
    queryFn: () => fetchRenders(project.id),
  });

  const saveProject = useMutation({
    mutationFn: (patch: Partial<ImageProject>) => patchProject(project.id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["image_projects"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const history = project.history ?? [];
  const pushHistory = (e: Omit<ProjectHistoryEntry, "id" | "at">) =>
    saveProject.mutate({ history: [historyEntry(e), ...history].slice(0, 60) });

  function toggleItem(item: string) {
    setRequired((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
  }

  function templateData(variationHint?: string) {
    return {
      fairName: project.related_fair || project.name,
      city: project.city ?? "",
      state: project.state ?? "",
      area: project.notes ?? "",
      objective: project.objective ?? "",
      style, period, ambience, budgetTier, targetBudget,
      mainBrand, brandColors,
      brandFidelity,
      fairType,
      requiredItems: required,
      notes: [extraNotes, variationHint].filter(Boolean).join(" "),
    };
  }

  /** TEMPLATE — não usa IA, não consome nenhum crédito. */
  function promptByTemplate(variation?: { label: string; hint: string }) {
    const text = buildTemplatePrompt(templateData(variation?.hint));
    setPromptText(text);
    setPromptSource("Template (sem consumo de crédito)");
    setPromptSummary("");
    setDefinedItems(required);
    setAiItems([]);
    pushHistory({ action: "Prompt por template gerado", status: "Prompt por template gerado", mode: "Template" });
    toast.success("Prompt profissional gerado por template.");
  }

  /** IA de TEXTO — nunca chama API de imagem. */
  async function promptByAi(variation?: { label: string; hint: string }) {
    setBusy("prompt");
    try {
      const res = await generateConceptPrompt({
        data: {
          briefing, style, period, ambience, budgetTier, targetBudget, fairType,
          city: project.city ?? "", state: project.state ?? "",
          mainBrand, requiredItems: required, extraNotes,
          variationHint: variation?.hint ?? "", brandFidelity, mode: "auto",
        },
      });
      setPromptText(res.prompt);
      setPromptSource(`${res.provider} · ${res.model}`);
      setPromptSummary(res.visualSummary);
      setDefinedItems(res.definedItems);
      setAiItems(res.aiItems);
      pushHistory({
        action: "Prompt gerado com IA",
        status: res.provider === "OpenAI API" ? "Análise com OpenAI concluída" : "Prompt gerado com IA",
        mode: res.provider === "OpenAI API" ? "OpenAI API" : "Lovable AI",
        model: res.model,
      });
      toast.success("Prompt gerado com IA.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao gerar o prompt.";
      pushHistory({ action: "Prompt com IA", status: "Erro na API", mode: "OpenAI API", error: msg });
      toast.error(`${msg} Gerando prompt por template…`);
      promptByTemplate(variation);
    } finally {
      setBusy(null);
    }
  }

  /** IMAGEM — separado do prompt; só roda com confirmação explícita. */
  async function makeImage(variation?: { label: string; hint: string }) {
    let prompt = promptText.trim();
    if (!prompt) {
      prompt = buildTemplatePrompt(templateData(variation?.hint));
      setPromptText(prompt);
      setPromptSource("Template (sem consumo de crédito)");
    }
    setBusy(variation?.label ?? "image");
    try {
      const res = await generateConceptImage({ data: { projectId: project.id, prompt } });
      const nextVersion = (renders[0]?.version ?? 0) + 1;
      await insertRender({
        project_id: project.id,
        version: nextVersion,
        label: variation?.label ?? "Projeto inicial",
        image_path: res.imagePath,
        image_type: "image/png",
        prompt,
        briefing,
        style, period, ambience,
        budget_tier: budgetTier,
        target_budget: targetBudget,
        fair_type: fairType,
        city: project.city, state: project.state,
        main_brand: mainBrand,
        required_items: required,
        defined_items: definedItems,
        ai_items: aiItems,
        visual_summary: promptSummary,
        notes: extraNotes,
        responsible,
        status: "Rascunho",
        origin: "Gerada pela ferramenta",
        mode: res.provider,
      });
      await saveProject.mutateAsync({
        briefing, budget_tier: budgetTier, target_budget: targetBudget,
        fair_type: fairType, main_brand: mainBrand, required_items: required,
        history: [historyEntry({ action: "Imagem conceitual gerada", status: "Imagem gerada", mode: res.provider === "OpenAI API" ? "OpenAI API" : "Lovable AI" }), ...history].slice(0, 60),
      });
      qc.invalidateQueries({ queryKey: ["project_renders", project.id] });
      toast.success(`Versão ${nextVersion} gerada.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao gerar a imagem.";
      pushHistory({ action: "Geração de imagem", status: "Créditos insuficientes / erro na API", mode: "OpenAI API", error: msg });
      toast.error(`${msg} Os créditos de imagem estão indisponíveis, mas o prompt continua salvo para uso posterior.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <AiConfigCard />

      <Card><CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4" /> Prompt e imagem do projeto</div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditBriefing((v) => !v)}>
            {editBriefing ? "Ocultar briefing" : "Editar briefing"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => saveProject.mutate({ briefing })}><Save className="h-4 w-4" /> Salvar briefing</Button>
        </div>

        {editBriefing && (
          <Textarea rows={14} value={briefing} onChange={(e) => onBriefingChange(e.target.value)}
            className="font-mono text-sm" placeholder="Briefing técnico usado como base para a imagem." />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Estilo visual da imagem">
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{IMAGE_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Período do evento">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Ambiente">
            <Select value={ambience} onValueChange={setAmbience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AMBIENCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Faixa de orçamento">
            <Select value={budgetTier} onValueChange={setBudgetTier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BUDGET_TIERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Orçamento-alvo do projeto">
            <Select value={targetBudget} onValueChange={setTargetBudget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TARGET_BUDGETS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de feira">
            <Input value={fairType} onChange={(e) => setFairType(e.target.value)} placeholder="Ex.: Agropecuária, industrial" />
          </Field>
          <Field label="Cidade/UF">
            <Input value={[project.city, project.state].filter(Boolean).join("/")} readOnly className="bg-muted/50" />
          </Field>
          <Field label="Marca principal">
            <Input value={mainBrand} onChange={(e) => setMainBrand(e.target.value)} />
          </Field>
          <Field label="Cores da marca">
            <Input value={brandColors} onChange={(e) => setBrandColors(e.target.value)} />
          </Field>
          <Field label="Fidelidade de marca">
            <Select value={brandFidelity} onValueChange={setBrandFidelity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BRAND_FIDELITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Responsável">
            <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Observações extras do usuário">
              <Textarea rows={2} value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)}
                placeholder="Ex.: manter depósito dentro da tenda e painel com 4 TVs na parede do fundo." />
            </Field>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Itens obrigatórios do projeto</Label>
          <p className="text-xs text-muted-foreground">A imagem deve respeitar estes itens sempre que possível.</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {REQUIRED_ITEMS.map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                <Checkbox checked={required.includes(item)} onCheckedChange={() => toggleItem(item)} />
                <span className="leading-tight">{item}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ---- Ações separadas: prompt x imagem ---- */}
        <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" /> Gerar prompt profissional</div>
            <p className="text-xs text-muted-foreground">Não consome crédito de imagem. Funciona mesmo sem IA disponível.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => promptByTemplate()}>
                <Wand2 className="h-4 w-4" /> Gerar por template
              </Button>
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => promptByAi()}>
                {busy === "prompt" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar com IA
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><ImageIcon className="h-4 w-4" /> Gerar imagem conceitual</div>
            <p className="text-xs text-muted-foreground">Esta ação pode consumir crédito/API de imagem.</p>
            <div className="flex flex-wrap gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={busy !== null}>
                    {busy === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar imagem conceitual
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Gerar imagem conceitual?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação pode gerar consumo na API configurada ou nos créditos de imagem. Se preferir, gere apenas o prompt — ele não consome crédito de imagem.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <Button variant="outline" onClick={() => promptByTemplate()}>Gerar apenas prompt</Button>
                    <AlertDialogAction onClick={() => void makeImage()}>Continuar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <ManualImageUpload
                project={project}
                nextVersion={(renders[0]?.version ?? 0) + 1}
                briefing={briefing}
                responsible={responsible}
                onDone={(entry) => {
                  qc.invalidateQueries({ queryKey: ["project_renders", project.id] });
                  pushHistory(entry);
                }}
              />
            </div>
          </div>
        </div>

        {promptText && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm font-semibold">Prompt gerado</Label>
              {promptSource && <Badge variant="outline" className="text-[11px]">{promptSource}</Badge>}
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => copy(promptText, "Prompt")}>
                <Copy className="h-4 w-4" /> Copiar prompt
              </Button>
              <Button size="sm" variant="outline" onClick={() => { saveProject.mutate({ briefing, history: [historyEntry({ action: "Prompt salvo no projeto", status: "Prompt salvo", mode: "Template", detail: promptText.slice(0, 500) }), ...history].slice(0, 60) }); toast.success("Prompt salvo no projeto."); }}>
                <Save className="h-4 w-4" /> Salvar prompt no projeto
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPromptText("")}>Fechar</Button>
            </div>
            <Textarea rows={7} value={promptText} onChange={(e) => setPromptText(e.target.value)} className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">
              Você pode editar o prompt acima antes de gerar a imagem, copiá-lo para usar em outra ferramenta ou enviar a imagem manualmente depois.
            </p>
            {promptSummary && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{promptSummary}</p>}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <Label>Variações</Label>
          <p className="text-xs text-muted-foreground">Gera o prompt da variação. Depois use “Gerar imagem conceitual” se quiser a imagem.</p>
          <div className="flex flex-wrap gap-2">
            {VARIATIONS.map((v) => (
              <Button key={v.label} variant="outline" size="sm" disabled={busy !== null} onClick={() => promptByTemplate(v)}>
                <Wand2 className="h-4 w-4" /> {v.label}
              </Button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Imagem meramente conceitual — não substitui projeto executivo, planta técnica, ART/RRT ou medidas finais da montadora.
        </p>
      </CardContent></Card>

      <SupplierLink project={project} onSave={(patch) => saveProject.mutate(patch)} />

      <ReuseFairButton project={project} />

      <HistoryCard history={history} />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando versões…</div>
      ) : renders.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <ImageIcon className="h-9 w-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma imagem conceitual gerada ainda.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Histórico de versões ({renders.length})</h3>
          {renders.map((r) => (
            <RenderCard key={r.id} render={r} project={project}
              onChanged={() => qc.invalidateQueries({ queryKey: ["project_renders", project.id] })} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Upload manual de imagem ---------- */
function ManualImageUpload({
  project, nextVersion, briefing, responsible, onDone,
}: {
  project: ImageProject;
  nextVersion: number;
  briefing: string;
  responsible: string;
  onDone: (e: Omit<ProjectHistoryEntry, "id" | "at">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("Imagem enviada manualmente");
  const [origin, setOrigin] = useState<string>(IMAGE_ORIGINS[1]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Selecione uma imagem."); return; }
    setBusy(true);
    try {
      const up = await uploadProjectFile(file);
      await insertRender({
        project_id: project.id,
        version: nextVersion,
        label: label || "Imagem enviada manualmente",
        image_path: up.path,
        image_type: up.type || "image/png",
        briefing,
        notes,
        responsible,
        status: "Rascunho",
        origin,
        mode: "Manual",
        required_items: project.required_items ?? [],
        defined_items: [],
        ai_items: [],
      });
      onDone({ action: "Imagem enviada manualmente", status: "Imagem enviada manualmente", mode: "Manual", detail: `${label} · ${origin}` });
      toast.success("Imagem enviada e salva no histórico.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="h-4 w-4" /> Enviar imagem manualmente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar imagem manualmente</DialogTitle>
          <DialogDescription>Use uma imagem criada fora da ferramenta. Ela entra no histórico de versões normalmente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Arquivo de imagem">
            <Input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" />
          </Field>
          <Field label="Nome da versão"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <Field label="Origem da imagem">
            <Select value={origin} onValueChange={setOrigin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{IMAGE_ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Observações"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Salvar imagem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Histórico de tentativas ---------- */
function HistoryCard({ history }: { history: ProjectHistoryEntry[] }) {
  if (!history.length) return null;
  return (
    <Card><CardContent className="space-y-2 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4" /> Histórico de tentativas ({history.length})</div>
      <div className="max-h-72 space-y-1.5 overflow-auto">
        {history.map((h) => (
          <div key={h.id} className="rounded-md border p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{h.action}</span>
              <Badge variant="outline" className="text-[10px]">{h.mode}</Badge>
              <span className="text-muted-foreground">{new Date(h.at).toLocaleString("pt-BR")}</span>
              <span className={cn("ml-auto", h.error ? "text-destructive" : "text-muted-foreground")}>{h.status}</span>
            </div>
            {h.error && <p className="mt-1 text-destructive">{h.error}</p>}
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}


/* ---------- Version card ---------- */
function RenderCard({
  render: r, project, onChanged,
}: { render: ProjectRender; project: ImageProject; onChanged: () => void }) {
  const [url, setUrl] = useState<string>("");
  const [notes, setNotes] = useState(r.notes ?? "");

  useEffect(() => {
    let alive = true;
    projectSignedUrl(r.image_path).then((u) => { if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [r.image_path]);

  const text = useMemo(() => renderToText(r, project.name), [r, project.name]);

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              <img src={url} alt={`Imagem conceitual do estande — versão ${r.version} (${r.label})`} loading="lazy"
                className="w-full rounded-md border object-cover" />
            </a>
          ) : (
            <div className="grid h-48 w-full place-items-center rounded-md bg-muted text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild disabled={!url}>
              <a href={url} download={`versao-${r.version}-${project.name}.png`}><Download className="h-4 w-4" /> Baixar imagem</a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(text, "Resumo da versão")}><Copy className="h-4 w-4" /> Copiar</Button>
            <Button variant="outline" size="sm"
              onClick={() => downloadDoc(`versao-${r.version}-${project.name}.doc`, `Versão ${r.version} — ${project.name}`, text)}>
              <Download className="h-4 w-4" /> Exportar Word
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { await deleteRender(r); onChanged(); toast.success("Versão excluída."); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Versão {r.version}</Badge>
            <strong className="text-sm">{r.label}</strong>
            <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
            <Select value={r.status} onValueChange={async (v) => { await patchRender(r.id, { status: v }); onChanged(); }}>
              <SelectTrigger className="ml-auto h-8 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>{VERSION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            {r.style} · {r.period} · {r.ambience} · {r.budget_tier} · {r.target_budget} · Responsável: {r.responsible || "—"}
          </p>

          {r.visual_summary && (
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Resumo visual do projeto</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{r.visual_summary}</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <ItemList title="Definido no briefing" items={r.defined_items} tone="primary" />
            <ItemList title="Interpretado automaticamente pela IA" items={r.ai_items} tone="info" />
          </div>

          {r.required_items?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.required_items.map((i) => <Badge key={i} variant="outline" className="text-[11px]">{i}</Badge>)}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label className="text-xs">Observações da versão</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8" />
            </div>
            <Button variant="outline" size="sm" onClick={async () => { await patchRender(r.id, { notes }); onChanged(); toast.success("Observação salva."); }}>
              <Save className="h-4 w-4" /> Salvar
            </Button>
            <SupplierMessageButton project={project} />
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">Briefing utilizado nesta versão</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{r.briefing || "—"}</pre>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemList({ title, items, tone }: { title: string; items: string[]; tone: "primary" | "info" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      {items?.length ? (
        <ul className="mt-1.5 space-y-1">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone === "primary" ? "bg-primary" : "bg-info")} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-sm text-muted-foreground">—</p>}
    </div>
  );
}

/* ---------- Supplier link ---------- */
function SupplierLink({ project, onSave }: { project: ImageProject; onSave: (p: Partial<ImageProject>) => void }) {
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const [supplierId, setSupplierId] = useState(project.supplier_id ?? NONE);
  const [sentAt, setSentAt] = useState(project.supplier_sent_at ?? "");
  const [quoteStatus, setQuoteStatus] = useState(project.quote_status ?? QUOTE_STATUSES[0]);
  const [value, setValue] = useState(project.estimated_value != null ? String(project.estimated_value) : "");
  const [notes, setNotes] = useState(project.supplier_notes ?? "");

  const montadoras = suppliers.filter((s) => s.service_type === "Montadora de estande");
  const list = montadoras.length ? montadoras : suppliers;

  return (
    <Card><CardContent className="space-y-3 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4" /> Montadora vinculada</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Montadora">
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {list.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data de envio do projeto">
          <Input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
        </Field>
        <Field label="Status do orçamento">
          <Select value={quoteStatus} onValueChange={setQuoteStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{QUOTE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Valor estimado (R$)">
          <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label="Observações da montadora">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <Button variant="outline" size="sm" onClick={() => onSave({
        supplier_id: supplierId === NONE ? null : supplierId,
        supplier_sent_at: sentAt || null,
        quote_status: quoteStatus,
        estimated_value: value ? Number(value.replace(",", ".")) : null,
        supplier_notes: notes || null,
      })}>
        <Save className="h-4 w-4" /> Salvar vínculo
      </Button>
    </CardContent></Card>
  );
}

function SupplierMessageButton({ project }: { project: ImageProject }) {
  const msg = supplierMessage(project.name, project.related_fair ?? "");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><MessageSquare className="h-4 w-4" /> Gerar mensagem para montadora</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mensagem para a montadora</DialogTitle>
          <DialogDescription>Copie e envie junto com o briefing e a imagem conceitual.</DialogDescription>
        </DialogHeader>
        <Textarea rows={14} readOnly value={msg} className="text-sm" />
        <Button onClick={() => copy(msg, "Mensagem")}><Copy className="h-4 w-4" /> Copiar mensagem</Button>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Reuse as new fair ---------- */
function ReuseFairButton({ project }: { project: ImageProject }) {
  const [name, setName] = useState(project.related_fair ? `${project.related_fair} ${new Date().getFullYear() + 1}` : project.name);
  const [open, setOpen] = useState(false);

  function create() {
    const improvements = project.comparison?.improve ?? [];
    const notes = [
      project.notes,
      project.briefing ? `BRIEFING BASE\n${project.briefing}` : "",
      improvements.length ? `PONTOS DE MELHORIA\n${improvements.map((i) => `- ${i}`).join("\n")}` : "",
      `Origem: projeto visual "${project.name}".`,
    ].filter(Boolean).join("\n\n");

    const fair = createEmptyFair({
      name: name.trim() || project.name,
      year: new Date().getFullYear() + 1,
      city: project.city ?? "",
      state: project.state ?? "",
      notes,
    });
    actions.addFair(fair);
    setOpen(false);
    toast.success("Nova feira criada a partir deste projeto.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><CalendarPlus className="h-4 w-4" /> Criar nova feira a partir deste projeto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova feira a partir do projeto</DialogTitle>
          <DialogDescription>
            Copia o briefing base, observações, pontos de melhoria e o checklist inicial para uma nova edição da feira.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Nome da nova feira</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button onClick={create}><CalendarPlus className="h-4 w-4" /> Criar feira</Button>
      </DialogContent>
    </Dialog>
  );
}
