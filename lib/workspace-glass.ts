/**
 * Frosted-glass surfaces for the dark workspace shell (top-bar menus, modals).
 * Matches the public preview bar pattern: translucent fill + backdrop blur.
 */

/** Create menu, account menu, and similar dropdown panels. */
export const WORKSPACE_GLASS_DROPDOWN_CLASSES =
  "border-white/[0.08] bg-[#1e1e1e]/80 text-zinc-100 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-[#1e1e1e]/65";

/** Modal dialog panels (New customer, New task, etc.). */
export const WORKSPACE_GLASS_DIALOG_SURFACE_CLASSES =
  "border-white/[0.08] bg-[#141414]/85 shadow-2xl backdrop-blur-md supports-[backdrop-filter]:bg-[#141414]/70";

/** Native `<select>` option lists do not inherit backdrop-filter from the dialog shell. */
export const WORKSPACE_GLASS_SELECT_OPTION_CLASSES = "[&>option]:bg-[#141414]";
