
-- Phase 12: Employee Payroll tables

-- Employees master
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  designation TEXT,
  department TEXT,
  date_of_joining DATE,
  basic_salary NUMERIC NOT NULL DEFAULT 0,
  bank_account TEXT,
  pan TEXT,
  uan TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage employees" ON public.employees FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Any role can view employees" ON public.employees FOR SELECT
  USING (has_any_role(auth.uid()));

-- Salary components
CREATE TABLE public.salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'earning',
  is_percentage BOOLEAN NOT NULL DEFAULT false,
  value NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage salary components" ON public.salary_components FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Any role can view salary components" ON public.salary_components FOR SELECT
  USING (has_any_role(auth.uid()));

-- Payroll runs
CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_gross NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  total_net NUMERIC NOT NULL DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage payroll runs" ON public.payroll_runs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Any role can view payroll runs" ON public.payroll_runs FOR SELECT
  USING (has_any_role(auth.uid()));

-- Payslips
CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  basic NUMERIC NOT NULL DEFAULT 0,
  gross NUMERIC NOT NULL DEFAULT 0,
  deductions JSONB NOT NULL DEFAULT '{}',
  earnings JSONB NOT NULL DEFAULT '{}',
  net_pay NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage payslips" ON public.payslips FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Any role can view payslips" ON public.payslips FOR SELECT
  USING (has_any_role(auth.uid()));

-- Phase 13: Add invoice_template column to company_settings
ALTER TABLE public.company_settings ADD COLUMN invoice_template TEXT NOT NULL DEFAULT 'standard';
