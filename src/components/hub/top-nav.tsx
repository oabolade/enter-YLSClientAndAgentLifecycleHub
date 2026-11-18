import { Headset, ShieldCheck, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { languageOptions } from "@/i18n/config";
import { useHub } from "@/lib/hub/hub-context";
import { GUEST_PERSONA, type HubView } from "@/lib/hub/types";
import { cn } from "@/lib/utils";

const VIEWS: HubView[] = ["client", "agent"];
const onNavyTrigger =
  "h-9 border-primary-foreground/25 bg-primary-foreground/10 text-sm text-primary-foreground";

export const TopNav = () => {
  const { t: clientT, i18n } = useTranslation();
  const { view, setView, personaId, setPersona, personas } = useHub();
  // The Agent Command Center is always in English.
  const t = view === "agent" ? i18n.getFixedT("en") : clientT;

  const languageLabel = (code: string) =>
    languageOptions.find((option) => option.value === code)?.label ?? code;

  return (
    <header className="bg-gradient-navy text-primary-foreground shadow-raised">
      <div className="container flex flex-col gap-3 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-crimson text-crimson-foreground">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">{t("nav.brand")}</p>
            <p className="truncate text-xs text-primary-foreground/70">{t("nav.brandSub")}</p>
          </div>
        </div>

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

        {view === "client" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={personaId} onValueChange={setPersona}>
              <SelectTrigger
                className={cn(onNavyTrigger, "sm:w-[270px]")}
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
                <SelectItem value={GUEST_PERSONA}>{t("nav.personaGuest")}</SelectItem>
              </SelectContent>
            </Select>
            <LanguageSwitcher className={cn(onNavyTrigger, "sm:w-[190px]")} />
          </div>
        ) : (
          <div className="hidden xl:block xl:w-[270px]" aria-hidden />
        )}
      </div>
    </header>
  );
};
