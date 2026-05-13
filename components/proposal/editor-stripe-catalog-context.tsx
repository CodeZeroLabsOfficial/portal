"use client";

import * as React from "react";
import type { SubscriptionProductOption } from "@/types/subscription-product";

/** Stripe subscription products for the proposal editor (same list as Add subscription). */
export const EditorStripeCatalogContext = React.createContext<readonly SubscriptionProductOption[]>([]);

export function useEditorStripeCatalog(): readonly SubscriptionProductOption[] {
  return React.useContext(EditorStripeCatalogContext);
}
