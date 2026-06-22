import { Metadata } from 'next';
import MembershipClient from './MembershipClient';
import { APP_URL } from '../../lib/config';
import { MEMBERSHIP_FAQS } from '../../components/membership/faq-content';

export const metadata: Metadata = {
  title: 'Torne-se Membro do Apostolado de Garabandal',
  description: 'Faça parte do Apostolado de Garabandal. Como membro, apoia a missão mariana, recebe conteúdos exclusivos, acesso a peregrinações e o diploma de membro.',
  keywords: [
    'membro apostolado Garabandal',
    'tornar-se membro apostolado católico',
    'membro associação mariana',
    'associação católica sem fins lucrativos',
    'apoiar apostolado Nossa Senhora',
    'quota membro apostolado Garabandal',
    'membro apostolado Brasil Portugal',
  ],
  alternates: {
    canonical: `${APP_URL}/tornar-membro`,
    languages: {
      'pt-BR': `${APP_URL}/tornar-membro`,
      'pt-PT': `${APP_URL}/tornar-membro`,
      'en': `${APP_URL}/en/become-member`,
    },
  },
  openGraph: {
    url: `${APP_URL}/tornar-membro`,
    title: 'Torne-se Membro do Apostolado de Garabandal',
    description: 'Junte-se à missão mariana. Apoie peregrinações, evangelização e receba conteúdos exclusivos como membro do Apostolado.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Apostolado de Garabandal',
    images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Torne-se Membro — Apostolado de Garabandal' }],
  },
};

export default function TornarMembroPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: MEMBERSHIP_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <MembershipClient />
    </>
  );
}
