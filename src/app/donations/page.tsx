import { Metadata } from 'next';
import { Suspense } from 'react';
import DonationsClient from './DonationsClient';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
    title: 'Doações — Apoie o Apostolado de Garabandal',
    description: 'Contribua para a missão do Apostolado de Garabandal. Sua doação apoia peregrinações marianas, evangelização e obras de caridade católica no Brasil e em Portugal. PIX disponível.',
    keywords: [
        'doação apostolado Garabandal',
        'donativo associação católica',
        'apoiar missão católica Brasil',
        'doação PIX católico',
        'apoiar evangelização mariana',
        'donativo Nossa Senhora Garabandal',
    ],
    alternates: {
        canonical: `${APP_URL}/donations`,
        languages: {
            'pt-BR': `${APP_URL}/donations`,
            'pt-PT': `${APP_URL}/donations`,
            'en': `${APP_URL}/en/donations`,
        },
    },
    openGraph: {
        url: `${APP_URL}/donations`,
        title: 'Doações — Apoie o Apostolado de Garabandal',
        description: 'A sua doação apoia peregrinações marianas, evangelização e obras de caridade. Aceitamos PIX, cartão, MB WAY e transferência bancária.',
        type: 'website',
        locale: 'pt_BR',
        siteName: 'Garabandal +',
        images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Doações — Apostolado de Garabandal' }],
    },
};

export default function DonationsPage() {
    const donateActionSchema = {
        '@context': 'https://schema.org',
        '@type': 'DonateAction',
        name: 'Apoiar o Apostolado de Garabandal',
        description: 'Contribua para a missão do Apostolado de Garabandal: peregrinações marianas, evangelização e obras de caridade.',
        url: `${APP_URL}/donations`,
        recipient: {
            '@type': ['Organization', 'NGO', 'ReligiousOrganization'],
            name: 'Apostolado de Garabandal',
            url: APP_URL,
        },
        object: {
            '@type': 'MoneyTransfer',
            description: 'Donativo para a missão do Apostolado de Garabandal',
        },
    };

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
