import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Brand } from "@/components/hub/brand";
import { onNavyTrigger } from "@/components/hub/nav-styles";
import { PortalHero } from "@/components/hub/portal-hero";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Mode = "signIn" | "signUp" | "forgot";

/** The only screen a visitor sees until they sign in. */
export const AuthScreen = ({ recovering = false }: { recovering?: boolean }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("signIn");

  const title = recovering
    ? t("auth.title.newPassword")
    : mode === "signIn"
      ? t("auth.title.signIn")
      : mode === "signUp"
        ? t("auth.title.signUp")
        : t("auth.title.forgot");

  return (
    <div className="flex min-h-full flex-col bg-gradient-subtle">
      <header className="bg-gradient-navy text-primary-foreground shadow-raised">
        <div className="container flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Brand title={t("nav.brand")} subtitle={t("nav.brandSub")} />
          <LanguageSwitcher className={cn(onNavyTrigger, "sm:w-[190px]")} />
        </div>
      </header>

      <main className="container flex flex-1 flex-col items-center gap-6 py-6 sm:py-8">
        <PortalHero title={t("hero.title")} body={t("hero.body")} className="w-full" />
        <Card className="w-full max-w-md animate-fade-up shadow-card">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t("auth.subtitle")}
            </p>
          </CardHeader>
          <CardContent>
            {recovering ? (
              <NewPasswordForm />
            ) : mode === "signIn" ? (
              <SignInForm
                onForgot={() => setMode("forgot")}
                onCreateAccount={() => setMode("signUp")}
              />
            ) : mode === "signUp" ? (
              <SignUpForm onSignIn={() => setMode("signIn")} />
            ) : (
              <ForgotPasswordForm onSignIn={() => setMode("signIn")} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
