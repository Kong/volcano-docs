import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Inter, Space_Mono } from "next/font/google";
import type { DefaultSearchDialogProps } from "fumadocs-ui/components/dialog/search-default";
import type { Metadata } from "next";
import type { ReactNode } from "react";
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
  openGraph: { type: "website" },
};

function searchOptions(): Partial<DefaultSearchDialogProps> {
  if (process.env.NODE_ENV === "development") {
    return { api: "/api/search" };
  }
  return { type: "static", api: "/search-index.json" };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <RootProvider search={{ options: searchOptions() }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
