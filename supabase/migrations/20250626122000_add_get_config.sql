/*
  # Add get_config function for debugging

  1. New Functions
    - `get_config` function to read PostgreSQL configuration parameters
    - Used for debugging RLS session variables
    - Pairs with existing `set_config` function

  2. Security
    - Function is created in public schema for accessibility
    - Uses SECURITY DEFINER to ensure proper permissions
    - Grants execute permissions to anonymous users
*/

CREATE OR REPLACE FUNCTION public.get_config(setting_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN current_setting(setting_name, true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

-- Grant execute permissions to anonymous users (needed for debugging)
GRANT EXECUTE ON FUNCTION public.get_config(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_config(text) TO authenticated; 