
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Any authenticated can view branches" ON public.branches;
CREATE POLICY "Admin and accounts can view branches" ON public.branches
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

DROP POLICY IF EXISTS "Authenticated users with role can view settings" ON public.company_settings;
CREATE POLICY "Admin accounts sales can view settings" ON public.company_settings
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'accounts'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated users with role can view dealers" ON public.dealers;
CREATE POLICY "Admin sales accounts can view dealers" ON public.dealers
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
    OR has_role(auth.uid(), 'accounts'::app_role)
  );
CREATE POLICY "Fieldops can view assigned dealers" ON public.dealers
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'fieldops'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.dealer_assignments da
      WHERE da.dealer_id = dealers.id AND da.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Any role can view employees" ON public.employees;
DROP POLICY IF EXISTS "Any role can view payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Any role can view payslips" ON public.payslips;

DROP POLICY IF EXISTS "Employees can view own profile" ON public.employee_profiles;
CREATE POLICY "Admin or own can view employee profile" ON public.employee_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Any role can view gstr2b" ON public.gstr2b_entries;

DROP POLICY IF EXISTS "Any role can view product packs" ON public.product_packs;
CREATE POLICY "Internal roles can view product packs" ON public.product_packs
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
    OR has_role(auth.uid(), 'accounts'::app_role)
    OR has_role(auth.uid(), 'inventory'::app_role)
  );

DROP POLICY IF EXISTS "Any role can view pricing matrix" ON public.product_pricing_matrix;
CREATE POLICY "Internal roles can view pricing matrix" ON public.product_pricing_matrix
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
    OR has_role(auth.uid(), 'accounts'::app_role)
    OR has_role(auth.uid(), 'inventory'::app_role)
  );

DROP POLICY IF EXISTS "Any role can view suppliers" ON public.suppliers;
CREATE POLICY "Admin inventory accounts can view suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'inventory'::app_role)
    OR has_role(auth.uid(), 'accounts'::app_role)
  );
