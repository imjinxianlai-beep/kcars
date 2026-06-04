-- K-Cars CRM: database-level lock for paid / voided invoices
-- Run this manually in Supabase SQL Editor.
--
-- Rules:
-- 1. draft invoices can be hard deleted.
-- 2. confirmed / paid invoices cannot be hard deleted.
-- 3. paid invoices cannot be edited after payment.
-- 4. voided invoices are read-only.
-- 5. paid / confirmed invoices can still be voided through voided_at + void_reason.
-- 6. invoice_items and invoice_parts_pending inherit the invoice lock.

-- 1) Lock invoice row updates/deletes.
CREATE OR REPLACE FUNCTION public.prevent_locked_invoice_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed_void_update boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'Voided invoices cannot be deleted.';
    END IF;

    IF OLD.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Only draft invoices can be deleted. Void confirmed or paid invoices instead.';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'Voided invoices are locked and cannot be changed.';
    END IF;

    IF NEW.voided_at IS NOT NULL AND NULLIF(TRIM(COALESCE(NEW.void_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Void reason is required.';
    END IF;

    -- Paid invoices are locked, except for the one allowed transition:
    -- adding voided_at + void_reason. updated_at is allowed because it may be
    -- maintained by a generic updated_at trigger.
    IF OLD.status = 'paid' OR OLD.work_status = 'paid' THEN
      allowed_void_update :=
        OLD.voided_at IS NULL
        AND NEW.voided_at IS NOT NULL
        AND NULLIF(TRIM(COALESCE(NEW.void_reason, '')), '') IS NOT NULL
        AND (to_jsonb(NEW) - 'voided_at' - 'void_reason' - 'updated_at')
            = (to_jsonb(OLD) - 'voided_at' - 'void_reason' - 'updated_at');

      IF NOT allowed_void_update THEN
        RAISE EXCEPTION 'Paid invoices are locked. Void the invoice instead of editing it.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_invoice_changes ON public.invoices;
CREATE TRIGGER trg_prevent_locked_invoice_changes
BEFORE UPDATE OR DELETE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_invoice_changes();


-- 2) Lock child invoice item rows when their parent invoice is paid / voided.
CREATE OR REPLACE FUNCTION public.prevent_locked_invoice_child_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_invoice record;
  parent_invoice_id uuid;
BEGIN
  parent_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT status, work_status, voided_at
  INTO parent_invoice
  FROM public.invoices
  WHERE id = parent_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent invoice % does not exist.', parent_invoice_id;
  END IF;

  IF parent_invoice.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Voided invoices are locked and their child rows cannot be changed.';
  END IF;

  IF parent_invoice.status = 'paid' OR parent_invoice.work_status = 'paid' THEN
    RAISE EXCEPTION 'Paid invoices are locked and their child rows cannot be changed.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_invoice_items_changes ON public.invoice_items;
CREATE TRIGGER trg_prevent_locked_invoice_items_changes
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_invoice_child_changes();

DROP TRIGGER IF EXISTS trg_prevent_locked_invoice_parts_pending_changes ON public.invoice_parts_pending;
CREATE TRIGGER trg_prevent_locked_invoice_parts_pending_changes
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_parts_pending
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_invoice_child_changes();


-- 3) Verification queries. Run after the migration.
-- Confirm triggers exist:
SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trg_prevent_locked_invoice_changes',
    'trg_prevent_locked_invoice_items_changes',
    'trg_prevent_locked_invoice_parts_pending_changes'
  )
ORDER BY table_name, trigger_name, event_manipulation;

-- Optional safety check: there should be no voided invoice without a reason.
SELECT invoice_no, status, work_status, voided_at, void_reason
FROM public.invoices
WHERE voided_at IS NOT NULL
  AND NULLIF(TRIM(COALESCE(void_reason, '')), '') IS NULL;
