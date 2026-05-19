"use client";

import * as React from "react";
import type { CatalogServicePickerOption } from "@/types/catalog-service";

/** Active catalogue services for proposal plan tiers (same list as Add subscription). */
export const EditorCatalogServicesContext = React.createContext<readonly CatalogServicePickerOption[]>([]);

export function useEditorCatalogServices(): readonly CatalogServicePickerOption[] {
  return React.useContext(EditorCatalogServicesContext);
}
