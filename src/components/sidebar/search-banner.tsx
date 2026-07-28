"use client";

import "./search-banner.css";

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
      className="search-banner"
    >
      <SearchIcon className="search-banner-icon" />
      <span className="search-banner-label">Search docs...</span>
      <kbd className="search-banner-kbd">{shortcut}</kbd>
    </button>
  );
}
