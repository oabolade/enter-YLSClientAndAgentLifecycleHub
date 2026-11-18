import { Headset, LogOut, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Brand } from "@/components/hub/brand";
import { onNavyTrigger } from "@/components/hub/nav-styles";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { languageOptions } from "@/i18n/config";
import { useAuth } from "@/lib/auth/auth-context";
import { useHub } from "@/lib/hub/hub-context";
import type { HubView } from "@/lib/hub/types";
import { cn } from "@/lib/utils";

const VIEWS: HubView[] = ["client", "agent"];

export const TopNav = () => {
  const { t: clientT, i18n } = useTranslation();
  const { view, setView, personaId, setPersona, personas, isStaff } = useHub();
  const { session, signOut } = useAuth();
  // The Agent Command Center is always in English.
  const t = view === "agent" ? i18n.getFixedT("en") : clientT;

  const languageLabel = (code: string) =>
    languageOptions.find((option) => option.value === code)?.label ?? code;

  const metadataName = session?.user.user_metadata?.full_name;
  const accountName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : (session?.user.email ?? "");

  const leave = () => {
    signOut().catch((error) => {
      console.error("Sign out failed", error);
      toast.error(t("auth.error.generic"));
    });
  };

  return (
    <header className="bg-gradient-navy text-primary-foreground shadow-raised">
      <div className="container flex flex-col gap-3 py-3 xl:flex-row xl:items-center xl:justify-between">
        <Brand title={t("nav.brand")} subtitle={t("nav.brandSub")} />

        {/* Only staff can switch views; a client only ever has the Client Portal. */}
        {isStaff ? (
          <div
            role="tablist"
            className="inline-flex self-start rounded-full border border-primary-foreground/20 bg-primary-foreground/10 p-1 xl:self-auto"
          >
            {VIEWS.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => setView(option)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                  view === option
                    ? "bg-card text-primary shadow-card"
                    : "text-primary-foreground/80 hover:text-primary-foreground",
                )}
              >
                {option === "client" ? (
                  <UserRound className="h-4 w-4" aria-hidden />
                ) : (
                  <Headset className="h-4 w-4" aria-hidden />
                )}
                {option === "client" ? t("nav.viewClient") : t("nav.viewAgent")}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {isStaff && view === "client" ? (
            <Select value={personaId} onValueChange={setPersona}>
              <SelectTrigger
                className={cn(onNavyTrigger, "sm:w-[250px]")}
                aria-label={t("nav.persona")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {personas.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.fullName} · {languageLabel(client.preferredLanguage)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {view === "client" ? (
            <LanguageSwitcher className={cn(onNavyTrigger, "sm:w-[170px]")} />
          ) : null}
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <span className="max-w-[180px] truncate text-sm text-primary-foreground/80">
              {accountName}
            </span>
            <Button variant="onNavy" size="sm" onClick={leave}>
              <LogOut />
              {t("auth.signOut")}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
