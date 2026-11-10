CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','member'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;

INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fairs','suppliers','supplier_contacts','image_projects','project_renders'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can delete %s" ON public.%I', replace(t,'_',' '), t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can insert %s" ON public.%I', replace(t,'_',' '), t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can read %s" ON public.%I', replace(t,'_',' '), t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can update %s" ON public.%I', replace(t,'_',' '), t);
    EXECUTE format('CREATE POLICY "Team members manage %s" ON public.%I FOR ALL TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()))', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated equipment catalog" ON public.equipment_catalog;
CREATE POLICY "Team members manage equipment catalog" ON public.equipment_catalog FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));