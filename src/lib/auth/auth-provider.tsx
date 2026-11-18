import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

import { AuthContext, type AuthContextValue } from "./auth-context";

/**
 * Read once, as the page loads, before the address is tidied up: a password-reset link
 * must lead to the new-password form even if its sign-in event fires before we listen.
 */
const openedFromResetLink = window.location.hash.includes("type=recovery");

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(openedFromResetLink);

  useEffect(() => {
    // The listener is registered before the saved session is read, so a restore is never missed.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
    });
    void supabase.auth.getSession().then(({ data: current }) => {
      setSession(current.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const finishRecovery = useCallback(() => setRecovering(false), []);
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, recovering, finishRecovery, signOut }),
    [session, loading, recovering, finishRecovery, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
