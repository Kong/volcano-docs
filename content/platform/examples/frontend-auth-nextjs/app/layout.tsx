import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Volcano Auth Example - Next.js',
  description: 'Next.js example demonstrating Volcano Hosting authentication',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

