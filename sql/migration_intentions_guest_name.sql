-- Allow non-logged-in (guest) visitors to submit prayer intentions with a name.
-- The original RLS INSERT policy requires auth.uid() = user_id, so anonymous inserts
-- are blocked and must go through the public API (service role). This adds the column
-- to store the guest's name and surfaces it in the admin monthly intentions RPC.

ALTER TABLE prayer_intentions ADD COLUMN IF NOT EXISTS guest_name TEXT;

DROP FUNCTION IF EXISTS get_monthly_intentions(text, text);

CREATE OR REPLACE FUNCTION get_monthly_intentions(start_date text, end_date text)
RETURNS TABLE (
  id uuid,
  intention_text text,
  candle_type text,
  created_at timestamptz,
  status text,
  amount numeric,
  user_name text,
  user_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.id,
    pi.intention_text,
    pi.candle_type,
    pi.created_at,
    pi.status,
    pi.amount,
    COALESCE(m.nome, NULLIF(pi.guest_name, ''), 'Anónimo') as user_name,
    COALESCE(m.email, '') as user_email
  FROM prayer_intentions pi
  LEFT JOIN membros m ON pi.user_id = m.id
  WHERE pi.created_at >= start_date::timestamptz
    AND pi.created_at <= end_date::timestamptz
  ORDER BY pi.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_intentions(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_intentions(text, text) TO service_role;
