CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  whatsapp text,
  phone text,
  email text,
  city text,
  state text,
  service_type text NOT NULL DEFAULT 'Outro',
  related_event text,
  how_we_met text,
  status text NOT NULL DEFAULT 'Novo contato',
  approved text NOT NULL DEFAULT 'Avaliar futuramente',
  favorite boolean NOT NULL DEFAULT false,
  notes text,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_uploaded_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  contact_date date NOT NULL DEFAULT current_date,
  channel text NOT NULL DEFAULT 'WhatsApp',
  description text,
  next_action text,
  responsible text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_contacts_supplier ON public.supplier_contacts(supplier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_contacts TO authenticated;
GRANT ALL ON public.supplier_contacts TO service_role;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read supplier contacts" ON public.supplier_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert supplier contacts" ON public.supplier_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update supplier contacts" ON public.supplier_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete supplier contacts" ON public.supplier_contacts FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER suppliers_set_updated_at BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();