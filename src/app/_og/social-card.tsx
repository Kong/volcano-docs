import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The card every docs link falls back to when it has no image of its own.
// A blog post with a `cover` overrides it with that image (see the blog's
// generateMetadata), so this is what the guides, the CLI reference and the
// landing page show when someone pastes a link.

export const socialCardSize = { width: 1200, height: 630 };
export const socialCardAlt = "Volcano docs";
export const socialCardContentType = "image/png";

/*
 * Satori (the renderer behind next/og's ImageResponse) has no CSS cascade, so
 * var(--token) cannot resolve inside it. These are literal snapshots of the
 * Layer-1 values in src/app/theme.css, not new arbitrary colors.
 */
const TEXT_PRIMARY = "#ffffff"; // --color-white
const TEXT_MUTED = "#a3a3a3"; // --color-neutral-400
const ACCENT = "#f37a58"; // --color-lava-500
// --color-neutral-0 into --color-tint-dark: the dark surface warmed toward the
// brand tint, the same pairing the dark theme uses for raised surfaces.
const BACKGROUND = "linear-gradient(135deg, #0a0a0a 0%, #352320 100%)";

const MARK_DATA_URI = `data:image/svg+xml;base64,${readFileSync(
  join(process.cwd(), "public/design/logo-mark.svg"),
).toString("base64")}`;

// Google's css2 endpoint serves woff2 to modern user agents; Satori only
// parses ttf/otf/woff, so an old-browser UA is sent to get a woff URL back.
// The stylesheet lists one @font-face per script subset — the Latin one (the
// only one this card needs) is identified by its unicode-range rather than
// assumed to be in a fixed position, since subset order is not contractual.
const LATIN_UNICODE_RANGE = "U+0000-00FF";
// Google serves the font files themselves from this host. Nothing in a request
// reaches the fetch below — the stylesheet URL is a constant — but the file URL
// is read out of a response, so the host it names is checked before it is
// fetched rather than trusted.
const FONT_FILE_HOST = "fonts.gstatic.com";

async function loadInterWeight(weight: 400 | 700) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&display=swap`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36",
      },
    },
  ).then(function readCss(response) {
    // fetch resolves for 4xx and 5xx too: an error page would otherwise be
    // parsed as a stylesheet, and its body handed to the font parser.
    if (!response.ok) throw new Error(`Google Fonts CSS request failed: HTTP ${response.status}`);
    return response.text();
  });
  const latinBlock = css
    .split("@font-face")
    .find(function hasLatinRange(block) { return block.includes(LATIN_UNICODE_RANGE); });
  const fontUrl = latinBlock?.match(/src: url\((.+?)\) format\('woff'\)/)?.[1];
  if (!fontUrl) {
    throw new Error("Could not resolve the Latin Inter font URL for the social card");
  }
  if (new URL(fontUrl).host !== FONT_FILE_HOST) {
    throw new Error(`Social card font URL is not on ${FONT_FILE_HOST}: ${fontUrl}`);
  }
  return fetch(fontUrl).then(function readFont(response) {
    if (!response.ok) throw new Error(`Font file request failed: HTTP ${response.status}`);
    return response.arrayBuffer();
  });
}

// The card still renders without a custom font: ImageResponse uses its bundled
// default when the `fonts` option is absent — an empty array is not the same
// thing, it leaves Satori with no font at all — so renderSocialCard omits the
// option entirely when nothing loaded. A Google Fonts hiccup during a build
// then degrades the typeface instead of failing the build.
async function loadInterFonts() {
  const weights = [400, 700] as const;
  const results = await Promise.allSettled(weights.map(loadInterWeight));
  return results.flatMap(function keepLoaded(result, index) {
    if (result.status === "rejected") {
      console.error("Social card: failed to load Inter", weights[index], result.reason);
      return [];
    }
    return [{ name: "Inter", data: result.value, weight: weights[index], style: "normal" as const }];
  });
}

export async function renderSocialCard() {
  const fonts = await loadInterFonts();
  const options: ConstructorParameters<typeof ImageResponse>[1] = { ...socialCardSize };
  if (fonts.length > 0) options.fonts = fonts;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          backgroundImage: BACKGROUND,
          fontFamily: "Inter",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 28 }}
        >
          <img src={MARK_DATA_URI} width={64} height={64} alt="" />
          <span
            style={{ fontSize: 40, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "-0.02em" }}
          >
            Volcano
          </span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 56,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            maxWidth: 880,
          }}
        >
          Build on Volcano
        </div>

        <div
          style={{ display: "flex", marginTop: 48, alignItems: "center", gap: 20 }}
        >
          <span
            style={{ display: "flex", width: 56, height: 4, backgroundColor: ACCENT }}
          />
          <span
            style={{ fontSize: 28, color: TEXT_MUTED }}
          >
            docs.volcano.dev
          </span>
        </div>
      </div>
    ),
    options,
  );
}
