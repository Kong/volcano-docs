import { BlogPostCards, type BlogPost } from "@/components/blog-post-cards";
import { Footer } from "@/components/home/footer";
import "./collection-home.css";
import "@/components/home/index.css";

type BlogHomeProps = { posts: BlogPost[] };

// The blog listing: the posts themselves, newest first, and nothing above
// them. Categories live in the sidebar, where each one links to its own page.
export function BlogHome({ posts }: BlogHomeProps) {
  return (
    <div data-slot="collection-home" className="home-page collection-home blog-home">
      <BlogPostCards posts={posts} />
      <Footer />
    </div>
  );
}
