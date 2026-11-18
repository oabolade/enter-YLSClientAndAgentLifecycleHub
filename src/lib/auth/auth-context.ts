import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

export type AuthContextValue = {
  /** The signed-in session, including the user. Null when signed out. */
  session: Session | null;
  /** True until the saved session has been restored. */
  loading: boolean;
  /** True after a password-reset link was opened and a new password must be chosen. */
  recovering: boolean;
  finishRecovery: () => void;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

/** Where emailed confirmation and password links bring the person back to. */
export const authRedirectUrl = () => `${window.location.origin}/`;
