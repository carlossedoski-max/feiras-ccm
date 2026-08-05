ALTER TABLE public.image_projects
  ADD COLUMN IF NOT EXISTS target_budget text,
  ADD COLUMN IF NOT EXISTS budget_tier text,
  ADD COLUMN IF NOT EXISTS main_brand text,
  ADD COLUMN IF NOT EXISTS fair_type text,
  ADD COLUMN IF NOT EXISTS required_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_sent_at date,
  ADD COLUMN IF NOT EXISTS quote_status text,
  ADD COLUMN IF NOT EXISTS estimated_value numeric,
  ADD COLUMN IF NOT EXISTS supplier_notes text;

CREATE TABLE IF NOT EXISTS public.project_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.image_projects(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  label text NOT NULL DEFAULT 'Projeto inicial',
  image_path text NOT NULL,
  image_type text NOT NULL DEFAULT 'image/png',
  prompt text,
  briefing text,
  style text,
  period text,
  ambience text,
  budget_tier text,
  target_budget text,
  fair_type text,
  city text,
  state text,
  main_brand text,
  required_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  defined_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  visual_summary text,
  notes text,
  responsible text,
  status text NOT NULL DEFAULT 'Rascunho',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_renders TO authenticated;
GRANT ALL ON public.project_renders TO service_role;

ALTER TABLE public.project_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read project renders" ON public.project_renders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert project renders" ON public.project_renders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update project renders" ON public.project_renders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete project renders" ON public.project_renders FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS project_renders_project_idx ON public.project_renders (project_id, version DESC);