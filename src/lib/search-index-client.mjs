// The production search index is a gzip file in public/. The platform uploads
// public/ to S3 without per-file metadata, so nothing can serve the file with
// `Content-Encoding: gzip` and let the browser decode it. CloudFront's own
// compression stops at 10,000,000 bytes, so serving the raw JSON would cap how
// much content the index can hold. Instead the client downloads the gzip file
// and decompresses it itself.
//
// Shared by the search dialog and the build scripts that emit and check the
// index, so all three agree on the path and on how the file is read.

export const SEARCH_INDEX_PATH = "/search-index.gz";

const decodedIndexUrls = new Map();

/** @param {Blob} body */
async function isGzip(body) {
  const [first, second] = new Uint8Array(await body.slice(0, 2).arrayBuffer());
  return first === 0x1f && second === 0x8b;
}

/** @param {string} from */
async function fetchDecodedIndex(from) {
  const response = await fetch(from);
  if (!response.ok) {
    throw new Error(`failed to fetch the search index from ${from} (HTTP ${response.status})`);
  }
  const body = await response.blob();
  // A server that sets `Content-Encoding: gzip` hands over JSON already decoded.
  if (!(await isGzip(body))) return body;
  return new Response(body.stream().pipeThrough(new DecompressionStream("gzip"))).blob();
}

/** @param {string} from */
function decodedIndexUrl(from) {
  let url = decodedIndexUrls.get(from);
  if (!url) {
    url = fetchDecodedIndex(from).then((json) => URL.createObjectURL(json));
    decodedIndexUrls.set(from, url);
  }
  return url;
}

/**
 * Fumadocs' Orama static client, fed the decompressed index through a blob URL.
 *
 * @param {string} [from]
 * @returns {import("fumadocs-core/search/client").SearchClient}
 */
export function searchIndexClient(from = SEARCH_INDEX_PATH) {
  return {
    deps: [from],
    async search(query) {
      const pending = decodedIndexUrl(from);
      try {
        const [url, { oramaStaticClient }] = await Promise.all([
          pending,
          import("fumadocs-core/search/client/orama-static"),
        ]);
        try {
          return await oramaStaticClient({ from: url }).search(query);
        } finally {
          // Fumadocs caches the loaded database by URL, so later queries never
          // fetch this blob again; release the decompressed JSON it holds.
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        // Fumadocs also caches a failed load by URL, so start the next query
        // over with a fresh download and a new blob URL.
        if (decodedIndexUrls.get(from) === pending) decodedIndexUrls.delete(from);
        throw error;
      }
    },
  };
}
