import { ClipboardList, FolderLock, MessagesSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ConciergeChat } from "@/components/hub/client/concierge-chat";
import { IntakeWizard } from "@/components/hub/client/intake-wizard";
import { PolicyVault } from "@/components/hub/client/policy-vault";
import { PortalHero } from "@/components/hub/portal-hero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHub } from "@/lib/hub/hub-context";
import type { ClientTab } from "@/lib/hub/types";

const triggerClass =
  "flex h-full flex-col gap-1 whitespace-normal px-2 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:flex-row sm:gap-2 sm:text-sm";
const contentClass = "mt-5 data-[state=inactive]:hidden";

export const ClientPortal = () => {
  const { t } = useTranslation();
  const { currentClient, clientTab, setClientTab } = useHub();

  return (
    <div className="space-y-6">
      <PortalHero
        title={
          currentClient
            ? t("portal.welcome", { name: currentClient.fullName })
            : t("portal.welcomeGuest")
        }
        body={t("portal.subtitle")}
      />

      <Tabs value={clientTab} onValueChange={(value) => setClientTab(value as ClientTab)}>
        <TabsList className="grid h-auto w-full grid-cols-3 bg-secondary p-1">
          <TabsTrigger value="intake" className={triggerClass}>
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
            {t("tabs.intake")}
          </TabsTrigger>
          <TabsTrigger value="concierge" className={triggerClass}>
            <MessagesSquare className="h-4 w-4 shrink-0" aria-hidden />
            {t("tabs.concierge")}
          </TabsTrigger>
          <TabsTrigger value="vault" className={triggerClass}>
            <FolderLock className="h-4 w-4 shrink-0" aria-hidden />
            {t("tabs.vault")}
          </TabsTrigger>
        </TabsList>
        {/* Kept mounted so intake progress and chat history survive tab switches. */}
        <TabsContent value="intake" forceMount className={contentClass}>
          <IntakeWizard />
        </TabsContent>
        <TabsContent value="concierge" forceMount className={contentClass}>
          <ConciergeChat />
        </TabsContent>
        <TabsContent value="vault" forceMount className={contentClass}>
          <PolicyVault />
        </TabsContent>
      </Tabs>
    </div>
  );
};
