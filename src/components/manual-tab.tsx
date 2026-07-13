import { useRef, useState } from "react";
import { Upload, Sparkles, FileText, CheckCircle2, AlertTriangle, Loader2, Info, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { analyzeExpoManual } from "@/lib/manual-ai.functions";
import {
  actions, uid, fmtDate, PRIORITIES, RESPONSIBLE_SUGGESTIONS,
  type Fair, type ManualAnalysis, type SuggestedTask, type Priority, type ChecklistItem,
} from "@/lib/store";

const ACCEPTED = ".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png";
const MAX_MB = 20;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function ManualTab({ fair }: { fair: Fair }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const analysis = fair.manualAnalysis;

  // Suggested-tasks review state (local until user confirms)
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, SuggestedTask>>({});

  function resetReview(a: ManualAnalysis) {
    const sel: Record<string, boolean> = {};
    const dr: Record<string, SuggestedTask> = {};
    for (const t of a.suggestedTasks) {
      if (a.addedTaskIds.includes(t.id)) continue;
      sel[t.id] = true;
      dr[t.id] = { ...t };
    }
    setSelected(sel);
    setDrafts(dr);
  }

  async function onAnalyze() {
    if (!file) { toast.error("Selecione um arquivo primeiro."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo maior que ${MAX_MB}MB.`); return; }
    setLoading(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const mime = file.type || "application/octet-stream";
      const result = await analyzeExpoManual({ data: { filename: file.name, mime, dataBase64 } });
      const suggested: SuggestedTask[] = (result.suggestedTasks ?? []).map(t => ({
        id: uid(),
        title: t.title,
        description: t.description,
        deadline: t.deadline || undefined,
        priority: (PRIORITIES as string[]).includes(t.priority) ? t.priority : "Média" as Priority,
        category: t.category || "Outros",
        responsible: t.responsible,
      }));
      const saved: ManualAnalysis = {
        filename: file.name,
        analyzedAt: new Date().toISOString(),
        summary: result.summary ?? "",
        deadlines: result.deadlines ?? [],
        allowed: result.allowed ?? [],
        forbidden: result.forbidden ?? [],
        fees: result.fees ?? [],
        documents: result.documents ?? [],
        assemblyRules: result.assemblyRules ?? [],
        disassemblyRules: result.disassemblyRules ?? [],
        attentionPoints: result.attentionPoints ?? [],
        suggestedTasks: suggested,
        addedTaskIds: [],
      };
      actions.updateFair(fair.id, { manualAnalysis: saved });
      resetReview(saved);
      toast.success("Manual analisado com sucesso!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao analisar manual.");
    } finally {
      setLoading(false);
    }
  }

  function addSelectedToChecklist() {
    if (!analysis) return;
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) { toast.error("Selecione ao menos uma tarefa."); return; }
    const newItems: ChecklistItem[] = ids.map(id => {
      const t = drafts[id] ?? analysis.suggestedTasks.find(s => s.id === id)!;
      return {
        id: uid(),
        phase: "Antes da feira",
        title: t.title,
        status: "Pendente",
        priority: t.priority,
        deadline: t.deadline,
        responsible: t.responsible,
        category: t.category,
        origin: "Manual do Expositor",
        notes: t.description,
      };
    });
    actions.updateChild(fair.id, "checklist", list => [...list, ...newItems]);
    actions.updateFair(fair.id, {
      manualAnalysis: { ...analysis, addedTaskIds: [...analysis.addedTaskIds, ...ids] },
    });
    const nextSel = { ...selected }; ids.forEach(i => delete nextSel[i]);
    setSelected(nextSel);
    toast.success(`${ids.length} tarefa(s) adicionadas ao checklist.`);
  }

  function ignoreSelected() {
    if (!analysis) return;
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    const nextSel = { ...selected }; ids.forEach(i => delete nextSel[i]);
    setSelected(nextSel);
    toast.info(`${ids.length} tarefa(s) ignoradas.`);
  }

  function clearAnalysis() {
    actions.updateFair(fair.id, { manualAnalysis: undefined });
    setFile(null);
    setSelected({});
    setDrafts({});
    if (inputRef.current) inputRef.current.value = "";
    toast.success("Análise removida.");
  }

  const pendingReview = analysis?.suggestedTasks.filter(t => !analysis.addedTaskIds.includes(t.id)) ?? [];

  return (
    <div className="space-y-4">
      {/* Aviso fixo */}
      <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>A análise por IA serve como apoio à organização da feira. Recomendamos conferir as informações principais diretamente no manual oficial do expositor.</span>
      </div>

      {/* Upload */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">IA do Manual do Expositor</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Envie aqui o manual do expositor da feira para que a IA identifique prazos, regras, taxas e pontos de atenção.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Arquivo (PDF, DOC, DOCX, JPG, PNG — até {MAX_MB}MB)</Label>
              <Input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="mt-1"
                disabled={loading}
              />
            </div>
            <Button onClick={onAnalyze} disabled={!file || loading} className="bg-primary hover:bg-primary-dark">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando…</> : <><Upload className="h-4 w-4" /> Analisar manual</>}
            </Button>
            {analysis && (
              <Button variant="outline" onClick={clearAnalysis} disabled={loading} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Limpar análise
              </Button>
            )}
          </div>
          {file && !loading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          )}
        </CardContent>
      </Card>

      {!analysis && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum manual analisado ainda. Envie um arquivo acima para começar.
        </CardContent></Card>
      )}

      {analysis && (
        <>
          {/* Header info */}
          <Card><CardContent className="p-4 flex flex-wrap gap-4 text-sm">
            <div><span className="text-muted-foreground">Arquivo:</span> <span className="font-medium">{analysis.filename}</span></div>
            <div><span className="text-muted-foreground">Analisado em:</span> <span className="font-medium">{new Date(analysis.analyzedAt).toLocaleString("pt-BR")}</span></div>
            <div><span className="text-muted-foreground">Tarefas adicionadas:</span> <span className="font-medium">{analysis.addedTaskIds.length} / {analysis.suggestedTasks.length}</span></div>
          </CardContent></Card>

          {/* Resumo */}
          <Section title="Resumo geral" icon={<FileText className="h-4 w-4" />}>
            <p className="text-sm whitespace-pre-wrap">{analysis.summary || "—"}</p>
          </Section>

          {/* Prazos */}
          <Section title={`Principais prazos (${analysis.deadlines.length})`} icon={<AlertTriangle className="h-4 w-4" />}>
            {analysis.deadlines.length === 0 ? <Empty /> : (
              <div className="space-y-2">
                {analysis.deadlines.map((d, i) => (
                  <div key={i} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">{d.description}</div>
                    <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                      <span><b>Prazo:</b> {d.date ? fmtDate(d.date) : "sem data"}</span>
                      <span><b>Importância:</b> {d.importance || "—"}</span>
                      <span><b>Consequência:</b> {d.consequence || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="O que pode" icon={<CheckCircle2 className="h-4 w-4 text-success" />}><BulletList items={analysis.allowed} /></Section>
            <Section title="O que não pode" icon={<AlertTriangle className="h-4 w-4 text-destructive" />}><BulletList items={analysis.forbidden} /></Section>
          </div>

          {/* Taxas */}
          <Section title={`Taxas e custos obrigatórios (${analysis.fees.length})`}>
            {analysis.fees.length === 0 ? <Empty /> : (
              <div className="space-y-2">
                {analysis.fees.map((f, i) => (
                  <div key={i} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">{f.name} {f.estimatedValue ? <span className="text-muted-foreground font-normal">— {f.estimatedValue}</span> : null}</div>
                    {f.description && <div className="mt-1 text-xs text-muted-foreground">{f.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Documentos exigidos"><BulletList items={analysis.documents} /></Section>
            <Section title="Pontos de atenção" icon={<AlertTriangle className="h-4 w-4 text-warning-foreground" />}><BulletList items={analysis.attentionPoints} /></Section>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Regras de montagem"><BulletList items={analysis.assemblyRules} /></Section>
            <Section title="Regras de desmontagem"><BulletList items={analysis.disassemblyRules} /></Section>
          </div>

          {/* Tarefas sugeridas */}
          <Section title={`Tarefas sugeridas para o checklist (${pendingReview.length} pendentes)`} icon={<Sparkles className="h-4 w-4 text-primary" />}>
            {pendingReview.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todas as tarefas foram revisadas. Reanalise o manual para gerar novas.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Revise, edite se necessário e adicione ao checklist da feira. A IA não adiciona automaticamente.</p>
                <div className="space-y-2">
                  {pendingReview.map(t => {
                    const d = drafts[t.id] ?? t;
                    const checked = !!selected[t.id];
                    return (
                      <div key={t.id} className="rounded-md border p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox checked={checked} onCheckedChange={v => setSelected(s => ({ ...s, [t.id]: v === true }))} className="mt-1" />
                          <div className="flex-1 grid gap-2 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <Label className="text-xs text-muted-foreground">Título</Label>
                              <Input value={d.title} onChange={e => setDrafts(s => ({ ...s, [t.id]: { ...d, title: e.target.value } }))} className="mt-1" />
                            </div>
                            <div className="sm:col-span-2">
                              <Label className="text-xs text-muted-foreground">Descrição</Label>
                              <Input value={d.description ?? ""} onChange={e => setDrafts(s => ({ ...s, [t.id]: { ...d, description: e.target.value } }))} className="mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Prazo</Label>
                              <Input type="date" value={d.deadline ?? ""} onChange={e => setDrafts(s => ({ ...s, [t.id]: { ...d, deadline: e.target.value } }))} className="mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Prioridade</Label>
                              <Select value={d.priority} onValueChange={v => setDrafts(s => ({ ...s, [t.id]: { ...d, priority: v as Priority } }))}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Categoria</Label>
                              <Input value={d.category} onChange={e => setDrafts(s => ({ ...s, [t.id]: { ...d, category: e.target.value } }))} className="mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Responsável sugerido</Label>
                              <Input
                                list="responsible-suggestions-manual"
                                value={d.responsible ?? ""}
                                onChange={e => setDrafts(s => ({ ...s, [t.id]: { ...d, responsible: e.target.value } }))}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">Origem: Manual do Expositor</div>
                      </div>
                    );
                  })}
                </div>
                <datalist id="responsible-suggestions-manual">
                  {RESPONSIBLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={addSelectedToChecklist} className="bg-primary hover:bg-primary-dark">
                    <CheckCircle2 className="h-4 w-4" /> Adicionar tarefas selecionadas ao checklist
                  </Button>
                  <Button variant="outline" onClick={ignoreSelected}>Ignorar tarefas selecionadas</Button>
                </div>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {icon} {title}
        </h3>
        {children}
      </CardContent>
    </Card>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <Empty />;
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}
function Empty() { return <p className="text-sm text-muted-foreground">Nada identificado pela IA.</p>; }
