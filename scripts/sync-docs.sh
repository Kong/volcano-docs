#!/usr/bin/env bash
# Pull docs from each source repo listed in docs.config.yaml into content/<dest>/.
# Driven by the manifest so adding a source is a config change, not a code change.
#
# Env:
#   GH_TOKEN  token with read access to the source repos (required for private repos)
#   ONLY      optional single dest to sync (e.g. "content/cli"); blank = all
#
# Needs: git, yq (both preinstalled on GitHub ubuntu runners).
set -euo pipefail

CONFIG="docs.config.yaml"
ONLY="${ONLY:-}"
TOKEN="${GH_TOKEN:-}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

n="$(yq '.sources | length' "$CONFIG")"
for i in $(seq 0 $((n - 1))); do
  dest="$(yq -r ".sources[$i].dest" "$CONFIG")"
  if [ -n "$ONLY" ] && [ "$ONLY" != "$dest" ]; then
    continue
  fi
  repo="$(yq -r ".sources[$i].repo" "$CONFIG")"
  ref="$(yq -r ".sources[$i].ref" "$CONFIG")"
  path="$(yq -r ".sources[$i].path" "$CONFIG")"
  index="$(yq -r ".sources[$i].index // \"\"" "$CONFIG")"

  echo ">> $repo ($ref:$path) -> $dest"
  clone="$tmp/${repo//\//_}"
  git clone --quiet --depth 1 --branch "$ref" \
    "https://x-access-token:${TOKEN}@github.com/${repo}.git" "$clone"

  src="$clone/$path"
  rm -rf "$dest"
  mkdir -p "$dest"

  mapfile -t globs < <(yq -r ".sources[$i].include[]? // empty" "$CONFIG")
  if [ "${#globs[@]}" -eq 0 ]; then
    cp -R "$src/." "$dest/"
  else
    for g in "${globs[@]}"; do
      while IFS= read -r f; do
        mkdir -p "$dest/$(dirname "$f")"
        cp "$src/$f" "$dest/$f"
      done < <(cd "$src" && find . -path "./$g" -type f | sed 's#^\./##')
    done
  fi

  # Section landing: map the configured index file to index.md.
  if [ -n "$index" ] && [ -f "$dest/$index" ]; then
    mv "$dest/$index" "$dest/index.md"
  fi

  find "$dest" -name .DS_Store -delete
done

# ponytail: no provenance stamping or frontmatter validation here yet.
# Validation belongs in each source repo's PR CI (schema at spec/frontmatter.schema.json);
# add `source:` injection when the site needs "Edit this page" links.
# ponytail: skills/plugins keep their source tree shape (e.g. volcano-auth/SKILL.md).
# Add a flatten/rename transform once their doc format is settled.
