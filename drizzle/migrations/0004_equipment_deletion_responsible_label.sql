ALTER TABLE public.fair_equipment_plans ADD COLUMN deleted_by_name text;
ALTER TABLE public.fair_equipment_items ADD COLUMN deleted_by_name text;
CREATE OR REPLACE FUNCTION public.equipment_deletion_audit() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' THEN NEW.deleted_at:=NULL; NEW.deleted_by:=NULL; NEW.deleted_by_name:=NULL;
 ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN NEW.deleted_at:=statement_timestamp(); NEW.deleted_by:=auth.uid(); NEW.deleted_by_name:=coalesce(nullif(auth.jwt()->>'email',''),'Usuário autenticado');
 ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN NEW.deleted_at:=OLD.deleted_at; NEW.deleted_by:=OLD.deleted_by; NEW.deleted_by_name:=OLD.deleted_by_name;
 ELSE NEW.deleted_by:=NULL; NEW.deleted_by_name:=NULL; END IF; RETURN NEW;
END $$;