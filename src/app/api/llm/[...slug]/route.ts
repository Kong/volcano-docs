import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { source } from "@/lib/source";
import { notFound } from "next/navigation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  // Read the raw markdown source file.
  const filePath = page.data.body
    ? page.path
    : undefined;

  // Resolve the content file path from the page's virtual path.
  const contentPath = join(process.cwd(), "content", page.path);
  try {
    const raw = await readFile(contentPath, "utf-8");

    // Strip frontmatter (--- ... ---) from the top.
    const stripped = raw.replace(/^---[\s\S]*?---\n*/, "");

    const title = page.data.title;
    const description = page.data.description;
    const header = description
      ? `# ${title}\n\n${description}\n\n`
      : `# ${title}\n\n`;

    return new Response(header + stripped, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  } catch {
    return new Response("Page content not found", { status: 404 });
  }
}
