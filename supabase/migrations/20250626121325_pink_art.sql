/*
  # Add set_config function for session variables

  1. New Functions
    - `set_config` function to handle session variable setting
      - Allows setting PostgreSQL configuration parameters
      - Supports both local (transaction-scoped) and global settings
      - Required for Row Level Security policies that use session variables

  2. Security
    - Function is created in public schema for accessibility
    - Uses SECURITY DEFINER to ensure proper permissions
*/

CREATE OR REPLACE FUNCTION public.set_config(setting_name text, setting_value text, is_local boolean DEFAULT true)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF is_local THEN
    EXECUTE format('SET LOCAL %I = %L', setting_name, setting_value);
  ELSE
    EXECUTE format('SET %I = %L', setting_name, setting_value);
  END IF;
  RETURN setting_value;
END;
$function$;

-- Grant execute permissions to anonymous users (needed for RLS)
GRANT EXECUTE ON FUNCTION public.set_config(text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.set_config(text, text, boolean) TO authenticated;