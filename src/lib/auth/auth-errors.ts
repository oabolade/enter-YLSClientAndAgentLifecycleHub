import type { TFunction } from "i18next";

export const MIN_PASSWORD_LENGTH = 8;

/** A plain message, in the selected language, for a failed sign-in or account request. */
export function authErrorMessage(t: TFunction, error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "invalid_credentials":
      return t("auth.error.invalid");
    case "email_not_confirmed":
      return t("auth.error.notConfirmed");
    case "user_already_exists":
    case "email_exists":
      return t("auth.error.exists");
    case "weak_password":
      return t("auth.error.weak");
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return t("auth.error.rateLimit");
    default:
      return t("auth.error.generic");
  }
}

export const isNotConfirmed = (error: unknown) =>
  (error as { code?: string } | null)?.code === "email_not_confirmed";
