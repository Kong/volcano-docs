import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Inter, Space_Mono } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PostHogProvider } from "@/components/posthog-provider";
import { SearchDialog } from "@/components/search-dialog";
import { siteUrl } from "@/lib/site-url";

// Design system fonts: Inter for body copy, Space Mono for headings/logo.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  openGraph: { type: "website", siteName: "Volcano docs" },
  // Large card: every page has an image, either its own or the generated
  // default in opengraph-image.tsx. Without this X renders a thumbnail.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <PostHogProvider>
          <RootProvider search={{ SearchDialog }}>{children}</RootProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
