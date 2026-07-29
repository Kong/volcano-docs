import { source } from "@/lib/source";
import { llms } from "fumadocs-core/source/llms";

export function GET() {
  const content = llms(source).index();

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
