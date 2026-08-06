import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Loader2, Copy, Download, Trash2, Image as ImageIcon, Wand2, MessageSquare,
  CalendarPlus, Building2, Save,
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
import { cn } from "@/lib/utils";

import {
  downloadDoc, patchProject, projectSignedUrl, type ImageProject,
} from "@/lib/image-projects";
import {
  AMBIENCES, BRAND_FIDELITY, BUDGET_TIERS, IMAGE_STYLES, PERIODS, QUOTE_STATUSES, REQUIRED_ITEMS,
  TARGET_BUDGETS, VARIATIONS, VERSION_STATUSES,
  deleteRender, fetchRenders, insertRender, patchRender, renderToText, supplierMessage,
  type ProjectRender,
} from "@/lib/project-renders";
import { generateConceptImage } from "@/lib/project-image.functions";
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
  const [extraNotes, setExtraNotes] = useState("");
  const [brandFidelity, setBrandFidelity] = useState<string>(BRAND_FIDELITY[0]);
  const [promptPreview, setPromptPreview] = useState<{ prompt: string; summary: string } | null>(null);
  const [required, setRequired] = useState<string[]>(project.required_items ?? []);
  const [responsible, setResponsible] = useState(project.responsible ?? "Marketing");

  const { data: renders = [], isLoading } = useQuery({
    queryKey: ["project_renders", project.id],
    queryFn: () => fetchRenders(project.id),
  });

  const saveProject = useMutation({
    mutationFn: (patch: Partial<ImageProject>) => patchProject(project.id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["image_projects"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  function toggleItem(item: string) {
    setRequired((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
  }

  async function generate(variation?: { label: string; hint: string }, promptOnly = false) {
    if (!briefing.trim()) { toast.error("Gere ou escreva o briefing técnico antes de criar a imagem."); return; }
    setBusy(promptOnly ? "prompt" : (variation?.label ?? "main"));
    try {
      const res = await generateConceptImage({
        data: {
          projectId: project.id,
          briefing,
          style,
          period,
          ambience,
          budgetTier,
          targetBudget,
          fairType,
          city: project.city ?? "",
          state: project.state ?? "",
          mainBrand,
          requiredItems: required,
          extraNotes,
          variationHint: variation?.hint ?? "",
          brandFidelity,
          promptOnly,
        },
      });
      if (promptOnly) {
        setPromptPreview({ prompt: res.prompt, summary: res.visualSummary });
        toast.success("Prompt gerado sem criar imagem.");
        return;
      }
      const nextVersion = (renders[0]?.version ?? 0) + 1;
      await insertRender({
        project_id: project.id,
        version: nextVersion,
        label: variation?.label ?? "Projeto inicial",
        image_path: res.imagePath,
        image_type: "image/png",
        prompt: res.prompt,
        briefing,
        style, period, ambience,
        budget_tier: budgetTier,
        target_budget: targetBudget,
        fair_type: fairType,
        city: project.city, state: project.state,
        main_brand: mainBrand,
        required_items: required,
        defined_items: res.definedItems,
        ai_items: res.aiItems,
        visual_summary: res.visualSummary,
        notes: extraNotes,
        responsible,
        status: "Rascunho",
      });
      await saveProject.mutateAsync({
        briefing,
        budget_tier: budgetTier,
        target_budget: targetBudget,
        fair_type: fairType,
        main_brand: mainBrand,
        required_items: required,
      });
      qc.invalidateQueries({ queryKey: ["project_renders", project.id] });
      toast.success(`Versão ${nextVersion} gerada.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a imagem.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4" /> Gerar imagem do projeto</div>
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

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={() => generate()} disabled={busy !== null}>
            {busy === "main" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar imagem conceitual
          </Button>
          <Button variant="outline" onClick={() => generate(undefined, true)} disabled={busy !== null}>
            {busy === "prompt" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Gerar apenas o prompt
          </Button>
          <span className="text-xs text-muted-foreground">Imagem meramente conceitual — não substitui projeto executivo, planta técnica, ART/RRT ou medidas finais da montadora.</span>
        </div>

        {promptPreview && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm font-semibold">Prompt gerado (sem criar imagem)</Label>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => copy(promptPreview.prompt, "Prompt")}>Copiar prompt</Button>
              <Button size="sm" variant="ghost" onClick={() => setPromptPreview(null)}>Fechar</Button>
            </div>
            <Textarea rows={6} readOnly value={promptPreview.prompt} className="font-mono text-xs" />
            {promptPreview.summary && (
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{promptPreview.summary}</p>
            )}
          </div>
        )}


        <div className="space-y-2 border-t pt-3">
          <Label>Variações</Label>
          <div className="flex flex-wrap gap-2">
            {VARIATIONS.map((v) => (
              <Button key={v.label} variant="outline" size="sm" disabled={busy !== null} onClick={() => generate(v)}>
                {busy === v.label ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {v.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent></Card>

      <SupplierLink project={project} onSave={(patch) => saveProject.mutate(patch)} />

      <ReuseFairButton project={project} />

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
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
