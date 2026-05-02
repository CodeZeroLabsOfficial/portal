"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export async function signOutFromPortal(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await signOutFromPortal();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={handleLogout}>
      Sign out
    </Button>
  );
}
