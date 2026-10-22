ALTER TABLE public.fair_equipment_plans ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid;
ALTER TABLE public.fair_equipment_items ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid, ADD COLUMN deleted_with_plan boolean NOT NULL DEFAULT false;
CREATE INDEX equipment_plans_trash ON public.fair_equipment_plans(deleted_at);
CREATE INDEX equipment_items_active ON public.fair_equipment_items(plan_id) WHERE deleted_at IS NULL;
CREATE OR REPLACE FUNCTION public.equipment_deletion_audit() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' THEN NEW.deleted_at:=NULL; NEW.deleted_by:=NULL;
 ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN NEW.deleted_at:=statement_timestamp(); NEW.deleted_by:=auth.uid();
 ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN NEW.deleted_at:=OLD.deleted_at; NEW.deleted_by:=OLD.deleted_by;
 ELSE NEW.deleted_by:=NULL; END IF; RETURN NEW;
END $$;
CREATE TRIGGER equipment_plan_deletion_audit BEFORE INSERT OR UPDATE ON public.fair_equipment_plans FOR EACH ROW EXECUTE FUNCTION public.equipment_deletion_audit();
CREATE TRIGGER equipment_item_deletion_audit BEFORE INSERT OR UPDATE ON public.fair_equipment_items FOR EACH ROW EXECUTE FUNCTION public.equipment_deletion_audit();
CREATE OR REPLACE FUNCTION public.equipment_plan_purge_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 IF OLD.deleted_at IS NULL THEN RAISE EXCEPTION 'Exclusão definitiva permitida somente na Lixeira'; END IF; RETURN OLD;
END $$;
CREATE TRIGGER equipment_plan_purge_guard BEFORE DELETE ON public.fair_equipment_plans FOR EACH ROW EXECUTE FUNCTION public.equipment_plan_purge_guard();
REVOKE DELETE ON public.fair_equipment_items FROM authenticated;
CREATE OR REPLACE FUNCTION public.trash_equipment_items(p_plan_id uuid,p_ids uuid[]) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE n integer; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 PERFORM id FROM public.fair_equipment_plans WHERE id=p_plan_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Planejamento não encontrado'; END IF;
 UPDATE public.fair_equipment_items SET deleted_at=now(),deleted_by=auth.uid(),deleted_with_plan=false WHERE plan_id=p_plan_id AND id=ANY(p_ids) AND deleted_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;
CREATE OR REPLACE FUNCTION public.manage_equipment_plan(p_plan_id uuid,p_action text,p_confirmation text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE p public.fair_equipment_plans; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 SELECT * INTO p FROM public.fair_equipment_plans WHERE id=p_plan_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Planejamento não encontrado'; END IF;
 IF p_action='trash' THEN
  IF p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Planejamento já está na Lixeira'; END IF;
  IF p_confirmation IS DISTINCT FROM 'EXCLUIR' THEN RAISE EXCEPTION 'Digite EXCLUIR para confirmar'; END IF;
  UPDATE public.fair_equipment_items SET deleted_at=now(),deleted_by=auth.uid(),deleted_with_plan=true WHERE plan_id=p_plan_id AND deleted_at IS NULL;
  UPDATE public.fair_equipment_plans SET deleted_at=now(),deleted_by=auth.uid() WHERE id=p_plan_id;
 ELSIF p_action='restore' THEN
  IF p.deleted_at IS NULL THEN RAISE EXCEPTION 'Planejamento não está na Lixeira'; END IF;
  UPDATE public.fair_equipment_plans SET deleted_at=NULL,deleted_by=NULL WHERE id=p_plan_id;
  UPDATE public.fair_equipment_items SET deleted_at=NULL,deleted_by=NULL,deleted_with_plan=false WHERE plan_id=p_plan_id AND deleted_with_plan;
 ELSIF p_action='purge' THEN
  IF p.deleted_at IS NULL THEN RAISE EXCEPTION 'Exclusão definitiva permitida somente na Lixeira'; END IF;
  IF p_confirmation IS DISTINCT FROM 'EXCLUIR' THEN RAISE EXCEPTION 'Digite EXCLUIR para confirmar'; END IF;
  DELETE FROM public.fair_equipment_plans WHERE id=p_plan_id;
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.trash_equipment_items(uuid,uuid[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.manage_equipment_plan(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.trash_equipment_items(uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_equipment_plan(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.import_equipment_list(p_plan_id uuid, p_rows jsonb, p_filename text, p_invalid integer, p_duplicates integer, p_merge boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r jsonb; eid uuid; iid uuid; n integer := 0; normalized text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 PERFORM id FROM public.fair_equipment_plans WHERE id=p_plan_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Planejamento não encontrado'; END IF;
 IF jsonb_array_length(p_rows)>5000 THEN RAISE EXCEPTION 'Limite de 5000 linhas'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  normalized := regexp_replace(r->>'code','[^0-9]','','g');
  IF normalized='' OR coalesce((r->>'quantity')::integer,0)<=0 THEN RAISE EXCEPTION 'Linha inválida'; END IF;
  INSERT INTO public.equipment_catalog(ccm_code,normalized_code,name,created_by)
  VALUES (trim(r->>'code'),normalized,coalesce(r->>'name',''),auth.uid()) ON CONFLICT DO NOTHING;
  SELECT id INTO eid FROM public.equipment_catalog WHERE normalized_code=normalized;
  SELECT id INTO iid FROM public.fair_equipment_items WHERE plan_id=p_plan_id AND deleted_at IS NULL AND equipment_id=eid ORDER BY created_at LIMIT 1;
  IF iid IS NOT NULL AND p_merge THEN
   UPDATE public.fair_equipment_items SET quantity=quantity+(r->>'quantity')::integer, notes=concat_ws(E'\n',nullif(notes,''),nullif(r->>'notes','')) WHERE id=iid;
  ELSE
   INSERT INTO public.fair_equipment_items(plan_id,equipment_id,quantity,notes,situation,created_by)
   VALUES(p_plan_id,eid,(r->>'quantity')::integer,coalesce(r->>'notes',''),CASE WHEN lower(coalesce(r->>'notes','')||' '||coalesce(r->>'status','')) LIKE '%sem estoque%' THEN 'Sem estoque' ELSE 'Revisão necessária' END,auth.uid());
  END IF;
  n:=n+1;
 END LOOP;
 INSERT INTO public.equipment_import_batches(plan_id,filename,valid_count,invalid_count,duplicate_count,details,created_by) VALUES(p_plan_id,p_filename,n,p_invalid,p_duplicates,p_rows,auth.uid());
 RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.copy_equipment_edition(p_target uuid,p_source uuid,p_snapshot jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer; source_plan public.fair_equipment_plans; target_year integer; snapshot jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 IF p_target=p_source THEN RAISE EXCEPTION 'Selecione outra edição'; END IF;
 SELECT edition_year INTO target_year FROM public.fair_equipment_plans WHERE id=p_target AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Planejamento não encontrado'; END IF;
 SELECT * INTO source_plan FROM public.fair_equipment_plans WHERE id=p_source AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Edição anterior não encontrada'; END IF;
 IF source_plan.edition_year>=target_year THEN RAISE EXCEPTION 'Selecione uma edição anterior'; END IF;
 IF EXISTS(SELECT 1 FROM public.fair_equipment_items WHERE plan_id=p_target AND deleted_at IS NULL) THEN RAISE EXCEPTION 'A lista atual deve estar vazia para copiar uma edição'; END IF;
 snapshot := jsonb_build_object('plan',to_jsonb(source_plan),'items',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM public.fair_equipment_items i WHERE plan_id=p_source AND deleted_at IS NULL),'[]'::jsonb),'catalog',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.equipment_catalog e WHERE EXISTS(SELECT 1 FROM public.fair_equipment_items i WHERE i.plan_id=p_source AND i.deleted_at IS NULL AND i.equipment_id=e.id)),'[]'::jsonb));
 INSERT INTO public.fair_equipment_items(plan_id,equipment_id,included,quantity,location,display_mode,manual_area,priority,is_launch,situation,notes,position_x,position_y,rotation,created_by)
 SELECT p_target,equipment_id,included,quantity,location,display_mode,manual_area,priority,is_launch,situation,notes,position_x,position_y,rotation,auth.uid() FROM public.fair_equipment_items WHERE plan_id=p_source AND deleted_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.fair_equipment_plans SET reference_plan_id=p_source,reference_snapshot=snapshot WHERE id=p_target;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.copy_equipment_edition(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_equipment_edition(uuid,uuid,jsonb) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.import_equipment_list(uuid,jsonb,text,integer,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_equipment_list(uuid,jsonb,text,integer,integer,boolean) TO authenticated,service_role;