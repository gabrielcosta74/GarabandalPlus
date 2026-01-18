import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import ClientLayout from '../components/layouts/ClientLayout';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: {
    template: '%s | Apostolado de Garabandal',
    default: 'Apostolado de Garabandal',
  },
  description: 'O espaço oficial da Associação do Apostolado de Garabandal. Um lugar de fé, oração e divulgação da Mensagem.',
  keywords: ['Garabandal', 'Apostolado', 'Oração', 'Fé', 'Virgem Maria', 'Aparições'],
  authors: [{ name: 'Apostolado de Garabandal' }],
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    url: 'https://app.apostoladodegarabandal.com',
    siteName: 'Apostolado de Garabandal',
    title: 'Apostolado de Garabandal',
    description: 'O espaço oficial da Associação do Apostolado de Garabandal.',
    images: [
      {
        url: '/images/og-image.jpg', // Placeholder, assumes existence or default
        width: 1200,
        height: 630,
        alt: 'Apostolado de Garabandal',
      },
    ],
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className={`${inter.variable} ${playfair.variable}`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
