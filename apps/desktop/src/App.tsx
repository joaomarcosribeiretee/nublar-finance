import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/Toast";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { Shell } from "@/features/shell/Shell";
import { queryClient } from "@/lib/queries";
import { getSupabase, supabaseConfigError } from "@/lib/supabase";

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const configError = supabaseConfigError();

  useEffect(() => {
    if (configError) {
      setReady(true);
      return;
    }

    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        // Never show one user's cached numbers to the next one.
        queryClient.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [configError]);

  if (!ready) {
    return <main className="h-full" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {session ? (
          <Shell key={session.user.id} email={session.user.email ?? ""} />
        ) : (
          <AuthScreen />
        )}
      </ToastProvider>
    </QueryClientProvider>
  );
}
