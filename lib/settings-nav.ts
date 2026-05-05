import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CreditCard,
  Puzzle,
  Share2,
  Sparkles,
  User,
  Users,
} from "lucide-react";

export interface SettingsNavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Secondary navigation for `/admin/settings/*` — order matches product IA; Integrations is included here. */
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: "profile", href: "/admin/settings/profile", label: "Profile", icon: User },
  { id: "platforms", href: "/admin/settings/platforms", label: "Platforms", icon: Share2 },
  { id: "voice-ai", href: "/admin/settings/voice-ai", label: "Voice & AI", icon: Sparkles },
  { id: "notifications", href: "/admin/settings/notifications", label: "Notifications", icon: Bell },
  { id: "team", href: "/admin/settings/team", label: "Team", icon: Users },
  { id: "billing", href: "/admin/settings/billing", label: "Billing", icon: CreditCard },
  { id: "integrations", href: "/admin/settings/integrations", label: "Integrations", icon: Puzzle },
];

export function getSettingsNavLabel(pathname: string): string | undefined {
  const match = SETTINGS_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label;
}
