import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const updateEquipmentSpecifications=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid()})).handler(async({data,context})=>{
 const {data:equipment,error}=await context.supabase.from('equipment_catalog').select('*').eq('id',data.id).single();if(error||!equipment)throw new Error('Equipamento não encontrado.');
 const {ccmAdapter}=await import('./equipment/ccm-adapter.server');
 const found=await ccmAdapter.lookup(equipment.normalized_code);
 if(!found){const {error:writeError}=await context.supabase.from('equipment_catalog').update({situation:'Não localizado',last_checked_at:new Date().toISOString()}).eq('id',data.id);if(writeError)throw writeError;return {found:false,message:'Produto não localizado. Preencha as dimensões manualmente.'};}
 const {error:writeError}=await context.supabase.from('equipment_catalog').update(found).eq('id',data.id);if(writeError)throw writeError;
 return {found:true,message:found.dimension_status==='Completas'?'Especificações atualizadas.':'Especificações encontradas; revise as dimensões incompletas.'};
});
