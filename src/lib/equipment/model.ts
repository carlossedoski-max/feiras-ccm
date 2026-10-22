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
