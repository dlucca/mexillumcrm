/**
 * Decides where the middleware should redirect a request based on auth state.
 * Pure and framework-free so it can be unit-tested in isolation.
 *
 * - Unauthenticated users on any non-/login route → "/login".
 * - Authenticated users on /login → "/my-actions".
 * - Otherwise no redirect (null). The root "/" for authenticated users is left
 *   to the page-level redirect in app/page.tsx.
 */
export function authRedirectTarget(
  pathname: string,
  isAuthed: boolean
): string | null {
  const onLogin = pathname.startsWith("/login");
  if (!isAuthed && !onLogin) return "/login";
  if (isAuthed && onLogin) return "/my-actions";
  return null;
}
