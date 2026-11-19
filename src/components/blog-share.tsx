"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Link2 } from "lucide-react";
import type { ComponentProps } from "react";
import "./blog-share.css";

type ShareTarget = { url: string; title: string };

const COPIED_RESET_MS = 2000;

// Brand marks are inlined rather than imported: lucide ships no brand icons,
// and a single-path mark drawn with `currentColor` follows the theme without a
// second asset request. Paths from simple-icons (CC0).
function XMark(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function LinkedInMark(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

function shareOnX(url: string, title: string) {
  const intent = new URL("https://x.com/intent/post");
  intent.searchParams.set("text", title);
  intent.searchParams.set("url", url);
  return intent.toString();
}

function shareOnLinkedIn(url: string) {
  const intent = new URL("https://www.linkedin.com/sharing/share-offsite/");
  intent.searchParams.set("url", url);
  return intent.toString();
}

// Icon-only share actions: the two networks Volcano posts from, plus a copy
// link for everywhere else. Each network opens its own composer — nothing is
// posted from here, and no third-party script is loaded to draw a button.
function ShareActions({ url, title }: ShareTarget) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(function cancelPendingReset() {
    return function cleanup() {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const copyLink = useCallback(
    async function copyLink() {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard access denied (insecure origin, or the reader said no):
        // leave the button alone rather than claiming a copy that never ran.
        return;
      }
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(function reset() {
        setCopied(false);
      }, COPIED_RESET_MS);
    },
    [url],
  );

  return (
    <div className="blog-share-actions">
      <a
        href={shareOnX(url, title)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        title="Share on X"
        className="blog-share-action"
      >
        <XMark className="blog-share-glyph" />
      </a>
      <a
        href={shareOnLinkedIn(url)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        title="Share on LinkedIn"
        className="blog-share-action"
      >
        <LinkedInMark className="blog-share-glyph" />
      </a>
      <button
        type="button"
        onClick={copyLink}
        aria-label="Copy link to this post"
        title="Copy link"
        data-copied={copied}
        className="blog-share-action"
      >
        {copied && <Check aria-hidden className="blog-share-glyph" />}
        {!copied && <Link2 aria-hidden className="blog-share-glyph" />}
      </button>
      <span role="status" aria-live="polite" className="blog-share-status">
        {copied && "Link copied"}
      </span>
    </div>
  );
}

type BlogShareProps = ShareTarget & { discussion?: string };

// The top of a post: a quiet row of share icons beside the byline, with a
// link to the post's X thread when it has one.
export function BlogShare({ url, title, discussion }: BlogShareProps) {
  return (
    <div data-slot="blog-share" className="blog-share">
      {discussion && (
        <a href={discussion} target="_blank" rel="noopener noreferrer" className="blog-share-discuss">
          <XMark className="blog-share-glyph" />
          Discuss on X
          <ArrowUpRight aria-hidden className="blog-share-glyph" />
        </a>
      )}
      <ShareActions url={url} title={title} />
    </div>
  );
}

// The end of a post: an invitation to the X thread when there is one, then the
// share actions for readers who want to pass the post along.
export function BlogPostFooter({ url, title, discussion }: BlogShareProps) {
  return (
    <footer data-slot="blog-post-footer" className="blog-post-footer-block">
      {discussion && (
        <a
          href={discussion}
          target="_blank"
          rel="noopener noreferrer"
          data-slot="blog-conversation"
          className="blog-conversation"
        >
          <span className="blog-conversation-mark">
            <XMark className="blog-conversation-glyph" />
          </span>
          <span className="blog-conversation-copy">
            <span className="blog-conversation-title">Join the conversation on X</span>
            <span className="blog-conversation-body">Questions, feedback, or something you built? Reply to the thread.</span>
          </span>
          <span className="blog-conversation-cta">
            Open on X
            <ArrowUpRight aria-hidden className="blog-share-glyph" />
          </span>
        </a>
      )}
      <div className="blog-share-row">
        <span className="blog-share-label">Share this post</span>
        <ShareActions url={url} title={title} />
      </div>
    </footer>
  );
}
