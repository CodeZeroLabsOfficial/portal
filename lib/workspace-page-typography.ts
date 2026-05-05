/**
 * Shared title / intro copy styles for workspace routes so list hubs, detail heroes,
 * and shell chrome stay visually aligned.
 */

/** List & hub pages (Pipeline, Proposals, Accounts, admin home, …). */
export const WORKSPACE_HUB_PAGE_TITLE_CLASS =
  "text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem] md:leading-tight";

/** CRM detail heroes (account, customer, opportunity headers). */
export const WORKSPACE_DETAIL_PAGE_TITLE_CLASS =
  "text-2xl font-semibold tracking-tight text-foreground md:text-3xl";

/**
 * Intro line under a hub title when the heading block does not use `space-y-*`
 * (title and paragraph are direct siblings).
 */
export const WORKSPACE_PAGE_DESCRIPTION_CLASS =
  "mt-1 max-w-2xl text-sm text-muted-foreground";

/**
 * Intro line when the title lives in a `space-y-*` stack with the paragraph
 * (spacing comes from the parent gap).
 */
export const WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS = "max-w-2xl text-sm text-muted-foreground";

/** lg+ main column header in WorkspaceShell (dark sidebar layout). */
export const WORKSPACE_MAIN_COLUMN_TITLE_CLASS =
  "text-2xl font-semibold tracking-tight text-white";

export const WORKSPACE_MAIN_COLUMN_DESCRIPTION_CLASS = "mt-1 text-sm text-zinc-500";
