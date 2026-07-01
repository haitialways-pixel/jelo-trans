-- Booking numbers: PH + 6 alphanumeric (8 chars total)
-- e.g. PH2K9M4X7

CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  suffix   text;
BEGIN
  IF NEW.booking_number IS NULL OR btrim(NEW.booking_number) = '' THEN
    LOOP
      suffix := (
        SELECT string_agg(substr(alphabet, 1 + (get_byte(b, i) % 32), 1), '' ORDER BY i)
        FROM (SELECT gen_random_bytes(6) AS b) g, generate_series(0, 5) AS i
      );
      NEW.booking_number := 'PH' || suffix;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.reservations WHERE booking_number = NEW.booking_number
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;