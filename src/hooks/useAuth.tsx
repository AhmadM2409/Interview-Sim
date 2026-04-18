import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe FIRST, then fetch the existing session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw result.error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const signInResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInResult.error) {
      throw signInResult.error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const signUpResult = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpResult.error) {
      throw signUpResult.error;
    }

    if (signUpResult.data.session) return;

    const fallbackSignIn = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (fallbackSignIn.error) {
      throw new Error(
        "Account created. For instant login after signup, disable email confirmation in Supabase Auth settings.",
      );
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
