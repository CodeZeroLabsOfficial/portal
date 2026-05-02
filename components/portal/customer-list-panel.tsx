"use client";

import * as React from "react";
import Image from "next/image";
import { Filter, MoreHorizontal, Plus, Search, SquareArrowOutUpRight } from "lucide-react";
import type { CustomerListRow } from "@/lib/customer-list";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function CustomerAvatar({ row }: { row: CustomerListRow }) {
  const url = row.avatarUrl?.trim();
  const canUseNextImage =
    url &&
    (url.includes("googleusercontent.com") || url.includes("firebasestorage.googleapis.com"));

  if (url && canUseNextImage) {
    return (
      <span className="relative inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        <Image src={url} alt="" width={36} height={36} className="h-9 w-9 object-cover" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-1 ring-border"
      aria-hidden
    >
      {initialsFromName(row.name)}
    </span>
  );
}

export interface CustomerListPanelProps {
  rows: CustomerListRow[];
}

export function CustomerListPanel({ rows }: CustomerListPanelProps) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [row.name, row.email, row.phone, row.location, row.gender].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const filteredIds = React.useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected = filteredIds.some((id) => selected.has(id));
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[1.75rem] md:leading-tight">
            Customers
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Users with <span className="font-mono text-foreground/90">role: &quot;customer&quot;</span> and optional
            profile fields.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add New Customer
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="shrink-0 text-sm font-semibold text-foreground">Customer List</h2>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs md:max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search here..."
                className="h-9 rounded-full border-border/80 bg-background/60 pl-9 text-[14px] text-foreground placeholder:text-muted-foreground"
                aria-label="Search customers"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border/80 bg-card/80 text-[14px] font-medium text-foreground hover:bg-muted/60"
              >
                <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
                Filter
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 border-border/80 bg-card/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label="Export"
              >
                <SquareArrowOutUpRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="w-12 px-4 py-2.5">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                    aria-label="Select all visible customers"
                  />
                </th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">E-mail</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Gender</th>
                <th className="w-14 px-2 py-2.5 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No customers yet. Add <span className="font-mono text-foreground/90">users</span> documents with{" "}
                    <span className="font-mono text-foreground/90">role: &quot;customer&quot;</span> (document id =
                    Auth UID). Optional: phone, location or city/country, gender; name uses displayName or name.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No customers match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <CustomerAvatar row={row} />
                        <span className="font-medium text-foreground">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">{row.email}</td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">{row.phone}</td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">{row.location}</td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">{row.gender}</td>
                    <td className="px-2 py-3 text-center align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Actions for ${row.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-[10rem] border-border/80 bg-popover text-popover-foreground shadow-lg"
                        >
                          <DropdownMenuItem>View profile</DropdownMenuItem>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive">Remove</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
