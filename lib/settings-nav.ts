import type { LucideIcon } from "lucide-react";
import { Building2, Globe, Puzzle, User, Users } from "lucide-react";

export interface SettingsNavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Secondary navigation for `/admin/settings/*` — order matches product IA; Integrations is included here. */
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: "profile", href: "/admin/settings/profile", label: "Profile", icon: User },
  { id: "team", href: "/admin/settings/team", label: "Team", icon: Users },
  { id: "timezone", href: "/admin/settings/timezone", label: "Timezone", icon: Globe },
  { id: "company", href: "/admin/settings/company", label: "Company settings", icon: Building2 },
  { id: "integrations", href: "/admin/settings/integrations", label: "Integrations", icon: Puzzle },
];
