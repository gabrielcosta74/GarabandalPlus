import { Metadata } from 'next';
import { Suspense } from 'react';
import DonationsClient from '../../donations/DonationsClient';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'Donations for the mission',
  description: 'Contribute to the mission of the Garabandal Apostolate. Your donation supports pilgrimages, evangelisation and works of charity.',
  alternates: {
    canonical: `${APP_URL}/en/donations`,
  },
};

export default function EnDonationsPage() {
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Suspense fallback={null}>
        <DonationsClient />
      </Suspense>
    </>
  );
}
