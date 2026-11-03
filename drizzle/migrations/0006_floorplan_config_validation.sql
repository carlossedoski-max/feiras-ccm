CREATE OR REPLACE FUNCTION public.validate_equipment_floorplan() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE c jsonb; r jsonb; p record; BEGIN
 IF NEW.floorplan IS NULL THEN RETURN NEW; END IF;
 c:=NEW.floorplan->'config';
 IF coalesce((c->>'gap')::numeric,-1)<0 OR coalesce((c->>'circulationPercent')::numeric,-1)<0 OR coalesce((c->>'entrance')::numeric,-1)<0 OR (c->>'entrance')::numeric>(c->>'width')::numeric THEN RAISE EXCEPTION 'Margem, circulação ou entrada inválida'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(c->'reserved') LOOP
  IF (r->>'x')::numeric<0 OR (r->>'y')::numeric<0 OR (r->>'width')::numeric<=0 OR (r->>'depth')::numeric<=0 OR (r->>'x')::numeric+(r->>'width')::numeric>(c->>'width')::numeric OR (r->>'y')::numeric+(r->>'depth')::numeric>(c->>'depth')::numeric THEN RAISE EXCEPTION 'Reserva fora do terreno'; END IF;
 END LOOP;
 FOR p IN SELECT key,value FROM jsonb_each(NEW.floorplan->'positions') LOOP
  IF p.key !~ '^[0-9a-f-]{36}:[0-9]+$' OR (p.value->>'rotation')::integer NOT IN (0,90,180,270) OR p.value->>'area' NOT IN ('internal','external') THEN RAISE EXCEPTION 'Posição inválida'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_equipment_floorplan BEFORE INSERT OR UPDATE OF floorplan ON public.fair_equipment_plans FOR EACH ROW EXECUTE FUNCTION public.validate_equipment_floorplan();
CREATE OR REPLACE FUNCTION public.copy_equipment_edition_layout(p_target uuid,p_source uuid,p_copy_layout boolean DEFAULT false) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer; source_layout jsonb; positions jsonb:='{}'::jsonb; src public.fair_equipment_items; dst uuid; pos record; ordinal integer;
BEGIN
 n:=public.copy_equipment_edition(p_target,p_source,NULL);
 IF p_copy_layout THEN
  SELECT floorplan INTO source_layout FROM public.fair_equipment_plans WHERE id=p_source;
  IF source_layout IS NOT NULL THEN
   FOR src IN SELECT * FROM public.fair_equipment_items WHERE plan_id=p_source AND deleted_at IS NULL LOOP
    SELECT id INTO dst FROM public.fair_equipment_items WHERE plan_id=p_target AND deleted_at IS NULL AND equipment_id=src.equipment_id AND notes=src.notes AND quantity=src.quantity ORDER BY created_at,id OFFSET (SELECT count(*) FROM public.fair_equipment_items x WHERE x.plan_id=p_source AND x.deleted_at IS NULL AND x.equipment_id=src.equipment_id AND x.notes=src.notes AND x.quantity=src.quantity AND (x.created_at,x.id)<(src.created_at,src.id)) LIMIT 1;
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