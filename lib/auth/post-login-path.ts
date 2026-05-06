import type { UserRole } from "@/types/user";

/**
 * When `next` is the generic default (`/dashboard`), staff are sent to the admin workspace.
 * Any other explicit path (e.g. `/customer`, `/admin/subscriptions`) is left unchanged.
 */
export function resolvePostLoginPath(nextPath: string, role: UserRole | undefined): string {
  if (nextPath !== "/dashboard") {
    return nextPath;
  }
  if (role === "admin" || role === "team") {
    return "/admin";
  }
  return "/dashboard";
}
