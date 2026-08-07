ALTER TABLE public.project_renders
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'Gerada pela ferramenta',
  ADD COLUMN IF NOT EXISTS mode text;

ALTER TABLE public.image_projects
  ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;