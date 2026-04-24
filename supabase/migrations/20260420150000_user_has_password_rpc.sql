set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.user_has_password()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND COALESCE(encrypted_password, '') <> ''
  );
END;
$function$;
