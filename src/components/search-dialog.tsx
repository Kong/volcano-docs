"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useDocsSearch } from "fumadocs-core/search/client";
import type { SearchClient } from "fumadocs-core/search/client";
import { fetchClient } from "fumadocs-core/search/client/fetch";
import {
  SearchDialog as FumadocsSearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  SearchDialogFooter,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { preloadSearchIndex, searchIndexClient } from "@/lib/search-index-client.mjs";
import { getSearchLabel, getSearchSection, getSearchTags } from "@/lib/search-section.mjs";
import { useBlogFilters } from "@/components/blog-filters";
import { topicLabel } from "@/lib/blog-topics.mjs";

type SearchDialogProps = SharedProps;
type SearchSection = ReturnType<typeof getSearchSection>;
type SectionSearchDialogProps = SharedProps & { section: SearchSection; topic: string | null };

// A single character matches most of the index, so searching it scores
// thousands of entries for results nobody reads. Shorter input is treated like
// an empty box.
const MIN_QUERY_LENGTH = 2;

type SearchResults = ReturnType<typeof useDocsSearch>["query"]["data"];

// Production reads the gzip index that the build writes to public/ (see
// src/lib/search-index-client.mjs). `next dev` emits no index, so it queries
// the dynamic search route instead.
function createSearchClient(section: SearchSection, topic: string | null = null): SearchClient {
  const tag = getSearchTags(section, topic);
  if (process.env.NODE_ENV === "development") {
    return fetchClient({ api: "/api/search", tag });
  }
  return searchIndexClient(undefined, tag);
}

const searchClients = {
  docs: createSearchClient("docs"),
  cookbooks: createSearchClient("cookbooks"),
  blog: createSearchClient("blog"),
};

// Starts downloading and loading the index before the first query. `next dev`
// has no static index to load.
export function preloadSearch() {
  if (process.env.NODE_ENV === "development") return;
  preloadSearchIndex();
}

function searchableQuery(input: string) {
  if (input.trim().length < MIN_QUERY_LENGTH) return "";
  return input;
}

function listItems(results: SearchResults) {
  if (results === "empty") return null;
  return results;
}

// Fumadocs' default dialog, with the client swapped: its static client can
// only fetch plain JSON.
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const section = getSearchSection(usePathname());
  const { topic } = useBlogFilters();
  let activeTopic = null;
  if (section === "blog") activeTopic = topic;
  return <SectionSearchDialog key={`${section}:${activeTopic ?? ""}`} section={section} topic={activeTopic} open={open} onOpenChange={onOpenChange} />;
}

// Remount when the section changes so queries and results from the previous
// section cannot linger in the dialog after navigation.
function SectionSearchDialog({ section, topic, open, onOpenChange }: SectionSearchDialogProps) {
  const [input, setInput] = useState("");
  const client = useMemo(function scopedClient() {
    if (topic) return createSearchClient(section, topic);
    return searchClients[section];
  }, [section, topic]);
  const { setSearch, query } = useDocsSearch({ client });
  const label = getSearchLabel(section);

  useEffect(
    function preloadOnOpen() {
      if (open) preloadSearch();
    },
    [open],
  );

  function handleSearchChange(value: string) {
    setInput(value);
    setSearch(searchableQuery(value));
  }

  return (
    <FumadocsSearchDialog
      open={open}
      onOpenChange={onOpenChange}
      search={input}
      onSearchChange={handleSearchChange}
      isLoading={query.isLoading}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput aria-label={label} placeholder={`${label}...`} />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={listItems(query.data)} />
        {topic && <SearchDialogFooter>Topic: {topicLabel(topic)}</SearchDialogFooter>}
      </SearchDialogContent>
    </FumadocsSearchDialog>
  );
}
