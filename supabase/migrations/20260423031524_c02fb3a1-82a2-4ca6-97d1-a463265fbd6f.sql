CREATE POLICY "anon read active verified_services"
ON public.verified_services
FOR SELECT
TO anon
USING (active_status = true);

CREATE POLICY "anon read active verified_bh"
ON public.verified_bh
FOR SELECT
TO anon
USING (active_status = true);