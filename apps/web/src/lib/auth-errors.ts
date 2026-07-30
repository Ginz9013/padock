// Better Auth's client returns { data, error } where error.code is one of
// its internal error identifiers (see the ERROR_CODES it exposes per
// plugin). Mapped here so the UI never shows a raw internal code to a
// user; unmapped codes fall back to error.message.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "An account with this email already exists.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_TOO_LONG: "Password is too long.",
  USER_NOT_FOUND: "Incorrect email or password.",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in.",
};

export function authErrorMessage(error: { code?: string | null; message?: string | null } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  const code = error.code ?? undefined;
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  return error.message ?? "Something went wrong. Please try again.";
}
