import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { EquipmentInput, ItemInput, PlanInput } from './model';
async function allRows<T>(fetchPage: (from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {
 const rows:T[]=[];
 for(let from=0;;from+=1000){const {data,error}=await fetchPage(from,from+999);if(error)throw error; rows.push(...(data??[]));if((data?.length??0)<1000)break;}
 return rows;
}
export const equipmentQuery = queryOptions({ queryKey:['equipment'], queryFn: async () => {
 const [catalog,plans,items,fairs,batches] = await Promise.all([
  allRows((f,t)=>supabase.from('equipment_catalog').select('*').order('ccm_code').range(f,t)),
  allRows((f,t)=>supabase.from('fair_equipment_plans').select('*').order('edition_year',{ascending:false}).order('id').range(f,t)),
  allRows((f,t)=>supabase.from('fair_equipment_items').select('*').order('created_at').order('id').range(f,t)),
  allRows((f,t)=>supabase.from('fairs').select('id,name,year,city,state').order('name').order('id').range(f,t)),
  allRows((f,t)=>supabase.from('equipment_import_batches').select('*').order('created_at',{ascending:false}).order('id').range(f,t)),
 ]);
 return {catalog,plans,items,fairs,batches};
}});
export async function saveEquipment(input:EquipmentInput,id?:string) {
 const query=id?supabase.from('equipment_catalog').update(input).eq('id',id):supabase.from('equipment_catalog').insert(input);
 const {data,error}=await query.select().single(); if(error)throw new Error(error.code==='23505'?'Este código já está cadastrado no catálogo.':error.message);return data;
}
export async function savePlan(input:PlanInput,id?:string) {
 const query=id?supabase.from('fair_equipment_plans').update(input).eq('id',id):supabase.from('fair_equipment_plans').insert(input);
 const {data,error}=await query.select().single();if(error)throw new Error(error.code==='23505'?'Esta feira já tem planejamento para o ano informado.':error.message);return data;
}
export async function saveItem(input:ItemInput,id?:string) {
 const query=id?supabase.from('fair_equipment_items').update(input).eq('id',id):supabase.from('fair_equipment_items').insert(input);
 const {error}=await query;if(error)throw error;
}
export async function deleteItem(id:string) {const {error}=await supabase.from('fair_equipment_items').delete().eq('id',id);if(error)throw error;}
export async function importItems(planId:string,rows:unknown[],filename:string,invalid:number,duplicates:number,merge:boolean) {
 const {data,error}=await supabase.rpc('import_equipment_list',{p_plan_id:planId,p_rows:rows as Database['public']['Functions']['import_equipment_list']['Args']['p_rows'],p_filename:filename,p_invalid:invalid,p_duplicates:duplicates,p_merge:merge});if(error)throw error;return data;
}
export async function copyEdition(target:string,source:string,snapshot:unknown) {
 const {error}=await supabase.rpc('copy_equipment_edition',{p_target:target,p_source:source,p_snapshot:snapshot as Database['public']['Functions']['copy_equipment_edition']['Args']['p_snapshot']});if(error)throw error;
}
