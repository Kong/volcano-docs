"use client";

import "./copy-page-dropdown.css";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { Copy, ChevronDown, Bot, Sparkles, Terminal, Box } from "lucide-react";
import { markdownPath } from "@/lib/site-routes.mjs";

type CopyPageDropdownProps = {
  /** The page's route, such as "/docs/cli/setup". */
  url: string;
};

// Derive the page URL from the current origin rather than a hardcoded host, so
// the AI-tool links point at whatever environment (prod/staging/local) is being
// viewed instead of always deep-linking to production.
function getPageUrl(url: string) {
  return `${window.location.origin}${url}`;
}


function triggerLabel(copied: boolean) {
  if (copied) return "Copied!";
  return "Copy page";
}

export function CopyPageDropdown({ url }: CopyPageDropdownProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyForLlm() {
    const res = await fetch(markdownPath(url));
    const markdown = await res.text();
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(function resetCopied() {
      setCopied(false);
    }, 2000);
    setOpen(false);
  }

  function openInChatGPT() {
    const href = `https://chatgpt.com/?q=${encodeURIComponent(`Read this documentation page and help me understand it: ${getPageUrl(url)}`)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  function openInClaude() {
    const href = `https://claude.ai/new?q=${encodeURIComponent(`Read this documentation page and help me understand it: ${getPageUrl(url)}`)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  function openInCodex() {
    const href = `https://chatgpt.com/codex?q=${encodeURIComponent(`Review this documentation: ${getPageUrl(url)}`)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  function openInCursor() {
    const href = `https://cursor.com/docs?url=${encodeURIComponent(getPageUrl(url))}`;
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="copy-page-trigger">
        <Copy className="copy-page-trigger-icon" />
        <span>{triggerLabel(copied)}</span>
        <ChevronDown className="copy-page-trigger-chevron" />
      </PopoverTrigger>
      <PopoverContent align="end" className="copy-page-menu">
        <button
          type="button"
          onClick={copyForLlm}
          className="copy-page-item"
        >
          <Copy className="copy-page-item-icon" />
          <span className="copy-page-item-text">
            <span className="copy-page-item-title">Copy page</span>
            <span className="copy-page-item-desc">
              Copy as Markdown for LLMs
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={openInChatGPT}
          className="copy-page-item"
        >
          <Sparkles className="copy-page-item-icon" />
          <span className="copy-page-item-text">
            <span className="copy-page-item-title">Open in ChatGPT</span>
            <span className="copy-page-item-desc">
              Get insights from ChatGPT
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={openInClaude}
          className="copy-page-item"
        >
          <Bot className="copy-page-item-icon" />
          <span className="copy-page-item-text">
            <span className="copy-page-item-title">Open in Claude</span>
            <span className="copy-page-item-desc">
              Get insights from Claude
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={openInCodex}
          className="copy-page-item"
        >
          <Terminal className="copy-page-item-icon" />
          <span className="copy-page-item-text">
            <span className="copy-page-item-title">Open in Codex</span>
            <span className="copy-page-item-desc">
              Get insights from Codex
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={openInCursor}
          className="copy-page-item"
        >
          <Box className="copy-page-item-icon" />
          <span className="copy-page-item-text">
            <span className="copy-page-item-title">Open in Cursor</span>
            <span className="copy-page-item-desc">
              Get insights from Cursor
            </span>
          </span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
