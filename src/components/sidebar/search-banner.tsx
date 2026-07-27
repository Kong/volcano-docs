"use client";

import { useEffect, useState } from "react";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { SearchIcon } from "@/components/home/icons";

// Sidebar search box from the design: a bordered input-looking trigger that
// opens Fumadocs' real search dialog, with an OS-aware keyboard-shortcut hint.
// macOS uses the ⌘ symbol with no separator (⌘K); other platforms spell out
// the modifier with a "+" (Ctrl+K). Fumadocs' actual hotkey is
// (meta||ctrl)+K, so this hint always matches what really works.
export function SearchBanner() {
  const { setOpenSearch, enabled } = useSearchContext();
  const [shortcut, setShortcut] = useState("⌘K");

  useEffect(function detectPlatform() {
    const isApple = /Mac|iPhone|iPad|iPod/i.test(window.navigator.platform);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isApple) setShortcut("Ctrl+K");
  }, []);

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
      <span className="flex-1">Search docs...</span>
      <kbd className="shrink-0 font-body text-xs text-neutral">{shortcut}</kbd>
    </button>
  );
}
