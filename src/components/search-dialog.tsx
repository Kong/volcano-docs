"use client";

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
import { searchIndexClient } from "@/lib/search-index-client.mjs";

type SearchDialogProps = SharedProps;

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

function listItems(results: SearchResults) {
  if (results === "empty") return null;
  return results;
}

// Fumadocs' default dialog, with the client swapped: its static client can
// only fetch plain JSON.
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { search, setSearch, query } = useDocsSearch({ client: searchClient });

  return (
    <FumadocsSearchDialog
      open={open}
      onOpenChange={onOpenChange}
      search={search}
      onSearchChange={setSearch}
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
