import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Volcano Realtime Chat',
  description: 'Real-time chat example using Volcano Realtime SDK',
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
