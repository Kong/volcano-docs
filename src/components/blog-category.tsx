import Link from "next/link";
import { categoryHref, categoryLabel } from "@/lib/blog-categories.mjs";
import "./blog-category.css";

type BlogCategoryProps = { category: string; linked?: boolean };

// A post's single category. Linked on an article, where it takes the reader to
// that category's page; plain on a card, whose whole surface is already a link
// to the post (an anchor cannot nest inside another anchor).
export function BlogCategory({ category, linked = true }: BlogCategoryProps) {
  const label = categoryLabel(category);
  if (!linked) {
    return (
      <span data-slot="blog-category" className="blog-category">
        {label}
      </span>
    );
  }
  return (
    <Link
      data-slot="blog-category"
      data-linked="true"
      href={categoryHref(category)}
      className="blog-category"
    >
      {label}
    </Link>
  );
}
