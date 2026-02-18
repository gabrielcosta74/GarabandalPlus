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
                name: 'Quais métodos de pagamento estão disponíveis?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Pode doar com Cartão de Crédito, MB WAY, PIX, Multibanco ou por Transferência Bancária. Os métodos disponíveis aparecem no modal de doação.'
                }
            },
            {
                '@type': 'Question',
                name: 'Como funciona a transferência bancária?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Ao escolher Transferência Bancária, mostramos os dados bancários e pedimos o envio do comprovativo no próprio formulário. A doação fica registada após esse envio.'
                }
            },
            {
                '@type': 'Question',
                name: 'Posso pedir recibo da doação?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Sim. No formulário, ative a opção de recibo e preencha os dados necessários. A emissão e validação são feitas pela equipa administrativa após confirmação do pagamento.'
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
