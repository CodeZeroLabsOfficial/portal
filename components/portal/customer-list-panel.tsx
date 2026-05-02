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
import { cn } from "@/lib/utils";

const addCustomerGreen =
  "bg-[#1e4d3a] text-white shadow-sm hover:bg-[#173d2e] focus-visible:ring-[#1e4d3a] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

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
      <span className="relative inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-200 ring-1 ring-zinc-200/80">
        <Image src={url} alt="" width={36} height={36} className="h-9 w-9 object-cover" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200/80"
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
    <div className="rounded-2xl bg-gradient-to-b from-[#eceef2] via-[#e6e9ef] to-[#dfe3ea] p-6 sm:p-8 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950">Customer</h1>
        <Button type="button" size="lg" className={cn("h-11 rounded-xl px-5 text-[15px] font-semibold", addCustomerGreen)}>
          <Plus className="h-5 w-5 stroke-[2]" aria-hidden />
          Add New Customer
        </Button>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.12)] sm:p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="shrink-0 text-base font-bold text-zinc-900">Customer List</h2>
          <div className="flex min-w-0 flex-1 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative min-w-0 flex-1 sm:max-w-md lg:max-w-lg">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search here..."
                className="h-11 rounded-full border-zinc-200 bg-white pl-11 pr-4 text-[15px] text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:border-zinc-300 focus-visible:ring-zinc-400/30"
                aria-label="Search customers"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-zinc-200 bg-white px-4 text-[15px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                <Filter className="h-[18px] w-[18px] text-zinc-500" aria-hidden />
                Filter
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
                aria-label="Export"
              >
                <SquareArrowOutUpRight className="h-[18px] w-[18px]" aria-hidden />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80">
                <th className="w-12 px-4 py-3.5">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-[#1e4d3a] focus:ring-[#1e4d3a]"
                    aria-label="Select all visible customers"
                  />
                </th>
                <th className="px-4 py-3.5 text-sm font-medium text-zinc-500">Name</th>
                <th className="px-4 py-3.5 text-sm font-medium text-zinc-500">E-mail</th>
                <th className="px-4 py-3.5 text-sm font-medium text-zinc-500">Phone</th>
                <th className="px-4 py-3.5 text-sm font-medium text-zinc-500">Location</th>
                <th className="px-4 py-3.5 text-sm font-medium text-zinc-500">Gender</th>
                <th className="w-14 px-2 py-3.5 text-center text-sm font-medium text-zinc-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                    No customers yet. Add Firestore documents at{" "}
                    <span className="font-mono text-zinc-600">{"customers/<customerUid>"}</span> with fields such as name,
                    email, phone, location, and gender.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                    No customers match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 last:border-b-0">
                    <td className="px-4 py-4 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-[#1e4d3a] focus:ring-[#1e4d3a]"
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <CustomerAvatar row={row} />
                        <span className="font-medium text-zinc-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle text-zinc-600">{row.email}</td>
                    <td className="px-4 py-4 align-middle text-zinc-600">{row.phone}</td>
                    <td className="px-4 py-4 align-middle text-zinc-600">{row.location}</td>
                    <td className="px-4 py-4 align-middle text-zinc-600">{row.gender}</td>
                    <td className="px-2 py-4 text-center align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                            aria-label={`Actions for ${row.name}`}
                          >
                            <MoreHorizontal className="h-5 w-5" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-[10rem] border-zinc-200 bg-white text-zinc-900 shadow-lg"
                        >
                          <DropdownMenuItem className="focus:bg-zinc-100">View profile</DropdownMenuItem>
                          <DropdownMenuItem className="focus:bg-zinc-100">Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:bg-red-50 focus:text-destructive">
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
