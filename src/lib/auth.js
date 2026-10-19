import { useEffect, useState } from "react";

import { supabase } from "./supabase";

// Current Supabase login, shared by the storefront and the admin.
export function useSession() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

// Asks the database whether this login is on the allow-list (public.is_admin()).
// Keyed by the access token, not the user: entering the two-factor code issues a
// new token, and only that one carries the admin rights.
export function useAdminAccess(session) {
  const token = session?.access_token;
  const userId = session?.user?.id;
  const [access, setAccess] = useState({ token: null, userId: null, status: "checking" });
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    supabase.rpc("is_admin").then(({ data, error }) => {
      if (cancelled) return;
      setAccess(
        error
          ? { token, userId, status: "error", message: error.message }
          : { token, userId, status: data ? "ok" : "denied" },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [token, userId]);
  if (access.token === token) return access;
  // The hourly token refresh keeps an open admin open while it is re-checked (the
  // database checks every request anyway). Anything else waits for the new verdict.
  if (access.userId === userId && access.status === "ok") return access;
  return { status: "checking" };
}

// Whether this login still owes its two-factor code: "checking" | "needs-code" | "ok".
export function useSecondFactor(session) {
  const token = session?.access_token;
  const [state, setState] = useState({ token: null, status: "checking" });
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (cancelled) return;
      const owesCode = data?.nextLevel === "aal2" && data?.currentLevel !== "aal2";
      setState({ token, status: owesCode ? "needs-code" : "ok" });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);
  return state.token === token ? state.status : "checking";
}
