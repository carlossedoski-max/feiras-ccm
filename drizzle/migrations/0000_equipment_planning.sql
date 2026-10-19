CREATE TABLE public.equipment_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ccm_code text NOT NULL UNIQUE, normalized_code text NOT NULL UNIQUE,
 name text NOT NULL DEFAULT '', model text NOT NULL DEFAULT '', brand text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '',
 length_mm numeric, width_mm numeric, height_mm numeric, net_weight numeric, gross_weight numeric,
 photo_url text, official_url text, specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
 situation text NOT NULL DEFAULT 'Ativo', source text NOT NULL DEFAULT 'Cadastro manual', last_checked_at timestamptz,
 notes text NOT NULL DEFAULT '', dimension_status text NOT NULL DEFAULT 'Pendentes', created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT equipment_positive_dimensions CHECK ((length_mm IS NULL OR length_mm > 0) AND (width_mm IS NULL OR width_mm > 0) AND (height_mm IS NULL OR height_mm > 0)),
 CONSTRAINT equipment_code_digits CHECK (normalized_code ~ '^[0-9]+$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_catalog TO authenticated;
GRANT ALL ON public.equipment_catalog TO service_role;
ALTER TABLE public.equipment_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated equipment catalog" ON public.equipment_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER equipment_catalog_updated BEFORE UPDATE ON public.equipment_catalog FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fair_equipment_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fair_id uuid NOT NULL REFERENCES public.fairs(id) ON DELETE CASCADE, edition_year integer NOT NULL,
 total_area numeric NOT NULL DEFAULT 0, terrain_width numeric NOT NULL DEFAULT 0, terrain_depth numeric NOT NULL DEFAULT 0,
 stand_area numeric NOT NULL DEFAULT 0, stand_width numeric NOT NULL DEFAULT 0, stand_depth numeric NOT NULL DEFAULT 0,
 internal_reserved numeric NOT NULL DEFAULT 0, external_reserved numeric NOT NULL DEFAULT 0,
 circulation_percent numeric NOT NULL DEFAULT 25, notes text NOT NULL DEFAULT '', reference_plan_id uuid REFERENCES public.fair_equipment_plans(id) ON DELETE SET NULL,
 reference_snapshot jsonb, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(fair_id, edition_year), CONSTRAINT equipment_nonnegative_plan CHECK(total_area >= 0 AND stand_area >= 0 AND stand_area <= total_area AND internal_reserved >= 0 AND internal_reserved <= stand_area AND external_reserved >= 0 AND external_reserved <= total_area - stand_area AND circulation_percent >= 0 AND terrain_width >= 0 AND terrain_depth >= 0 AND stand_width >= 0 AND stand_depth >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fair_equipment_plans TO authenticated;
GRANT ALL ON public.fair_equipment_plans TO service_role;
ALTER TABLE public.fair_equipment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated equipment plans" ON public.fair_equipment_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER fair_equipment_plans_updated BEFORE UPDATE ON public.fair_equipment_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fair_equipment_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.fair_equipment_plans(id) ON DELETE CASCADE,
 equipment_id uuid NOT NULL REFERENCES public.equipment_catalog(id), included boolean NOT NULL DEFAULT true,
 quantity integer NOT NULL DEFAULT 1 CHECK(quantity > 0), location text NOT NULL DEFAULT 'Área externa', display_mode text NOT NULL DEFAULT 'No chão',
 manual_area numeric CHECK(manual_area IS NULL OR manual_area >= 0), priority text NOT NULL DEFAULT 'Complementar', is_launch boolean NOT NULL DEFAULT false,
 situation text NOT NULL DEFAULT 'Revisão necessária', notes text NOT NULL DEFAULT '', position_x numeric, position_y numeric, rotation integer NOT NULL DEFAULT 0,
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fair_equipment_items TO authenticated;
GRANT ALL ON public.fair_equipment_items TO service_role;
ALTER TABLE public.fair_equipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated equipment items" ON public.fair_equipment_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX fair_equipment_items_plan ON public.fair_equipment_items(plan_id);
CREATE TRIGGER fair_equipment_items_updated BEFORE UPDATE ON public.fair_equipment_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.equipment_import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.fair_equipment_plans(id) ON DELETE CASCADE,
 filename text NOT NULL, valid_count integer NOT NULL DEFAULT 0, invalid_count integer NOT NULL DEFAULT 0,
 duplicate_count integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'Confirmada', details jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_import_batches TO authenticated;
GRANT ALL ON public.equipment_import_batches TO service_role;
ALTER TABLE public.equipment_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated equipment imports" ON public.equipment_import_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER equipment_import_batches_updated BEFORE UPDATE ON public.equipment_import_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.import_equipment_list(p_plan_id uuid, p_rows jsonb, p_filename text, p_invalid integer, p_duplicates integer, p_merge boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r jsonb; eid uuid; iid uuid; n integer := 0; normalized text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 PERFORM id FROM public.fair_equipment_plans WHERE id=p_plan_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Planejamento não encontrado'; END IF;
 IF jsonb_array_length(p_rows)>5000 THEN RAISE EXCEPTION 'Limite de 5000 linhas'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  normalized := regexp_replace(r->>'code','[^0-9]','','g');
  IF normalized='' OR coalesce((r->>'quantity')::integer,0)<=0 THEN RAISE EXCEPTION 'Linha inválida'; END IF;
  INSERT INTO public.equipment_catalog(ccm_code,normalized_code,name,created_by)
  VALUES (trim(r->>'code'),normalized,coalesce(r->>'name',''),auth.uid()) ON CONFLICT DO NOTHING;
  SELECT id INTO eid FROM public.equipment_catalog WHERE normalized_code=normalized;
  SELECT id INTO iid FROM public.fair_equipment_items WHERE plan_id=p_plan_id AND equipment_id=eid ORDER BY created_at LIMIT 1;
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
REVOKE ALL ON FUNCTION public.import_equipment_list(uuid,jsonb,text,integer,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_equipment_list(uuid,jsonb,text,integer,integer,boolean) TO authenticated, service_role;

CREATE FUNCTION public.copy_equipment_edition(p_target uuid,p_source uuid,p_snapshot jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 IF p_target=p_source THEN RAISE EXCEPTION 'Selecione outra edição'; END IF;
 PERFORM id FROM public.fair_equipment_plans WHERE id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Planejamento não encontrado'; END IF;
 IF EXISTS(SELECT 1 FROM public.fair_equipment_items WHERE plan_id=p_target) THEN RAISE EXCEPTION 'A lista atual deve estar vazia para copiar uma edição'; END IF;
 INSERT INTO public.fair_equipment_items(plan_id,equipment_id,included,quantity,location,display_mode,manual_area,priority,is_launch,situation,notes,created_by)
 SELECT p_target,equipment_id,included,quantity,location,display_mode,manual_area,priority,is_launch,situation,notes,auth.uid() FROM public.fair_equipment_items WHERE plan_id=p_source;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.fair_equipment_plans SET reference_plan_id=p_source,reference_snapshot=p_snapshot WHERE id=p_target;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.copy_equipment_edition(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_equipment_edition(uuid,uuid,jsonb) TO authenticated,service_role;