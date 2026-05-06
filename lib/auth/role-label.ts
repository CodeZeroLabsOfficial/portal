import type { UserRole } from "@/types/user";

/**
 * Display label for a `UserRole` ("Admin" / "Team" / "Customer"). Shared by the
 * profile view and the edit-profile form (previously duplicated locally in
 * both).
 */
export function roleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "team":
      return "Team";
    default:
      return "Customer";
  }
}
