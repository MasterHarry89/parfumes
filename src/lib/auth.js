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
export function useAdminAccess(session) {
  const userId = session?.user?.id;
  const [access, setAccess] = useState({ userId: null, status: "checking" });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.rpc("is_admin").then(({ data, error }) => {
      if (cancelled) return;
      setAccess(
        error
          ? { userId, status: "error", message: error.message }
          : { userId, status: data ? "ok" : "denied" },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  // Never reuse a verdict that belongs to a previous login.
  return access.userId === userId ? access : { status: "checking" };
}
