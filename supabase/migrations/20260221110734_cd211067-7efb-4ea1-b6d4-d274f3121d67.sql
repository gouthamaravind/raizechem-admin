
-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users with admin role to upload
CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow authenticated users with admin role to update
CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-assets'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow authenticated users with admin role to delete
CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets'
  AND public.has_role(auth.uid(), 'admin')
);

-- Public read access for company assets (logos on invoices, etc.)
CREATE POLICY "Public can read company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');
