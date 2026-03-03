CREATE OR REPLACE FUNCTION public.deduct_store_credits(p_user_id uuid, p_amount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_current_credits numeric;
BEGIN
  -- Lock the row for update to prevent concurrent race conditions
  SELECT store_credits INTO v_current_credits
  FROM public.membros
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_credits IS NULL OR v_current_credits < p_amount THEN
    RETURN FALSE; -- Insufficient funds or user not found
  END IF;

  UPDATE public.membros
  SET store_credits = store_credits - p_amount
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$function$;
