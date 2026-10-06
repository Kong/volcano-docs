import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

// Page paths come from Fumadocs' build-time page map, not straight from the
// request. Synced docs are still untrusted input (see sync-docs.yml), so the
// read itself refuses anything that could land outside the content root.
//
// The path and fs calls below carry turbopackIgnore so Turbopack doesn't trace
// the whole project for these dynamic paths. Callers pass a statically scoped
// root such as join(process.cwd(), "content"), which keeps that directory in
// the route's file trace.

const MAX_DECODE_PASSES = 3;

/** @param {string} value */
function percentDecoded(value) {
  let current = value;
  for (let i = 0; i < MAX_DECODE_PASSES; i++) {
    let next;
    try {
      next = decodeURIComponent(current);
    } catch {
      break;
    }
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * @param {string} root absolute, resolved directory
 * @param {string} target absolute, resolved path
 */
function isInside(root, target) {
  if (root.endsWith(path.sep)) return target.startsWith(root);
  return target.startsWith(root + path.sep);
}

/**
 * Reads a UTF-8 file at `relativePath` under `root`. Returns null when the
 * path is empty or absolute, has a `..` segment or a NUL byte (raw or
 * percent-encoded), resolves outside `root`, does not exist, is not a file, or
 * is a symlink whose real target is outside `root`.
 *
 * @param {string} root
 * @param {string} relativePath
 * @returns {Promise<string | null>}
 */
export async function readContentFile(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath === "") return null;
  const decoded = percentDecoded(relativePath);
  const segments = [...relativePath.split(/[\\/]/), ...decoded.split(/[\\/]/)];
  if (segments.includes("..")) return null;
  if (relativePath.includes("\0") || decoded.includes("\0")) return null;
  if (path.posix.isAbsolute(decoded) || path.win32.isAbsolute(decoded))
    return null;

  const base = path.resolve(/*turbopackIgnore: true*/ root);
  const resolved = path.resolve(/*turbopackIgnore: true*/ base, relativePath);
  if (!isInside(base, resolved)) return null;

  try {
    const realBase = await realpath(/*turbopackIgnore: true*/ base);
    const realFile = await realpath(/*turbopackIgnore: true*/ resolved);
    if (!isInside(realBase, realFile)) return null;
    return await readFile(/*turbopackIgnore: true*/ realFile, "utf-8");
  } catch {
    return null;
  }
}
