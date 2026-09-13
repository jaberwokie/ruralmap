-- Restrict access to files in the private 'source-evidence' bucket to admin/sysop users
DROP POLICY IF EXISTS "source_evidence_select" ON storage.objects;
DROP POLICY IF EXISTS "source_evidence_insert" ON storage.objects;
DROP POLICY IF EXISTS "source_evidence_update" ON storage.objects;
DROP POLICY IF EXISTS "source_evidence_delete" ON storage.objects;

CREATE POLICY "source_evidence_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'source-evidence'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sysop'::public.app_role))
);

CREATE POLICY "source_evidence_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'source-evidence'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sysop'::public.app_role))
);

CREATE POLICY "source_evidence_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'source-evidence'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sysop'::public.app_role))
)
WITH CHECK (
  bucket_id = 'source-evidence'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sysop'::public.app_role))
);

CREATE POLICY "source_evidence_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'source-evidence'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'sysop'::public.app_role))
);