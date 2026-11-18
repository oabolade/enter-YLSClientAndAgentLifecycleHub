import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AgentCommandCenter } from "@/components/hub/agent/agent-command-center";
import { ClientPortal } from "@/components/hub/client/client-portal";
import { TopNav } from "@/components/hub/top-nav";
import { Button } from "@/components/ui/button";
import { useHub } from "@/lib/hub/hub-context";
import { HubProvider } from "@/lib/hub/hub-provider";

const HubShell = () => {
  const { t: clientT, i18n } = useTranslation();
  const { view, status, retry } = useHub();
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
        {/* Both views stay mounted so switching keeps your place in each one. */}
        {status === "ready" ? (
          <>
            <div className={view === "client" ? "" : "hidden"}>
              <ClientPortal />
            </div>
            <div className={view === "agent" ? "" : "hidden"}>
              <AgentCommandCenter />
            </div>
          </>
        ) : null}
      </main>
      <footer className="border-t bg-card py-3">
        <p className="container text-center text-xs text-muted-foreground">{t("nav.demoNote")}</p>
      </footer>
    </div>
  );
};

const Index = () => (
  <HubProvider>
    <HubShell />
  </HubProvider>
);

export default Index;
