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
  allRows((f,t)=>supabase.from('fair_equipment_plans').select('*').is('deleted_at',null).order('edition_year',{ascending:false}).order('id').range(f,t)),
  allRows((f,t)=>supabase.from('fair_equipment_items').select('*').is('deleted_at',null).order('created_at').order('id').range(f,t)),
  allRows((f,t)=>supabase.from('fairs').select('id,name,year,city,state').order('name').order('id').range(f,t)),
  allRows((f,t)=>supabase.from('equipment_import_batches').select('*').order('created_at',{ascending:false}).order('id').range(f,t)),
 ]);
  const activeIds=new Set(plans.map(p=>p.id));
  return {catalog,plans,items:items.filter(i=>activeIds.has(i.plan_id)),fairs,batches:batches.filter(b=>activeIds.has(b.plan_id))};
}});
export async function saveEquipment(input:EquipmentInput,id?:string) {
 const query=id?supabase.from('equipment_catalog').update(input).eq('id',id):supabase.from('equipment_catalog').insert(input);
 const {data,error}=await query.select().single(); if(error)throw new Error(error.code==='23505'?'Este código já está cadastrado no catálogo.':error.message);return data;
}
export async function savePlan(input:PlanInput,id?:string) {
 const query=id?supabase.from('fair_equipment_plans').update(input).eq('id',id):supabase.from('fair_equipment_plans').insert(input);
 const {data,error}=await query.select().single();if(error)throw new Error(error.code==='23505'?'Esta feira já tem planejamento para o ano informado. Confira também a Lixeira para restaurá-lo.':error.message);return data;
}
export async function saveItem(input:ItemInput,id?:string) {
 const query=id?supabase.from('fair_equipment_items').update(input).eq('id',id):supabase.from('fair_equipment_items').insert(input);
 const {error}=await query;if(error)throw error;
}
export async function deleteItems(planId:string,ids:string[]) {const {error}=await supabase.rpc('trash_equipment_items',{p_plan_id:planId,p_ids:ids});if(error)throw error;}
export async function managePlan(planId:string,action:'trash'|'restore'|'purge',confirmation='') {const {error}=await supabase.rpc('manage_equipment_plan',{p_plan_id:planId,p_action:action,p_confirmation:confirmation});if(error)throw error;}
export const equipmentTrashQuery=queryOptions({queryKey:['equipment','trash'],queryFn:async()=>{
 const plans=await allRows((f,t)=>supabase.from('fair_equipment_plans').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false}).order('id').range(f,t));
 const items=await allRows((f,t)=>supabase.from('fair_equipment_items').select('*').eq('deleted_with_plan',true).not('deleted_at','is',null).order('id').range(f,t));
 return {plans,items};
}});
export async function importItems(planId:string,rows:unknown[],filename:string,invalid:number,duplicates:number,merge:boolean) {
 const {data,error}=await supabase.rpc('import_equipment_list',{p_plan_id:planId,p_rows:rows as Database['public']['Functions']['import_equipment_list']['Args']['p_rows'],p_filename:filename,p_invalid:invalid,p_duplicates:duplicates,p_merge:merge});if(error)throw error;return data;
}
export async function copyEdition(target:string,source:string,snapshot:unknown) {
 const {error}=await supabase.rpc('copy_equipment_edition',{p_target:target,p_source:source,p_snapshot:snapshot as Database['public']['Functions']['copy_equipment_edition']['Args']['p_snapshot']});if(error)throw error;
}
