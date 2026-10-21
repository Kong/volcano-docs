"use client";

import "./search-banner.css";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { SearchIcon } from "@/components/home/icons";
import { preloadSearch } from "@/components/search-dialog";
import { getSearchLabel, getSearchSection } from "@/lib/search-section.mjs";

// Sidebar search box from the design: a bordered input-looking trigger that
// opens Fumadocs' real search dialog, with an OS-aware keyboard-shortcut hint.
// macOS uses the ⌘ symbol with no separator (⌘K); other platforms spell out
// the modifier with a "+" (Ctrl+K). Fumadocs' actual hotkey is
// (meta||ctrl)+K, so this hint always matches what really works. Pointing at
// or focusing the box starts loading the search index before it opens.
export function SearchBanner() {
  const label = getSearchLabel(getSearchSection(usePathname()));
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
      onPointerEnter={preloadSearch}
      onFocus={preloadSearch}
      aria-label={label}
      className="search-banner"
    >
      <SearchIcon className="search-banner-icon" />
      <span className="search-banner-label">{label}...</span>
      <kbd className="search-banner-kbd">{shortcut}</kbd>
    </button>
  );
}
