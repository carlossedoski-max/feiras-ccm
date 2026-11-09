import type { Database } from '@/integrations/supabase/types';
type Tables = Database['public']['Tables'];
export type Equipment = Tables['equipment_catalog']['Row'];
export type Plan = Tables['fair_equipment_plans']['Row'];
export type Item = Tables['fair_equipment_items']['Row'];
export type FairSummary = Pick<Tables['fairs']['Row'], 'id' | 'name' | 'year' | 'city' | 'state'>;
export type EquipmentInput = Tables['equipment_catalog']['Insert'];
export type PlanInput = Tables['fair_equipment_plans']['Insert'];
export type ItemInput = Tables['fair_equipment_items']['Insert'];
export const LOCATIONS = ['Dentro do estande','Área externa','Depósito','Painel ou parede','Bancada','Acoplado em outro equipamento','Fora do cálculo de área'];
export const MODES = ['No chão','Sobre bancada','Em painel','Em prateleira','Acoplado','Empilhado','Suspenso','Área manual'];
export const PRIORITIES = ['Obrigatório','Estratégico','Lançamento','Complementar','Opcional'];
export const SITUATIONS = ['Especificações encontradas','Dimensões incompletas','Produto não localizado','Produto descontinuado','Revisão necessária','Sem estoque'];
export const normalizeCode = (code: string) => code.replace(/\D/g, '');
export const areaFmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export function dimensionsStatus(e: Pick<Equipment, 'length_mm'|'width_mm'|'height_mm'>) {
 return e.length_mm && e.width_mm && e.height_mm ? 'Completas' : e.length_mm || e.width_mm || e.height_mm ? 'Incompletas' : 'Pendentes';
}
export function itemArea(item: Pick<Item,'included'|'location'|'display_mode'|'manual_area'|'quantity'>, equipment?: Pick<Equipment,'length_mm'|'width_mm'>): number | null {
 if (!item.included || item.location === 'Fora do cálculo de área') return 0;
 if (item.display_mode !== 'No chão') return item.manual_area === null ? null : item.manual_area * item.quantity;
 if (!equipment?.length_mm || !equipment.width_mm) return null;
 return equipment.length_mm / 1000 * equipment.width_mm / 1000 * item.quantity;
}
export function calculatePlan(plan: Pick<Plan,'total_area'|'stand_area'|'internal_reserved'|'external_reserved'|'circulation_percent'>, items: Item[], catalog: Equipment[]) {
 const byId = new Map(catalog.map(e => [e.id,e]));
 let internal = 0, external = 0, pending = 0, quantity = 0, launches = 0;
 for (const i of items) {
  if (!i.included || i.deleted_at) continue;
  quantity += i.quantity;
  if (i.is_launch) launches += i.quantity;
  const area = itemArea(i,byId.get(i.equipment_id));
  if (area === null) { pending += 1; continue; }
  if (i.location === 'Área externa') external += area; else internal += area;
 }
 const factor = 1 + plan.circulation_percent / 100;
 const internalAvailable = plan.stand_area - plan.internal_reserved;
 const externalAvailable = plan.total_area - plan.stand_area - plan.external_reserved;
 const circulation = (internal + external) * (factor - 1);
 const occupied = (internal + external) * factor + plan.internal_reserved + plan.external_reserved;
 const percent = plan.total_area > 0 ? occupied / plan.total_area * 100 : occupied > 0 ? Infinity : 0;
 const internalBalance = internalAvailable - internal * factor, externalBalance = externalAvailable - external * factor;
 const maxPercent = Math.max(percent, internalAvailable > 0 ? internal * factor / internalAvailable * 100 : internal > 0 ? Infinity : 0, externalAvailable > 0 ? external * factor / externalAvailable * 100 : external > 0 ? Infinity : 0);
 const status = pending || plan.total_area <= 0 ? 'Cálculo incompleto' : maxPercent > 100 ? 'Espaço ultrapassado' : maxPercent > 80 ? 'Próximo do limite' : 'Cabe com folga';
 return { internal, external, pending, quantity, launches, circulation, occupied, percent, internalAvailable, externalAvailable, internalBalance, externalBalance, balance: plan.total_area - occupied, status, equipmentArea: internal + external };
}
export type ImportRow = { line: number; code: string; normalized: string; name: string; quantity: number; notes: string; status: string; error?: string };
const clean = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
const header = (value: unknown) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
export function parseImportRows(matrix: unknown[][]): ImportRow[] {
 const headerIndex = matrix.findIndex(r => r.some(c => ['COD','CODIGO','COD.','CODIGO CCM','COD CCM'].includes(header(c))));
 if (headerIndex < 0) throw new Error('Não foi encontrada uma coluna CÓD, COD ou CÓDIGO.');
 const columns = (matrix[headerIndex] ?? []).map(header);
 const idx = (...names: string[]) => columns.findIndex(h => names.includes(h));
 const codeIndex = idx('COD','CODIGO','COD.','CODIGO CCM','COD CCM'), nameIndex = idx('PRODUTO','NOME','NOME DO PRODUTO');
 const qtyIndex = idx('QUANTIDADE','QTD','QTDE'), notesIndex = idx('OBSERVACAO','OBSERVACOES','OBS'), statusIndex = idx('STATUS','SITUACAO');
 return matrix.slice(headerIndex + 1).filter(row => row.some(c => clean(c))).map((r, index) => {
  const code = clean(r[codeIndex]), quantity = qtyIndex < 0 || !clean(r[qtyIndex]) ? 1 : Number(clean(r[qtyIndex]).replace(',','.'));
  const normalized = normalizeCode(code);
  return { line: headerIndex + index + 2, code, normalized, quantity, name: clean(r[nameIndex]), notes: clean(r[notesIndex]), status: clean(r[statusIndex]), error: !normalized ? 'Código inválido' : !Number.isInteger(quantity) || quantity <= 0 ? 'Quantidade deve ser inteira e maior que zero' : undefined };
 });
}
export function mergeImportRows(rows: ImportRow[]) {
 const result = new Map<string,ImportRow>();
 for (const row of rows.filter(r => !r.error)) {
  const existing = result.get(row.normalized);
  if (existing) { existing.quantity += row.quantity; existing.notes = [existing.notes,row.notes].filter(Boolean).join(' | '); existing.status = [existing.status,row.status].filter(Boolean).join(' | '); }
  else result.set(row.normalized, { ...row });
 }
 return [...result.values()];
}
export function compareEditions(current: Item[], previous: Item[], catalog: Equipment[]) {
 const group = (list: Item[]) => { const map = new Map<string,number>(); for (const i of list.filter(i => i.included && !i.deleted_at)) map.set(i.equipment_id,(map.get(i.equipment_id) ?? 0)+i.quantity); return map; };
 const a=group(current), b=group(previous);
 return catalog.filter(e => a.has(e.id) || b.has(e.id)).map(e => ({ equipment:e, before:b.get(e.id) ?? 0, after:a.get(e.id) ?? 0, change:!b.has(e.id)?'Adicionado':!a.has(e.id)?'Retirado':a.get(e.id)!==b.get(e.id)?'Quantidade alterada':'Mantido' }));
}
export function removalSuggestions(items: Item[], catalog: Equipment[]) {
 return items.filter(i => i.included && !i.deleted_at && ['Opcional','Complementar'].includes(i.priority)).map(i => ({ item:i, equipment:catalog.find(e => e.id===i.equipment_id), area:itemArea(i,catalog.find(e => e.id===i.equipment_id)) })).sort((a,b) => (a.item.priority==='Opcional'?0:1)-(b.item.priority==='Opcional'?0:1) || (b.area ?? 0)-(a.area ?? 0));
}
export const canConfirmDeletion=(value:string)=>value==='EXCLUIR';
export const PLAN_STATUSES = ['Pronto para planta 2D','Dimensão incompleta','Dimensão da embalagem — não utilizar','Aguardando validação','Erro na importação'] as const;
export type PlanStatus = typeof PLAN_STATUSES[number];
/** Short label shown inside the 2D floorplan, derived from the model (e.g. "BCJ 261-L" → "BCJ 261"). */
export function generatePlanCode(model: string, code: string) {
 const m = clean(model).toUpperCase().replace(/\(.*?\)/g, '').replace(/\s+-\s+.*$/, '').trim();
 const match = m.match(/^([A-Z]{1,6})[\s-]*(\d{1,5}(?:[.,]\d+)?)/);
 if (match) return `${match[1]} ${match[2]}`;
 if (m) return m.split(/\s+/).slice(0, 2).join(' ').slice(0, 12);
 return clean(code);
}
export const plausibleMm = (n: number | null | undefined) => typeof n === 'number' && Number.isFinite(n) && n >= 20 && n <= 20000;
export function planStatus(e: Pick<Equipment,'length_mm'|'width_mm'|'height_mm'|'dimension_source'|'packaging_dimensions'|'sync_error'|'model'|'plan_code'|'normalized_code'>): PlanStatus {
 const hasLW = e.length_mm != null && e.width_mm != null;
 if (!hasLW) return e.sync_error ? 'Erro na importação' : e.packaging_dimensions ? 'Dimensão da embalagem — não utilizar' : 'Dimensão incompleta';
 if (!plausibleMm(e.length_mm) || !plausibleMm(e.width_mm) || (e.height_mm != null && !plausibleMm(e.height_mm)) || !e.dimension_source || !(e.model || e.plan_code) || !e.normalized_code) return 'Aguardando validação';
 return 'Pronto para planta 2D';
}
export const readyForPlan = (e: Parameters<typeof planStatus>[0]) => planStatus(e) === 'Pronto para planta 2D';
export const dimsLabel = (e: Pick<Equipment,'length_mm'|'width_mm'|'height_mm'>) => e.length_mm == null || e.width_mm == null ? 'Dimensões pendentes' : `${e.length_mm} × ${e.width_mm} × ${e.height_mm ?? '—'} mm`;
/** Parses "1370 x 600 x 1400 mm" (C × L × A) or "2200 x 980 mm (C x L)" into millimetres. The official site states millimetres; values without a unit are read as mm. */
export function parseDimensions(value: string) {
 const d = value.match(/(\d+(?:[.,]\d+)?)\s*(?:mm|cm|m)?\s*[x×X]\s*(\d+(?:[.,]\d+)?)\s*(?:mm|cm|m)?(?:\s*[x×X]\s*(\d+(?:[.,]\d+)?))?\s*(mm|cm|m)?\b/);
 if (!d) return null;
 const f = d[4] === 'cm' ? 10 : d[4] === 'm' ? 1000 : 1, n = (s?: string) => s === undefined ? null : Math.round(Number(s.replace(',', '.')) * f);
 return { length_mm: n(d[1]) as number, width_mm: n(d[2]) as number, height_mm: n(d[3]), unitless: !d[4] };
}
const EXCLUDED_SUBCATEGORIES = ['acessorios','lubrificantes','kits pulverizacao / lavadoras'];
const PART_TYPE = /acess[oó]rio|pe[cç]a|reposi[cç]|consum[ií]v|\bkit\b|l[aâ]mina|corrente|sabre|cabe[cç]ote|filtro|vela|carburador|pneu|\broda|cord[aã]o|vestu|prote[cç][aã]o individual|epi\b|[oó]leo|graxa|fio de nylon|carretel|bon[eé]\b|capacete|luva|[oó]culos|protetor|avental|camis|cinto|vestu/i;
/** Decides whether an official product is a complete equipment, using official subcategory and "Tipo" first, the name only as backup. */
export function isCompleteEquipment(subcategories: string[], type: string, name: string) {
 const subs = subcategories.map(s => header(s).toLowerCase());
 if (subs.some(s => EXCLUDED_SUBCATEGORIES.includes(s))) return false;
 if (type && PART_TYPE.test(type)) return false;
 return !/^(bon[eé]|capacete|luva|[oó]culos|protetor|cinto|camis|acess[oó]rio|kit|pe[cç]a|cord[aã]o|l[aâ]mina|corrente|sabre|filtro|vela|carburador|pneu|roda)\b/i.test(clean(name));
}
export type DimensionRow = { line:number; code:string; normalized_code:string; model:string; length_mm:number; width_mm:number; height_mm:number|null; source:string; error?:string };
export function parseDimensionRows(matrix: unknown[][]): DimensionRow[] {
 const hi = matrix.findIndex(r => r.some(c => ['COD','CODIGO','COD.'].includes(header(c))));
 if (hi < 0) throw new Error('Não foi encontrada uma coluna CÓDIGO.');
 const cols = (matrix[hi] ?? []).map(header), idx = (...n: string[]) => cols.findIndex(h => n.includes(h));
 const ci = idx('COD','CODIGO','COD.'), mi = idx('MODELO'), li = idx('COMPRIMENTO','C'), wi = idx('LARGURA','L'), ai = idx('ALTURA','A'), ui = idx('UNIDADE'), si = idx('FONTE','FONTE DA INFORMACAO');
 return matrix.slice(hi + 1).filter(r => r.some(c => clean(c))).map((r, i) => {
  const unit = clean(r[ui]).toLowerCase() || 'mm', f = unit === 'cm' ? 10 : unit === 'm' ? 1000 : unit === 'mm' ? 1 : NaN;
  const num = (v: unknown) => { const s = clean(v).replace(',', '.'); return s ? Math.round(Number(s) * f) : null; };
  const code = clean(r[ci]), L = num(r[li]), W = num(r[wi]), A = num(r[ai]);
  const error = !normalizeCode(code) ? 'Código inválido' : Number.isNaN(f) ? 'Unidade deve ser mm, cm ou m' : !plausibleMm(L) || !plausibleMm(W) || (A !== null && !plausibleMm(A)) ? 'Medidas devem ser numéricas, positivas e coerentes' : !clean(r[si]) ? 'Informe a fonte da informação' : undefined;
  return { line: hi + i + 2, code, normalized_code: normalizeCode(code), model: clean(r[mi]), length_mm: L ?? 0, width_mm: W ?? 0, height_mm: A, source: clean(r[si]), error };
 });
}
