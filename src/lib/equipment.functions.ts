import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';
export const updateEquipmentSpecifications=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid()})).handler(async({data,context})=>{
 const {data:equipment,error}=await context.supabase.from('equipment_catalog').select('*').eq('id',data.id).single();if(error||!equipment)throw new Error('Equipamento não encontrado.');
 const {ccmAdapter}=await import('./equipment/ccm-adapter.server');
 const found=await ccmAdapter.lookup(equipment.normalized_code,equipment.subcategory?equipment.subcategory.split(', '):[]);
 if(!found){const {error:writeError}=await context.supabase.from('equipment_catalog').update({situation:'Não localizado',last_checked_at:new Date().toISOString()}).eq('id',data.id);if(writeError)throw writeError;return {found:false,message:'Produto não localizado. Preencha as dimensões manualmente.'};}
 const {manuals:_m,...row}=found;
 const {error:writeError}=await context.supabase.rpc('sync_equipment_catalog',{p_rows:[row] as unknown as Json});if(writeError)throw writeError;
 return {found:true,message:found.length_mm!==null?'Especificações atualizadas (medidas manuais preservadas).':'Especificações atualizadas; dimensões não encontradas nas fontes oficiais.'};
});
/** Lists every active product of the official catalog with its official subcategories. */
export const listOfficialCatalog=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async()=>{
 const {ccmAdapter}=await import('./equipment/ccm-adapter.server');
 return ccmAdapter.listActive();
});
/** Fetches a small batch of official products and upserts them, preserving manual measurements and labels. */
export const syncOfficialBatch=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({items:z.array(z.object({code:z.string().regex(/^\d+$/),subcategories:z.array(z.string().max(120)).max(10)})).min(1).max(12)})).handler(async({data,context})=>{
 const {ccmAdapter}=await import('./equipment/ccm-adapter.server');
 const results=await Promise.all(data.items.map(async item=>{try{const row=await ccmAdapter.lookup(item.code,item.subcategories);return row?{code:item.code,row}:{code:item.code,error:'Produto não localizado'};}catch(e){return {code:item.code,error:e instanceof Error?e.message:'Erro na importação'};}}));
 const rows=results.flatMap(r=>'row' in r&&r.row&&r.row.is_equipment?[(({manuals:_m,...rest})=>rest)(r.row)]:[]);
 const parts=results.flatMap(r=>'row' in r&&r.row&&!r.row.is_equipment?[r.code]:[]);
 if(parts.length){await context.supabase.from('equipment_catalog').update({is_equipment:false,last_checked_at:new Date().toISOString()}).in('normalized_code',parts);}
 if(rows.length){const {error}=await context.supabase.rpc('sync_equipment_catalog',{p_rows:rows as unknown as Json});if(error)throw new Error(error.message);}
 const failed=results.filter(r=>'error' in r).map(r=>r.code);
 if(rows.length){await context.supabase.from('equipment_catalog').update({sync_error:''}).in('normalized_code',rows.map(r=>r.normalized_code));}
 if(failed.length){await context.supabase.from('equipment_catalog').update({sync_error:'Falha ao consultar o site oficial na última sincronização',last_checked_at:new Date().toISOString()}).in('normalized_code',failed);}
 return results.map(r=>'row' in r&&r.row?{code:r.code,model:r.row.model,name:r.row.name,is_equipment:r.row.is_equipment,length_mm:r.row.length_mm,width_mm:r.row.width_mm,height_mm:r.row.height_mm,source:r.row.dimension_source,packaging:r.row.packaging_dimensions}:{code:r.code,error:'error' in r?r.error:'Erro'});
});
