CREATE OR REPLACE FUNCTION public.equipment_plan_purge_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fairs WHERE id=OLD.fair_id) THEN RETURN OLD; END IF;
 IF OLD.deleted_at IS NULL OR current_setting('app.equipment_purge_id',true) IS DISTINCT FROM OLD.id::text THEN RAISE EXCEPTION 'Exclusão definitiva permitida somente pela confirmação na Lixeira'; END IF; RETURN OLD;
END $$;
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
  PERFORM set_config('app.equipment_purge_id',p_plan_id::text,true);
  DELETE FROM public.fair_equipment_plans WHERE id=p_plan_id;
  PERFORM set_config('app.equipment_purge_id','',true);
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.manage_equipment_plan(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_equipment_plan(uuid,text,text) TO authenticated;