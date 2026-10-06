#!/usr/bin/env bash
# Fail if any given path is a symlink, goes through one, or contains one.
# The docs build and search index follow symlinks, so a link in a synced source,
# content/ or public/ could publish files from outside the docs tree. Docs never
# need one. Prints one GitHub ::error:: annotation per link.
#
# Usage: scripts/refuse-symlinks.sh <relative-path>...
# Run by scripts/sync-docs.sh (inside each source clone) and by CI.
set -euo pipefail

links="$(mktemp)"
trap 'rm -f "$links"' EXIT

# %q keeps attacker-chosen names on one log line; %25 stops the runner from
# decoding a literal %0A in them into a newline inside the annotation.
quote() {
  local q
  q="$(printf '%q' "$1")"
  printf '%s' "${q//%/%25}"
}

status=0
for root in "$@"; do
  case "$root" in
    /* | .. | ../* | */.. | */../* | *$'\n'*)
      echo "::error::refuse-symlinks.sh takes paths inside the current directory, got $(quote "$root")" >&2
      exit 2
      ;;
  esac

  # A symlinked directory on the path itself (e.g. docs -> elsewhere) would make
  # a copy read the target's real files, which find below cannot see.
  cur=""
  linked=""
  IFS=/ read -r -a parts <<< "$root"
  for part in "${parts[@]}"; do
    if [ -z "$part" ] || [ "$part" = "." ]; then
      continue
    fi
    cur="${cur:+$cur/}$part"
    if [ -L "$cur" ]; then
      printf '%s\0' "$cur" >> "$links"
      linked=1
      break
    fi
  done
  if [ -n "$linked" ]; then
    continue
  fi

  # find does not follow symlinks by default, so this lists every link under the
  # path, including dangling ones and links to directories. A scan error fails,
  # after the links found so far are reported.
  if ! find "$root" -type l -print0 >> "$links"; then
    echo "::error::could not scan $(quote "$root") for symlinks" >&2
    status=1
  fi
done

while IFS= read -r -d '' link; do
  echo "::error::$(quote "$link") is a symlink to $(quote "$(readlink "$link")"); docs must not contain symlinks" >&2
  status=1
done < "$links"
exit "$status"
