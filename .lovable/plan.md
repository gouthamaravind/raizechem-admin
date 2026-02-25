

## Fix: Login Page Stuck on "Signing in..."

### Root Cause

Two issues in `src/pages/Login.tsx`:

1. **No try/catch/finally** in `handleSubmit` -- if anything throws after the auth call, `setLoading(false)` never runs, leaving the button permanently stuck on "Signing in..."
2. **Side effect during render** -- `navigate()` is called directly in the render body (`if (session) { navigate(...); return null; }`), which is a React anti-pattern and can cause race conditions with auth state updates

### Changes

**File: `src/pages/Login.tsx`**

1. Replace the render-time `navigate` with the `<Navigate>` component (already imported)
2. Wrap `handleSubmit` in try/catch/finally so `setLoading(false)` always runs
3. Add a timeout safety net so the button can't stay stuck forever

```text
Before:
  if (session) {
    navigate("/dashboard", { replace: true });
    return null;
  }

After:
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }
```

```text
Before:
  const handleSubmit = async (e) => {
    e.preventDefault();
    ...
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) { ... } else { navigate(...); }
  };

After:
  const handleSubmit = async (e) => {
    e.preventDefault();
    ...
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };
```

This ensures the loading state always resets regardless of what happens during sign-in.

