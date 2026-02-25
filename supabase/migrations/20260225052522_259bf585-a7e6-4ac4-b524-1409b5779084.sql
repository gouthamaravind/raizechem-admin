
-- Temporary public SELECT policies for development (auth bypassed)
CREATE POLICY "Dev: public read employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Dev: public read salary_components" ON public.salary_components FOR SELECT USING (true);
CREATE POLICY "Dev: public read payroll_runs" ON public.payroll_runs FOR SELECT USING (true);
CREATE POLICY "Dev: public read payslips" ON public.payslips FOR SELECT USING (true);
CREATE POLICY "Dev: public read company_settings" ON public.company_settings FOR SELECT USING (true);

-- Also allow insert/update for employees so the form works
CREATE POLICY "Dev: public write employees" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Dev: public update employees" ON public.employees FOR UPDATE USING (true);

-- Allow payroll processing (insert payroll runs & payslips)
CREATE POLICY "Dev: public write payroll_runs" ON public.payroll_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: public write payslips" ON public.payslips FOR ALL USING (true) WITH CHECK (true);
