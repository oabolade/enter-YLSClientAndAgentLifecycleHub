import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AgentCommandCenter } from "@/components/hub/agent/agent-command-center";
import { ClientPortal } from "@/components/hub/client/client-portal";
import { TopNav } from "@/components/hub/top-nav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { useHub } from "@/lib/hub/hub-context";
import { HubProvider } from "@/lib/hub/hub-provider";

const HubShell = () => {
  const { t: clientT, i18n } = useTranslation();
  const { view, status, retry, isStaff } = useHub();
  const t = view === "agent" ? i18n.getFixedT("en") : clientT;

  return (
    <div className="flex min-h-full flex-col bg-gradient-subtle">
      <TopNav />
      <main className="container flex-1 py-6 sm:py-8">
        {status === "loading" ? (
          <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t("common.loading")}
          </p>
        ) : null}
        {status === "error" ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="text-sm font-medium text-destructive">{t("common.loadError")}</p>
            <Button variant="outline" onClick={retry}>
              {t("common.retry")}
            </Button>
          </div>
        ) : null}
        {/* Staff keep both views mounted so switching keeps their place in each one. */}
        {status === "ready" ? (
          <>
            <div className={view === "client" ? "" : "hidden"}>
              <ClientPortal />
            </div>
            {isStaff ? (
              <div className={view === "agent" ? "" : "hidden"}>
                <AgentCommandCenter />
              </div>
            ) : null}
          </>
        ) : null}
      </main>
      <footer className="border-t bg-card py-3">
        <p className="container text-center text-xs text-muted-foreground">
          {/* Only staff see sample clients, so only they are told this is sample data. */}
          {isStaff ? t("nav.demoNote") : t("nav.aiNote")}
        </p>
      </footer>
    </div>
  );
};

const Gate = () => {
  const { session, loading, recovering } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (!session) return <AuthScreen />;
  if (recovering) return <AuthScreen recovering />;

  // Keyed by account, so nothing from one person's session carries into the next.
  return (
    <HubProvider key={session.user.id} user={session.user}>
      <HubShell />
    </HubProvider>
  );
};

const Index = () => (
  <AuthProvider>
    <Gate />
  </AuthProvider>
);

export default Index;
