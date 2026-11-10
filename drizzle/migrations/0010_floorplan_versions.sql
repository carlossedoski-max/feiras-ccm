CREATE TABLE public.fair_equipment_floorplan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.fair_equipment_plans(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  layout jsonb NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fair_equipment_floorplan_versions TO authenticated;
GRANT ALL ON public.fair_equipment_floorplan_versions TO service_role;
ALTER TABLE public.fair_equipment_floorplan_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage floorplan versions" ON public.fair_equipment_floorplan_versions FOR ALL TO authenticated
USING (public.is_team_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.fair_equipment_plans p WHERE p.id = plan_id))
WITH CHECK (public.is_team_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.fair_equipment_plans p WHERE p.id = plan_id) AND octet_length(layout::text) < 2000000);
CREATE INDEX fair_equipment_floorplan_versions_plan_idx ON public.fair_equipment_floorplan_versions(plan_id, created_at DESC);