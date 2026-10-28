import { BlogPostCards, type BlogPost } from "@/components/blog-post-cards";
import { Hero } from "@/components/home/hero";
import { Footer } from "@/components/home/footer";
import "./collection-home.css";
import "@/components/home/index.css";

type BlogHomeProps = { title: string; posts: BlogPost[] };

// The blog listing: the section's title, then the posts themselves, newest
// first. Categories live in the sidebar, where each one links to its own page.
export function BlogHome({ title, posts }: BlogHomeProps) {
  return (
    <div data-slot="collection-home" className="home-page collection-home blog-home">
      {/* Title only: no intro line, no call to action, no landing blurb. */}
      <Hero title={title} description={null} actionHref={null}>{null}</Hero>
      <BlogPostCards posts={posts} />
      <Footer />
    </div>
  );
}
