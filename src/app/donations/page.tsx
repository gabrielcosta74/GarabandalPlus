import { Metadata } from 'next';
import { Suspense } from 'react';
import DonationsClient from './DonationsClient';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
    title: 'Doações para a missão',
    description: 'Contribua para a missão do Apostolado de Garabandal. Sua doação apoia peregrinações, evangelização e obras de caridade.',
    alternates: {
        canonical: `${APP_URL}/donations`,
    },
};

export default function DonationsPage() {
    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: 'Como posso fazer uma doação?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Você pode doar online pelo formulário nesta página. As doações ajudam a missão do Apostolado e obras de evangelização.'
                }
            },
            {
                '@type': 'Question',
                name: 'Receberei recibo da doação?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Sim. Os recibos são emitidos manualmente pela administração após a confirmação do pagamento.'
                }
            },
            {
                '@type': 'Question',
                name: 'Para que a doação é utilizada?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'As doações apoiam peregrinações, ações de evangelização e projetos do Apostolado de Garabandal.'
                }
            }
        ]
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
