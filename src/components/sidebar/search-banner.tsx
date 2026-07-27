"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";
import { SearchIcon } from "@/components/home/icons";

// Sidebar search box from the design: a bordered input-looking trigger that
// opens Fumadocs' real search dialog. Rendered as the sidebar `banner` slot.
export function SearchBanner() {
  const { setOpenSearch, enabled } = useSearchContext();

  if (!enabled) return null;

  function openSearch() {
    setOpenSearch(true);
  }

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Search docs"
      className="flex w-full items-center gap-space-40 border border-border-subtle bg-surface px-space-50 py-space-40 text-left font-body text-sm text-neutral transition-colors hover:text-fg"
    >
      <SearchIcon className="size-4 shrink-0" />
      Search docs...
    </button>
  );
}
