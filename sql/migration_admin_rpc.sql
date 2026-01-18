-- Drop existing to ensure clean state
DROP FUNCTION IF EXISTS get_monthly_intentions(text, text);

-- Recreate WTIHOUT the problematic 'telemovel' column
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
    COALESCE(m.nome, 'Utilizador Removido') as user_name,
    COALESCE(m.email, 'N/A') as user_email
  FROM prayer_intentions pi
  LEFT JOIN membros m ON pi.user_id = m.id
  WHERE pi.created_at >= start_date::timestamptz 
    AND pi.created_at <= end_date::timestamptz
  ORDER BY pi.created_at DESC;
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION get_monthly_intentions(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_intentions(text, text) TO service_role;
