CREATE TABLE public.fairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  year integer NOT NULL DEFAULT date_part('year', now())::int,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  venue text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'Em análise',
  responsible text,
  commercial text,
  area_size text,
  space_value numeric,
  notes text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  costs jsonb NOT NULL DEFAULT '[]'::jsonb,
  credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  suppliers jsonb NOT NULL DEFAULT '[]'::jsonb,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  manual_analysis jsonb,
  readiness jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness_status text NOT NULL DEFAULT 'Não pronta',
  readiness_confirmed_at timestamp with time zone,
  readiness_confirmed_by text,
  readiness_notes text,
  legacy_id text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fairs_legacy_id_key ON public.fairs (legacy_id) WHERE legacy_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fairs TO authenticated;
GRANT ALL ON public.fairs TO service_role;

ALTER TABLE public.fairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fairs" ON public.fairs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fairs" ON public.fairs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fairs" ON public.fairs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete fairs" ON public.fairs FOR DELETE TO authenticated USING (true);

CREATE TRIGGER fairs_set_updated_at BEFORE UPDATE ON public.fairs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();