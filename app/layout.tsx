import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Edgefront Arena',
  description: 'A fast original 1v1 browser FPS prototype.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Edgefront Arena',
    description: 'Fast 1v1 browser FPS. First to 5 wins.',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'Edgefront Arena futuristic sports arena',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Edgefront Arena',
    description: 'Fast 1v1 browser FPS. First to 5 wins.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
