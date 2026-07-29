"use client";

import "./copy-page-dropdown.css";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { Copy, ChevronDown, Bot, Sparkles, Terminal, Box } from "lucide-react";

interface CopyPageDropdownProps {
  slug: string[];
  title: string;
}

const BASE_URL = "https://docs.volcano.dev";

function getPageUrl(slug: string[]) {
  return `${BASE_URL}/${slug.join("/")}`;
}

function getLlmApiUrl(slug: string[]) {
  return `/api/llm/${slug.join("/")}`;
}

export function CopyPageDropdown({ slug, title }: CopyPageDropdownProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyForLlm() {
    const res = await fetch(getLlmApiUrl(slug));
    const markdown = await res.text();
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(function resetCopied() {
      setCopied(false);
    }, 2000);
    setOpen(false);
  }

  function openInChatGPT() {
    const url = `https://chatgpt.com/?q=${encodeURIComponent(`Read this documentation page and help me understand it: ${getPageUrl(slug)}`)}`;
    window.open(url, "_blank");
    setOpen(false);
  }

  function openInClaude() {
    const url = `https://claude.ai/new?q=${encodeURIComponent(`Read this documentation page and help me understand it: ${getPageUrl(slug)}`)}`;
    window.open(url, "_blank");
    setOpen(false);
  }

  function openInCodex() {
    const url = `https://chatgpt.com/codex?q=${encodeURIComponent(`Review this documentation: ${getPageUrl(slug)}`)}`;
    window.open(url, "_blank");
    setOpen(false);
  }

  function openInCursor() {
    const url = `https://cursor.com/docs?url=${encodeURIComponent(getPageUrl(slug))}`;
    window.open(url, "_blank");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="copy-page-trigger">
        <Copy className="copy-page-trigger-icon" />
        <span>{copied ? "Copied!" : "Copy page"}</span>
        <ChevronDown className="copy-page-trigger-chevron" />
      </PopoverTrigger>
      <PopoverContent align="end" className="copy-page-menu">
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
