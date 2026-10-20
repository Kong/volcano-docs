"use client";

import "./docs-header.css";

import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import { SiteHeader } from "@/components/site-header";
import { SidebarToggleIcon } from "@/components/home/icons";

// Docs and Cookbooks add a mobile sidebar trigger to the shared site header.
export function DocsHeader() {
  const { slots } = useDocsLayout();
  const SidebarTrigger = slots.sidebar.trigger;

  return (
    <SiteHeader>
      <SidebarTrigger className="docs-header-sidebar-trigger" aria-label="Toggle sidebar">
        <SidebarToggleIcon className="docs-header-sidebar-trigger-icon" />
      </SidebarTrigger>
    </SiteHeader>
  );
}
