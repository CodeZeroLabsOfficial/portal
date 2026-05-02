"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const menuItemClass =
  "flex cursor-pointer items-center text-zinc-200 focus:bg-white/[0.08] focus:text-white data-[state=checked]:bg-white/[0.06] data-[state=checked]:text-[#B388FF]";

/** Light / dark / system options for use inside a `DropdownMenuContent`. */
export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const value = (mounted ? theme : "system") ?? "system";

  return (
    <>
      <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        Appearance
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup value={value} onValueChange={setTheme}>
        <DropdownMenuRadioItem value="light" className={menuItemClass}>
          <Sun className="mr-2 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          Light
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark" className={menuItemClass}>
          <Moon className="mr-2 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          Dark
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system" className={menuItemClass}>
          <Monitor className="mr-2 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          System
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme" type="button" disabled>
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = theme === "dark" || (theme === "system" && resolvedTheme === "dark");

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
