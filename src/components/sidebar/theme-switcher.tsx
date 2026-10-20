"use client";

import "./theme-switcher.css";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ComponentType } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "fumadocs-ui/components/ui/popover";

// The current mode is shown as one icon; the popover exposes all three modes.
const MODES: { key: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: "system", label: "System theme", Icon: Monitor },
  { key: "dark", label: "Dark theme", Icon: Moon },
  { key: "light", label: "Light theme", Icon: Sun },
];

type ThemeSwitcherProps = {
  className?: string;
};

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // The active theme is only known on the client, so gate the highlight on
  // mount to avoid a hydration mismatch — the standard next-themes idiom.
  useEffect(function markMounted() {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  let active = "system";
  if (mounted) {
    active = theme ?? "system";
  }
  const selected = MODES.find(function currentMode(mode) { return mode.key === active; }) ?? MODES[0];
  const CurrentIcon = selected.Icon;

  return (
    <div data-slot="theme-switcher" className={`theme-switcher ${className ?? ""}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          aria-label={`Change theme (current: ${selected.label})`}
          title={selected.label}
          className="theme-switcher-trigger"
        >
          <CurrentIcon aria-hidden="true" className="theme-switcher-icon" />
        </PopoverTrigger>
        <PopoverContent align="end" aria-label="Theme options" className="theme-switcher-menu">
          {MODES.map(function renderMode({ key, label, Icon }) {
            const isActive = active === key;
            let variant: "selected" | undefined;
            if (isActive) variant = "selected";
            function selectMode() {
              setTheme(key);
              setOpen(false);
            }
            return (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={isActive}
                title={label}
                data-variant={variant}
                onClick={selectMode}
                className="theme-switcher-option"
              >
                <Icon aria-hidden="true" className="theme-switcher-icon" />
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}
