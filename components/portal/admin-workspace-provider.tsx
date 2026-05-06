"use client";

import * as React from "react";

export interface AdminWorkspaceSession {
  organizationId?: string;
}

const AdminWorkspaceContext = React.createContext<AdminWorkspaceSession | null>(null);

export function AdminWorkspaceProvider({
  organizationId,
  children,
}: {
  organizationId?: string;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ organizationId }), [organizationId]);
  return <AdminWorkspaceContext.Provider value={value}>{children}</AdminWorkspaceContext.Provider>;
}

/** Session fields for staff `/admin` routes; empty when used outside `AdminWorkspaceProvider`. */
export function useAdminWorkspace(): AdminWorkspaceSession {
  return React.useContext(AdminWorkspaceContext) ?? {};
}
