import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { RefreshCw, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { listOfficialCatalog, syncOfficialBatch } from '@/lib/equipment.functions';
import { parseDimensionRows, plausibleMm, areaFmt, type DimensionRow } from '@/lib/equipment/model';
import type { Json } from '@/integrations/supabase/types';
type Result = Awaited<ReturnType<typeof syncOfficialBatch>>[number];
export type SyncReport = { finishedAt: string; found: number; equipment: number; complete: number; incomplete: number; suspicious: number; errors: number; deactivated: number; ignored: number; rows: Result[] };
const REPORT_KEY = 'ccm-catalog-sync-report';
export function loadReport(): SyncReport | null { try { return JSON.parse(localStorage.getItem(REPORT_KEY) ?? 'null'); } catch { return null; } }
export function summarize(rows: Result[], deactivated: number): SyncReport {
 const ok = rows.filter(r => !('error' in r) || !r.error) as Extract<Result, { model: string }>[];
 const eq = ok.filter(r => r.is_equipment);
 const complete = eq.filter(r => r.length_mm != null && r.width_mm != null && plausibleMm(r.length_mm) && plausibleMm(r.width_mm));
 const suspicious = eq.filter(r => r.length_mm != null && r.width_mm != null && !(plausibleMm(r.length_mm) && plausibleMm(r.width_mm) && (r.height_mm == null || plausibleMm(r.height_mm))));
 return { finishedAt: new Date().toISOString(), found: rows.length, equipment: eq.length, complete: complete.length, incomplete: eq.length - complete.length - suspicious.length, suspicious: suspicious.length, errors: rows.length - ok.length, deactivated, ignored: ok.length - eq.length, rows };
}
export function CatalogSync({ onDone }: { onDone: () => Promise<void> }) {
 const list = useServerFn(listOfficialCatalog), batch = useServerFn(syncOfficialBatch);
 const [progress, setProgress] = useState<{ done: number; total: number } | null>(null), [report, setReport] = useState<SyncReport | null>(null);
 async function run() {
  try {
   setProgress({ done: 0, total: 0 });
   const products = await list();
   setProgress({ done: 0, total: products.length });
   const chunks: typeof products[] = [];
   for (let i = 0; i < products.length; i += 8) chunks.push(products.slice(i, i + 8));
   const rows: Result[] = []; let done = 0, next = 0;
   await Promise.all(Array.from({ length: 3 }, async () => { while (next < chunks.length) { const chunk = chunks[next++]!; try { rows.push(...await batch({ data: { items: chunk.map(p => ({ code: p.code, subcategories: p.subcategories.slice(0, 10) })) } })); } catch (e) { rows.push(...chunk.map(p => ({ code: p.code, error: e instanceof Error ? e.message : 'Erro na importação' }))); } done += chunk.length; setProgress({ done, total: products.length }); } }));
   const failed = new Set(rows.filter(r => 'error' in r && r.error).map(r => r.code));
   if (failed.size) { const retry = products.filter(p => failed.has(p.code)); for (let i = 0; i < retry.length; i += 4) { const chunk = retry.slice(i, i + 4); try { const again = await batch({ data: { items: chunk.map(p => ({ code: p.code, subcategories: p.subcategories.slice(0, 10) })) } }); for (const r of again) { const at = rows.findIndex(x => x.code === r.code); if (at >= 0) rows[at] = r; } } catch { /* keep first error */ } setProgress({ done: products.length, total: products.length }); } }
   const { data: deactivated, error } = await supabase.rpc('deactivate_missing_equipment', { p_active_codes: products.map(p => p.code) });
   if (error) throw error;
   const r = summarize(rows, deactivated ?? 0); localStorage.setItem(REPORT_KEY, JSON.stringify(r)); setReport(r);
   await onDone(); toast.success('Catálogo CCM sincronizado.');
  } catch (e) { toast.error(e instanceof Error ? e.message : 'Sincronização indisponível.'); await onDone(); }
  finally { setProgress(null); }
 }
 return <>
  <Button variant="outline" disabled={!!progress} onClick={() => { void run(); }}><RefreshCw className={`h-4 w-4 ${progress ? 'animate-spin' : ''}`} />{progress ? (progress.total ? `Sincronizando ${progress.done}/${progress.total}` : 'Lendo catálogo oficial…') : 'Sincronizar catálogo CCM'}</Button>
  <Button variant="ghost" disabled={!!progress} onClick={() => setReport(loadReport() ?? { finishedAt: '', found: 0, equipment: 0, complete: 0, incomplete: 0, suspicious: 0, errors: 0, deactivated: 0, ignored: 0, rows: [] })}>Relatório da sincronização</Button>
  {progress && progress.total > 0 && <div className="h-1.5 w-full overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}><div className="h-full bg-primary transition-all" style={{ width: `${progress.done / progress.total * 100}%` }} /></div>}
  {report && <Dialog open onOpenChange={v => { if (!v) setReport(null); }}><DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Relatório da sincronização</DialogTitle><DialogDescription>{report.finishedAt ? `Concluída em ${new Date(report.finishedAt).toLocaleString('pt-BR')}` : 'Nenhuma sincronização registrada neste navegador.'}</DialogDescription></DialogHeader>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Produtos encontrados', report.found], ['Equipamentos completos', report.equipment], ['Com dimensões completas', report.complete], ['Dimensões incompletas', report.incomplete], ['Medidas possivelmente incorretas', report.suspicious], ['Erros na importação', report.errors], ['Peças/acessórios ignorados', report.ignored], ['Desativados no sistema', report.deactivated]].map(([l, v]) => <div key={l} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{l}</p><strong className="text-lg">{v}</strong></div>)}</div>
   <p className="text-sm font-semibold">Catálogo pronto para uso automático: {areaFmt(report.equipment ? report.complete / report.equipment * 100 : 0)}%</p>
   {report.rows.length > 0 && <div className="max-h-80 overflow-auto rounded-md border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr>{['Código', 'Modelo', 'C × L × A (mm)', 'Fonte'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{report.rows.filter(r => !('is_equipment' in r) || r.is_equipment).map(r => <tr key={r.code} className="border-t"><td className="p-2">{r.code}</td><td className="p-2">{'model' in r ? r.model : ''}</td><td className="p-2 whitespace-nowrap">{'error' in r && r.error ? <span className="text-destructive">{r.error}</span> : 'length_mm' in r && r.length_mm != null ? `${r.length_mm} × ${r.width_mm} × ${r.height_mm ?? '—'}` : <span className="text-warning">Dimensões pendentes</span>}</td><td className="p-2">{'source' in r ? r.source || ('packaging' in r && r.packaging ? 'Só embalagem disponível — não utilizada' : 'Sem fonte oficial') : ''}</td></tr>)}</tbody></table></div>}
  </DialogContent></Dialog>}
 </>;
}
export function DimensionsImport({ onDone }: { onDone: () => Promise<void> }) {
 const [open, setOpen] = useState(false), [rows, setRows] = useState<DimensionRow[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [file, setFile] = useState('');
 const valid = rows.filter(r => !r.error);
 return <><Button variant="outline" onClick={() => setOpen(true)}><FileSpreadsheet className="h-4 w-4" />Dimensões por planilha</Button>
  {open && <Dialog open onOpenChange={v => { if (!v && !busy) { setOpen(false); setRows([]); setFile(''); } }}><DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Atualizar dimensões em lote</DialogTitle><DialogDescription>Excel com Código, Modelo, Comprimento, Largura, Altura, Unidade (mm, cm ou m) e Fonte.</DialogDescription></DialogHeader>
   <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-5 text-sm"><FileSpreadsheet className="h-6 w-6 text-primary" />{file || 'Selecionar planilha Excel'}<input aria-label="Planilha de dimensões" type="file" accept=".xlsx,.xls" className="sr-only" disabled={busy} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setError(''); try { const XLSX = await import('xlsx'); const book = XLSX.read(await f.arrayBuffer(), { type: 'array' }); const sheet = book.Sheets[book.SheetNames[0] ?? '']; if (!sheet) throw new Error('Planilha vazia.'); setRows(parseDimensionRows(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' }))); setFile(f.name); } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao ler planilha.'); } }} /></label>
   {rows.length > 0 && <><p className="text-sm">{valid.length} válidas · <span className="text-destructive">{rows.length - valid.length} inválidas</span></p><div className="max-h-72 overflow-auto rounded-md border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr>{['Linha', 'Código', 'Modelo', 'C × L × A (mm)', 'Fonte', 'Validação'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.line} className="border-t"><td className="p-2">{r.line}</td><td className="p-2">{r.code}</td><td className="p-2">{r.model}</td><td className="p-2">{r.length_mm} × {r.width_mm} × {r.height_mm ?? '—'}</td><td className="p-2">{r.source}</td><td className="p-2 text-destructive">{r.error ?? 'Válida'}</td></tr>)}</tbody></table></div></>}
   {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
   <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy || !valid.length} onClick={async () => { setBusy(true); try { const { data, error } = await supabase.rpc('bulk_update_equipment_dimensions', { p_rows: valid as unknown as Json }); if (error) throw error; const r = data as { updated: number; missing: string[] }; toast.success(`${r.updated} equipamentos atualizados.${r.missing.length ? ` ${r.missing.length} códigos não encontrados: ${r.missing.slice(0, 5).join(', ')}` : ''}`); await onDone(); setOpen(false); setRows([]); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar.'); } finally { setBusy(false); } }}><Upload className="h-4 w-4" />Atualizar {valid.length} equipamentos</Button></div>
  </DialogContent></Dialog>}</>;
}
