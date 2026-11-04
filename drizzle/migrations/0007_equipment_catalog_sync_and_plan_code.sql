ALTER TABLE public.equipment_catalog
 ADD COLUMN IF NOT EXISTS subcategory text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS plan_code_manual boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS dimensions_manual boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS dimension_source text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS packaging_dimensions text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS sync_error text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS is_equipment boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.sync_equipment_catalog(p_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r jsonb; n integer:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
 IF jsonb_array_length(p_rows)>200 THEN RAISE EXCEPTION 'Lote muito grande'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  INSERT INTO public.equipment_catalog AS e(ccm_code,normalized_code,name,model,brand,category,subcategory,length_mm,width_mm,height_mm,net_weight,gross_weight,photo_url,official_url,specifications,situation,source,last_checked_at,dimension_status,dimension_source,packaging_dimensions,plan_code,sync_error,is_equipment,created_by)
  VALUES(r->>'ccm_code',r->>'normalized_code',coalesce(r->>'name',''),coalesce(r->>'model',''),coalesce(r->>'brand',''),coalesce(r->>'category',''),coalesce(r->>'subcategory',''),
   nullif(r->>'length_mm','')::numeric,nullif(r->>'width_mm','')::numeric,nullif(r->>'height_mm','')::numeric,nullif(r->>'net_weight','')::numeric,nullif(r->>'gross_weight','')::numeric,
   r->>'photo_url',r->>'official_url',coalesce(r->'specifications','{}'::jsonb),coalesce(r->>'situation','Ativo'),'Site oficial CCM do Brasil',now(),coalesce(r->>'dimension_status','Pendentes'),coalesce(r->>'dimension_source',''),coalesce(r->>'packaging_dimensions',''),coalesce(r->>'plan_code',''),coalesce(r->>'sync_error',''),coalesce((r->>'is_equipment')::boolean,true),auth.uid())
  ON CONFLICT (normalized_code) DO UPDATE SET
   name=excluded.name, model=excluded.model, brand=excluded.brand, category=excluded.category, subcategory=excluded.subcategory,
   photo_url=coalesce(excluded.photo_url,e.photo_url), official_url=excluded.official_url, specifications=excluded.specifications,
   net_weight=coalesce(excluded.net_weight,e.net_weight), gross_weight=coalesce(excluded.gross_weight,e.gross_weight),
   situation=excluded.situation, source=excluded.source, last_checked_at=now(), packaging_dimensions=excluded.packaging_dimensions,
   sync_error=excluded.sync_error, is_equipment=excluded.is_equipment,
   length_mm=CASE WHEN e.dimensions_manual OR excluded.length_mm IS NULL THEN e.length_mm ELSE excluded.length_mm END,
   width_mm=CASE WHEN e.dimensions_manual OR excluded.width_mm IS NULL THEN e.width_mm ELSE excluded.width_mm END,
   height_mm=CASE WHEN e.dimensions_manual OR excluded.height_mm IS NULL THEN e.height_mm ELSE excluded.height_mm END,
   dimension_source=CASE WHEN e.dimensions_manual OR excluded.length_mm IS NULL THEN e.dimension_source ELSE excluded.dimension_source END,
   dimension_status=CASE WHEN e.dimensions_manual OR excluded.length_mm IS NULL THEN e.dimension_status ELSE excluded.dimension_status END,
   plan_code=CASE WHEN e.plan_code_manual THEN e.plan_code ELSE excluded.plan_code END;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.deactivate_missing_equipment(p_active_codes text[]) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
 IF coalesce(array_length(p_active_codes,1),0)<50 THEN RAISE EXCEPTION 'Lista de produtos ativos incompleta; nada foi desativado.'; END IF;
 UPDATE public.equipment_catalog SET situation='Inativo no site', last_checked_at=now()
  WHERE source='Site oficial CCM do Brasil' AND situation='Ativo' AND NOT (normalized_code = ANY(p_active_codes));
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.bulk_update_equipment_dimensions(p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r jsonb; updated integer:=0; missing text[]:='{}'; c integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
 IF jsonb_array_length(p_rows)>5000 THEN RAISE EXCEPTION 'Importe até 5.000 linhas por vez.'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  UPDATE public.equipment_catalog SET length_mm=(r->>'length_mm')::numeric, width_mm=(r->>'width_mm')::numeric, height_mm=nullif(r->>'height_mm','')::numeric,
   model=CASE WHEN coalesce(r->>'model','')<>'' AND model='' THEN r->>'model' ELSE model END,
   dimension_source=coalesce(nullif(r->>'source',''),'Planilha de dimensões'), dimensions_manual=true,
   dimension_status=CASE WHEN nullif(r->>'height_mm','') IS NULL THEN 'Incompletas' ELSE 'Completas' END
  WHERE normalized_code=r->>'normalized_code';
  GET DIAGNOSTICS c=ROW_COUNT; IF c=0 THEN missing:=missing||(r->>'normalized_code'); ELSE updated:=updated+c; END IF;
 END LOOP;
 RETURN jsonb_build_object('updated',updated,'missing',missing);
END $$;
GRANT EXECUTE ON FUNCTION public.sync_equipment_catalog(jsonb), public.deactivate_missing_equipment(text[]), public.bulk_update_equipment_dimensions(jsonb) TO authenticated;