"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ComponentType } from "react";

// Theme switcher matching the design's segmented control: system / dark / light
// in that order, on a warm-tinted container, with the active option highlighted
// in the brand orange. Replaces Fumadocs' default two-icon toggle.
const MODES: { key: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: "system", label: "System theme", Icon: Monitor },
  { key: "dark", label: "Dark theme", Icon: Moon },
  { key: "light", label: "Light theme", Icon: Sun },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The active theme is only known on the client, so gate the highlight on
  // mount to avoid a hydration mismatch — the standard next-themes idiom.
  useEffect(function markMounted() {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  let active: string | undefined = undefined;
  if (mounted) {
    active = theme;
  }

  return (
    <div className="flex w-fit items-center gap-space-30 border border-border-subtle bg-primary-weakest p-space-10">
      {MODES.map(function renderMode({ key, label, Icon }) {
        const isActive = active === key;

        let stateClass = "text-neutral hover:text-fg";
        if (isActive) {
          stateClass = "bg-surface text-primary";
        }

        function selectMode() {
          setTheme(key);
        }

        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            onClick={selectMode}
            className={`flex items-center px-space-40 py-space-10 transition-colors ${stateClass}`}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
