import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AURORA — Antarctic Digital Twin | NCPOR',
  description:
    'Digital platform for remote management of Indian Antarctic Research Stations Maitri and Bharati. Operated by NCPOR / MoES.',
  keywords: ['Antarctic', 'NCPOR', 'Maitri', 'Bharati', 'digital twin', 'operations'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        {/* Preconnect for Google Fonts loaded in globals.css */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
