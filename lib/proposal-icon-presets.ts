import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Award,
  Banknote,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Globe,
  Heart,
  Home,
  Info,
  Lightbulb,
  Mail,
  MapPin,
  Package,
  Phone,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Truck,
  Users,
  Zap,
} from "lucide-react";

/** Default when inserting a new Icon block (Lucide export name). */
export const PROPOSAL_ICON_DEFAULT_NAME = "Sparkles";

/**
 * Curated picker list (Qwilr-style “Suggested” + common proposal icons).
 * `name` must match a `lucide-react` component export.
 */
export const PROPOSAL_ICONS: readonly { readonly name: string; readonly label: string; readonly Icon: LucideIcon }[] =
  [
    { name: "CheckCircle2", label: "Check Circle", Icon: CheckCircle2 },
    { name: "BarChart3", label: "Bar Chart", Icon: BarChart3 },
    { name: "Info", label: "Info", Icon: Info },
    { name: "Building2", label: "Domain", Icon: Building2 },
    { name: "Clock", label: "Schedule", Icon: Clock },
    { name: "Globe", label: "Language", Icon: Globe },
    { name: "Banknote", label: "Payments", Icon: Banknote },
    { name: "ArrowRight", label: "Arrow Right", Icon: ArrowRight },
    { name: "Award", label: "Award", Icon: Award },
    { name: "Briefcase", label: "Briefcase", Icon: Briefcase },
    { name: "Calendar", label: "Calendar", Icon: Calendar },
    { name: "CreditCard", label: "Card", Icon: CreditCard },
    { name: "FileText", label: "Document", Icon: FileText },
    { name: "Heart", label: "Heart", Icon: Heart },
    { name: "Home", label: "Home", Icon: Home },
    { name: "Lightbulb", label: "Lightbulb", Icon: Lightbulb },
    { name: "Mail", label: "Mail", Icon: Mail },
    { name: "MapPin", label: "Location", Icon: MapPin },
    { name: "Package", label: "Package", Icon: Package },
    { name: "Phone", label: "Phone", Icon: Phone },
    { name: "Rocket", label: "Rocket", Icon: Rocket },
    { name: "Shield", label: "Shield", Icon: Shield },
    { name: "Sparkles", label: "Sparkles", Icon: Sparkles },
    { name: "Star", label: "Star", Icon: Star },
    { name: "Target", label: "Target", Icon: Target },
    { name: "ThumbsUp", label: "Thumbs Up", Icon: ThumbsUp },
    { name: "TrendingUp", label: "Trending Up", Icon: TrendingUp },
    { name: "Truck", label: "Truck", Icon: Truck },
    { name: "Users", label: "Users", Icon: Users },
    { name: "Zap", label: "Zap", Icon: Zap },
  ];

const PROPOSAL_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  PROPOSAL_ICONS.map((e) => [e.name, e.Icon]),
) as Record<string, LucideIcon>;

/** First row in the icon picker (“Suggested”). */
export const PROPOSAL_ICON_SUGGESTED_NAMES: readonly string[] = [
  "CheckCircle2",
  "BarChart3",
  "Info",
  "Building2",
  "Clock",
  "Globe",
  "Banknote",
];

export function resolveProposalPresetIcon(name: string | undefined): LucideIcon | null {
  const key = name?.trim();
  if (!key) return null;
  return PROPOSAL_ICON_MAP[key] ?? null;
}

export function proposalPresetIconLabel(name: string | undefined): string {
  const key = name?.trim();
  if (!key) return "Icon";
  const row = PROPOSAL_ICONS.find((e) => e.name === key);
  return row?.label ?? key;
}

export function filterProposalIconsByQuery(query: string): typeof PROPOSAL_ICONS {
  const q = query.trim().toLowerCase();
  if (!q) return PROPOSAL_ICONS;
  return PROPOSAL_ICONS.filter(
    (e) => e.name.toLowerCase().includes(q) || e.label.toLowerCase().includes(q),
  );
}
