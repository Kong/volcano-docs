import Link from 'next/link';

export interface Example {
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  background: string;
  borderColor: string;
}

export default function ExampleCard({ title, description, href, buttonLabel, background, borderColor }: Example) {
  return (
    <div
      style={{
        background,
        padding: '20px',
        borderRadius: '8px',
        border: `2px solid ${borderColor}`,
      }}
    >
      <h3>{title}</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '10px 0' }}>{description}</p>
      <Link href={href}>
        <button>{buttonLabel}</button>
      </Link>
    </div>
  );
}
