ALTER POLICY "Authenticated equipment plans" ON public.fair_equipment_plans USING (EXISTS (SELECT 1 FROM public.fairs f WHERE f.id=fair_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.fairs f WHERE f.id=fair_id));
ALTER POLICY "Authenticated equipment items" ON public.fair_equipment_items USING (EXISTS (SELECT 1 FROM public.fair_equipment_plans p WHERE p.id=plan_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.fair_equipment_plans p WHERE p.id=plan_id));
ALTER POLICY "Authenticated equipment imports" ON public.equipment_import_batches USING (EXISTS (SELECT 1 FROM public.fair_equipment_plans p WHERE p.id=plan_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.fair_equipment_plans p WHERE p.id=plan_id));
CREATE OR REPLACE FUNCTION public.copy_equipment_edition(p_target uuid,p_source uuid,p_snapshot jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer; source_plan public.fair_equipment_plans; target_year integer; snapshot jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 IF p_target=p_source THEN RAISE EXCEPTION 'Selecione outra edição'; END IF;
 SELECT edition_year INTO target_year FROM public.fair_equipment_plans WHERE id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Planejamento não encontrado'; END IF;
 SELECT * INTO source_plan FROM public.fair_equipment_plans WHERE id=p_source FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Edição anterior não encontrada'; END IF;
 IF source_plan.edition_year>=target_year THEN RAISE EXCEPTION 'Selecione uma edição anterior'; END IF;
 IF EXISTS(SELECT 1 FROM public.fair_equipment_items WHERE plan_id=p_target) THEN RAISE EXCEPTION 'A lista atual deve estar vazia para copiar uma edição'; END IF;
 snapshot := jsonb_build_object('plan',to_jsonb(source_plan),'items',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM public.fair_equipment_items i WHERE plan_id=p_source),'[]'::jsonb),'catalog',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.equipment_catalog e WHERE EXISTS(SELECT 1 FROM public.fair_equipment_items i WHERE i.plan_id=p_source AND i.equipment_id=e.id)),'[]'::jsonb));
 INSERT INTO public.fair_equipment_items(plan_id,equipment_id,included,quantity,location,display_mode,manual_area,priority,is_launch,situation,notes,position_x,position_y,rotation,created_by)
 SELECT p_target,equipment_id,included,quantity,location,display_mode,manual_area,priority,is_launch,situation,notes,position_x,position_y,rotation,auth.uid() FROM public.fair_equipment_items WHERE plan_id=p_source;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.fair_equipment_plans SET reference_plan_id=p_source,reference_snapshot=snapshot WHERE id=p_target;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.copy_equipment_edition(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_equipment_edition(uuid,uuid,jsonb) TO authenticated,service_role;