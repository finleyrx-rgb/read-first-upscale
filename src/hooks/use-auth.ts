// Lightweight auth hook backed by Supabase. Mirrors session state into
// React state and exposes simple sign-in / sign-out helpers.

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true });

  useEffect(() => {
    // Listener FIRST so we don't miss the initial event.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session, loading: false });
    });
    // Then read the persisted session.
    supabase.auth.getSession().then(({ data }) => {
      setState({ user: data.session?.user ?? null, session: data.session, loading: false });
    });
    return () => subscription.unsubscribe();
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
