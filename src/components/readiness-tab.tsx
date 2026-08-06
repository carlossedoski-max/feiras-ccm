import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  actions, RESPONSIBLE_SUGGESTIONS, READINESS_STATUSES,
  type Fair, type ReadinessAnswer, type ReadinessEntry, type ReadinessState, type ReadinessStatus,
} from "@/lib/store";
import { READINESS_GROUPS, READINESS_STATUS_TONE, readinessSummary } from "@/lib/readiness";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const BUCKET = "fair-files";
const ANSWERS: ReadinessAnswer[] = ["Sim", "Não", "Não se aplica"];

const answerTone: Record<ReadinessAnswer, string> = {
  "Sim": "bg-success/15 text-success border-success/40",
  "Não": "bg-destructive/15 text-destructive border-destructive/40",
  "Não se aplica": "bg-muted text-muted-foreground border-border",
};

export function ReadinessTab({ fair }: { fair: Fair }) {
  const summary = readinessSummary(fair);
  const readiness: ReadinessState = fair.readiness ?? {};
  const status: ReadinessStatus = readiness.status ?? summary.suggestedStatus;
  const [confirmBy, setConfirmBy] = useState(fair.responsible ?? "Marketing");
  const [finalNotes, setFinalNotes] = useState(readiness.notes ?? "");

  const patch = (p: Partial<ReadinessState>) =>
    actions.updateFair(fair.id, { readiness: { ...readiness, ...p } });

  const setEntry = (itemId: string, entry: Partial<ReadinessEntry>) => {
    const items = { ...(readiness.items ?? {}) };
    items[itemId] = { ...items[itemId], ...entry };
    patch({ items });
  };

  const confirmReady = () => {
    const nextStatus = summary.canExecute ? "Pronta para execução" : summary.canShip ? "Pronta para envio" : "Em atenção";
    patch({
      status: nextStatus,
      confirmedAt: new Date().toISOString(),
      confirmedBy: confirmBy || "—",
      notes: finalNotes,
    });
    toast.success(`Confirmação registrada — ${nextStatus}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Feira pronta?</h2>
              <p className="text-sm text-muted-foreground">
                Checklist final de liberação antes do envio dos produtos e do início da montagem.
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${READINESS_STATUS_TONE[status]}`}>
              {status}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Itens conferidos" value={`${summary.answered}/${summary.total}`} />
            <Stat label="Concluídos" value={`${summary.percent}%`} />
            <Stat label="Pendências obrigatórias" value={String(summary.pendingRequired.length)} tone={summary.pendingRequired.length ? "text-destructive" : "text-success"} />
            <Stat label="Pendências para envio" value={String(summary.pendingShipping.length)} tone={summary.pendingShipping.length ? "text-warning-foreground" : "text-success"} />
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${summary.percent}%` }} />
          </div>

          {summary.pendingRequired.length > 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Atenção: a feira ainda possui pendências antes de ser considerada pronta.</p>
                <p className="mt-1 text-destructive/90">
                  {summary.pendingRequired.slice(0, 6).map((i) => i.label).join(" · ")}
                  {summary.pendingRequired.length > 6 ? ` · +${summary.pendingRequired.length - 6}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Todos os itens obrigatórios estão liberados.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Status manual da feira</Label>
              <Select value={status} onValueChange={(v) => patch({ status: v as ReadinessStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {READINESS_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} disabled={s === "Pronta para execução" && !summary.canExecute}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Sugestão automática: {summary.suggestedStatus}</p>
            </div>
            <div>
              <Label>Responsável pela confirmação</Label>
              <Input value={confirmBy} onChange={(e) => setConfirmBy(e.target.value)} list="readiness-resp" />
              <datalist id="readiness-resp">{RESPONSIBLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
            </div>
          </div>

          <div>
            <Label>Observações finais</Label>
            <Textarea rows={2} value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} placeholder="Observações da liberação da feira" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={confirmReady}><CheckCircle2 className="h-4 w-4" /> Confirmar feira pronta</Button>
            {readiness.confirmedAt && (
              <span className="text-xs text-muted-foreground">
                Última confirmação: {new Date(readiness.confirmedAt).toLocaleString("pt-BR")} por {readiness.confirmedBy || "—"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={[READINESS_GROUPS[0]!.id]} className="space-y-3">
        {READINESS_GROUPS.map((group) => {
          const done = group.items.filter((i) => {
            const a = fair.readiness?.items?.[i.id]?.answer;
            return a === "Sim" || a === "Não se aplica";
          }).length;
          return (
            <AccordionItem key={group.id} value={group.id} className="rounded-lg border bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex flex-1 items-center justify-between pr-3 text-left">
                  <span className="font-semibold">{group.title}</span>
                  <span className={`text-xs font-medium ${done === group.items.length ? "text-success" : "text-muted-foreground"}`}>
                    {done}/{group.items.length}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                {group.items.map((item) => (
                  <ReadinessRow
                    key={item.id}
                    fairId={fair.id}
                    itemId={item.id}
                    label={item.label}
                    required={!!item.required}
                    entry={fair.readiness?.items?.[item.id] ?? {}}
                    onChange={(e) => setEntry(item.id, e)}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function ReadinessRow({
  fairId, itemId, label, required, entry, onChange,
}: {
  fairId: string;
  itemId: string;
  label: string;
  required: boolean;
  entry: ReadinessEntry;
  onChange: (e: Partial<ReadinessEntry>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `readiness/${fairId}/${itemId}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (error) throw error;
      onChange({ filePath: path, fileName: file.name });
      toast.success("Arquivo anexado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao anexar arquivo");
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    if (!entry.filePath) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(entry.filePath, 3600);
    if (error || !data) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async () => {
    if (entry.filePath) await supabase.storage.from(BUCKET).remove([entry.filePath]);
    onChange({ filePath: undefined, fileName: undefined });
  };

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {label}
          {required && <span className="ml-1 text-xs text-destructive">*</span>}
        </span>
        <div className="flex gap-1">
          {ANSWERS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ answer: entry.answer === a ? undefined : a })}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                entry.answer === a ? answerTone[a] : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]">
        <Input
          className="h-8 text-xs"
          placeholder="Responsável"
          value={entry.responsible ?? ""}
          onChange={(e) => onChange({ responsible: e.target.value })}
        />
        <Input
          className="h-8 text-xs"
          placeholder="Observação"
          value={entry.note ?? ""}
          onChange={(e) => onChange({ note: e.target.value })}
        />
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
          />
          {entry.filePath ? (
            <>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={open}>
                <Paperclip className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate">{entry.fileName || "arquivo"}</span>
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => void remove()}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Anexar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
