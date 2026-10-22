interface PageNavProps {
  title?: string;
  children: React.ReactNode;
}

// The bar across the top of each example page, with its links
export default function PageNav({ title = '🌋 Volcano Auth', children }: PageNavProps) {
  return (
    <nav>
      <h1>{title}</h1>
      <div className="nav-links">{children}</div>
    </nav>
  );
}
