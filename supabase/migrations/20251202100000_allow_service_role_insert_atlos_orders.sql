/*
  # Allow service role to write Atlos orders

  - The Netlify `create-atlos-payment` function uses the Supabase service role key
    to insert rows into `public.atlos_deposit_orders`.
  - RLS currently only allows SELECT for anon users, so inserts fail with
    "Unable to create deposit order".
  - Add explicit INSERT/UPDATE policies for the `service_role` role so the
    server-side function can create and update Atlos orders.
*/

DROP POLICY IF EXISTS "Allow service role to insert Atlos orders" ON public.atlos_deposit_orders;
CREATE POLICY "Allow service role to insert Atlos orders"
  ON public.atlos_deposit_orders
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role to update Atlos orders" ON public.atlos_deposit_orders;
CREATE POLICY "Allow service role to update Atlos orders"
  ON public.atlos_deposit_orders
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

