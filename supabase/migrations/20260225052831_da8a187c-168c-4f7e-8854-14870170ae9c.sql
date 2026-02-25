
-- Remove temporary dev policies now that auth is restored
DROP POLICY IF EXISTS "Dev: public read employees" ON public.employees;
DROP POLICY IF EXISTS "Dev: public read salary_components" ON public.salary_components;
DROP POLICY IF EXISTS "Dev: public read payroll_runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Dev: public read payslips" ON public.payslips;
DROP POLICY IF EXISTS "Dev: public read company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Dev: public write employees" ON public.employees;
DROP POLICY IF EXISTS "Dev: public update employees" ON public.employees;
DROP POLICY IF EXISTS "Dev: public write payroll_runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Dev: public write payslips" ON public.payslips;
