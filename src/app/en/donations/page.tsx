import { Metadata } from 'next';
import { Suspense } from 'react';
import DonationsClient from '../../donations/DonationsClient';
import { APP_URL } from '../../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../../lib/seo';

export const metadata: Metadata = {
  title: 'Donations — Support the Garabandal Apostolate',
  description: 'Donate to the Garabandal Apostolate. Your gift supports Catholic Marian pilgrimages, evangelisation and works of charity. Card, MB WAY, PIX, Multibanco and bank transfer.',
  keywords: [
    'Garabandal Apostolate donation',
    'donate Catholic apostolate',
    'support Marian mission',
    'Catholic charity donation',
    'Garabandal donation online',
    'support Our Lady of Garabandal',
  ],
  alternates: {
    canonical: `${APP_URL}/en/donations`,
    languages: {
      en: `${APP_URL}/en/donations`,
      'pt-BR': `${APP_URL}/donations`,
      'pt-PT': `${APP_URL}/donations`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/donations`,
    title: 'Donations — Support the Garabandal Apostolate',
    description: 'Your donation supports Catholic Marian pilgrimages, evangelisation and works of charity. Multiple secure payment methods.',
    type: 'website',
    locale: 'en_GB',
    siteName: SITE_NAME,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Donations — Garabandal Apostolate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Donations — Garabandal Apostolate',
    description: 'Support Catholic Marian pilgrimages, evangelisation and charity.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function EnDonationsPage() {
  const donateActionSchema = {
    '@context': 'https://schema.org',
    '@type': 'DonateAction',
    name: 'Support the Garabandal Apostolate',
    description: 'Donate to the Garabandal Apostolate to support Catholic Marian pilgrimages, evangelisation and works of charity.',
    url: `${APP_URL}/en/donations`,
    recipient: {
      '@type': ['Organization', 'NGO', 'ReligiousOrganization'],
      name: 'Garabandal Apostolate',
      url: APP_URL,
    },
    object: {
      '@type': 'MoneyTransfer',
      description: 'Donation to support the Garabandal Apostolate mission',
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What payment methods are available?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You can donate by Credit Card, MB WAY, PIX, Multibanco or Bank Transfer. Available methods appear in the donation modal.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does bank transfer work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'When you choose Bank Transfer, we show you the bank details and ask you to upload the proof of payment in the form. The donation is registered after that submission.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I request a donation receipt?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. In the form, enable the receipt option and fill in the required details. The receipt is issued and validated by the administrative team after payment confirmation.',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donateActionSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Suspense fallback={null}>
        <DonationsClient />
      </Suspense>
    </>
  );
}
