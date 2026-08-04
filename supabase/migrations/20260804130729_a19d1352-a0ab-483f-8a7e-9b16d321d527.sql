CREATE TABLE public.image_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  related_fair text,
  reference_year text,
  city text,
  state text,
  objective text,
  notes text,
  responsible text,
  status text NOT NULL DEFAULT 'Rascunho',
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis jsonb,
  briefing text,
  checklist jsonb,
  quote_summary text,
  comparison jsonb,
  complexity text,
  complexity_reason text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_projects TO authenticated;
GRANT ALL ON public.image_projects TO service_role;

ALTER TABLE public.image_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read image projects" ON public.image_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert image projects" ON public.image_projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update image projects" ON public.image_projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete image projects" ON public.image_projects FOR DELETE TO authenticated USING (true);

CREATE TRIGGER image_projects_set_updated_at BEFORE UPDATE ON public.image_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();