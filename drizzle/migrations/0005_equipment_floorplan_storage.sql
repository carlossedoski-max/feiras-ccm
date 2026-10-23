ALTER TABLE public.fair_equipment_plans ADD COLUMN floorplan jsonb, ADD COLUMN floorplan_updated_at timestamptz;
CREATE OR REPLACE FUNCTION public.save_equipment_floorplan(p_plan_id uuid,p_layout jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 PERFORM id FROM public.fair_equipment_plans WHERE id=p_plan_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Planejamento não encontrado'; END IF;
 IF p_layout IS NOT NULL THEN
  IF jsonb_typeof(p_layout) IS DISTINCT FROM 'object' OR (p_layout->>'version') IS DISTINCT FROM '1' OR jsonb_typeof(p_layout->'positions') IS DISTINCT FROM 'object' OR jsonb_typeof(p_layout->'config') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Planta inválida'; END IF;
  IF octet_length(p_layout::text)>2000000 THEN RAISE EXCEPTION 'Planta muito grande'; END IF;
  IF coalesce((p_layout#>>'{config,width}')::numeric,0)<=0 OR coalesce((p_layout#>>'{config,depth}')::numeric,0)<=0 THEN RAISE EXCEPTION 'Informe as dimensões do terreno'; END IF;
  IF (p_layout#>>'{config,standWidth}')::numeric<0 OR (p_layout#>>'{config,standDepth}')::numeric<0 OR (p_layout#>>'{config,standWidth}')::numeric>(p_layout#>>'{config,width}')::numeric OR (p_layout#>>'{config,standDepth}')::numeric>(p_layout#>>'{config,depth}')::numeric THEN RAISE EXCEPTION 'Estande maior que o terreno'; END IF;
 END IF;
 UPDATE public.fair_equipment_plans SET floorplan=p_layout,floorplan_updated_at=now() WHERE id=p_plan_id;
END $$;
REVOKE ALL ON FUNCTION public.save_equipment_floorplan(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_equipment_floorplan(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.copy_equipment_edition_layout(p_target uuid,p_source uuid,p_copy_layout boolean DEFAULT false) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer; source_layout jsonb; positions jsonb:='{}'::jsonb; src public.fair_equipment_items; dst uuid; pos record; ordinal integer;
BEGIN
 n:=public.copy_equipment_edition(p_target,p_source,NULL);
 IF p_copy_layout THEN
  SELECT floorplan INTO source_layout FROM public.fair_equipment_plans WHERE id=p_source;
  IF source_layout IS NOT NULL THEN
   FOR src IN SELECT * FROM public.fair_equipment_items WHERE plan_id=p_source AND deleted_at IS NULL LOOP
    SELECT id INTO dst FROM public.fair_equipment_items WHERE plan_id=p_target AND equipment_id=src.equipment_id AND notes=src.notes AND quantity=src.quantity ORDER BY created_at,id OFFSET (SELECT count(*) FROM public.fair_equipment_items x WHERE x.plan_id=p_source AND x.deleted_at IS NULL AND x.equipment_id=src.equipment_id AND x.notes=src.notes AND x.quantity=src.quantity AND (x.created_at,x.id)<(src.created_at,src.id)) LIMIT 1;
    IF dst IS NOT NULL THEN
     FOR pos IN SELECT key,value FROM jsonb_each(source_layout->'positions') WHERE key LIKE src.id::text||':%' LOOP
      ordinal:=split_part(pos.key,':',2)::integer;
      IF ordinal>=0 AND ordinal<src.quantity THEN positions:=positions||jsonb_build_object(dst::text||':'||ordinal,pos.value); END IF;
     END LOOP;
    END IF;
   END LOOP;
   UPDATE public.fair_equipment_plans SET floorplan=jsonb_set(source_layout,'{positions}',positions),floorplan_updated_at=now() WHERE id=p_target;
  END IF;
 END IF;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.copy_equipment_edition_layout(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.copy_equipment_edition_layout(uuid,uuid,boolean) TO authenticated;