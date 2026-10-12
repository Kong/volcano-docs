"use client";

import { useEffect, useState } from "react";
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
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { preloadSearchIndex, searchIndexClient } from "@/lib/search-index-client.mjs";

type SearchDialogProps = SharedProps;

// A single character matches most of the index, so searching it scores
// thousands of entries for results nobody reads. Shorter input is treated like
// an empty box.
const MIN_QUERY_LENGTH = 2;

type SearchResults = ReturnType<typeof useDocsSearch>["query"]["data"];

// Production reads the gzip index that the build writes to public/ (see
// src/lib/search-index-client.mjs). `next dev` emits no index, so it queries
// the dynamic search route instead.
function createSearchClient(): SearchClient {
  if (process.env.NODE_ENV === "development") {
    return fetchClient({ api: "/api/search" });
  }
  return searchIndexClient();
}

const searchClient = createSearchClient();

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
  const [input, setInput] = useState("");
  const { setSearch, query } = useDocsSearch({ client: searchClient });

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
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={listItems(query.data)} />
      </SearchDialogContent>
    </FumadocsSearchDialog>
  );
}
