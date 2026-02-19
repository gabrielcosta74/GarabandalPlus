import { Metadata } from 'next';
import MembershipClient from './MembershipClient';
import { APP_URL } from '../../lib/config';
import { MEMBERSHIP_FAQS } from '../../components/membership/faq-content';

export const metadata: Metadata = {
  title: 'Torne-se membro',
  description: 'Faça parte do Apostolado de Garabandal. Apoie a missão, receba conteúdos exclusivos e participe da comunidade.',
  alternates: {
    canonical: `${APP_URL}/tornar-membro`,
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
