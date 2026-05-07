import { Metadata } from 'next';
import MembershipClient from '../../tornar-membro/MembershipClient';
import { APP_URL } from '../../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../../lib/seo';

const MEMBERSHIP_FAQS_EN = [
  {
    question: 'How much is the annual membership fee?',
    answer: 'The annual fee is €25. The amount is fixed and supports the Apostolate activities and community services.',
  },
  {
    question: 'Which payment methods are available?',
    answer: 'You can pay online with Card, MB WAY, PIX or Multibanco. Once payment is confirmed, your membership status is updated in your account area.',
  },
  {
    question: 'Is the membership renewal automatic?',
    answer: 'No. Renewal is manual. When your membership is close to expiring you can renew it directly from the member area in a few steps.',
  },
  {
    question: 'Will I receive a confirmation after paying?',
    answer: 'Yes. After payment confirmation you receive a confirmation email and can review your membership history in your account.',
  },
];

export const metadata: Metadata = {
  title: 'Become a Member of the Garabandal Apostolate',
  description: 'Join the Garabandal Apostolate. Support the Marian mission, access exclusive content, pilgrimages and the official membership diploma.',
  keywords: [
    'Garabandal Apostolate membership',
    'become Catholic apostolate member',
    'Marian association member',
    'Catholic non-profit membership',
    'support Our Lady of Garabandal',
    'Garabandal membership fee',
  ],
  alternates: {
    canonical: `${APP_URL}/en/become-member`,
    languages: {
      en: `${APP_URL}/en/become-member`,
      'pt-BR': `${APP_URL}/tornar-membro`,
      'pt-PT': `${APP_URL}/tornar-membro`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/become-member`,
    title: 'Become a Member of the Garabandal Apostolate',
    description: 'Join the Marian mission. Support pilgrimages, evangelisation and receive exclusive member content.',
    type: 'website',
    locale: 'en_GB',
    siteName: SITE_NAME,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Become a Member — Garabandal Apostolate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Become a Member — Garabandal Apostolate',
    description: 'Join the Marian mission and support the Garabandal Apostolate.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function EnBecomeMemberPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: MEMBERSHIP_FAQS_EN.map((item) => ({
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
