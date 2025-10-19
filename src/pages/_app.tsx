import type { AppProps } from 'next/app';
import '../app/globals.css';
import { Providers } from '../app/providers';
import { Toaster } from 'sonner';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <Providers>
        <Component {...pageProps} />
        <Toaster richColors position="top-right" />
      </Providers>
    </div>
  );
}
