import { Metadata } from 'next';
import { Suspense } from 'react';
import LeilaoClient from './LeilaoClient';
import { APP_URL } from '../../lib/config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Leilão Solidário — Apostolado de Garabandal',
    description: 'Licite e contribua directamente para a construção da Casa do Apostolado de Garabandal e para a evangelização mariana.',
    keywords: [
        'leilão solidário Garabandal',
        'leilão católico online',
        'peças religiosas leilão',
        'apoiar Casa do Apostolado',
        'leilão caridade Portugal',
    ],
    alternates: {
        canonical: `${APP_URL}/leilao`,
        languages: {
            'pt-BR': `${APP_URL}/leilao`,
            'pt-PT': `${APP_URL}/leilao`,
            en: `${APP_URL}/en/auction`,
        },
    },
    openGraph: {
        url: `${APP_URL}/leilao`,
        title: 'Leilão Solidário — Apostolado de Garabandal',
        description: 'Licite e apoie a missão do Apostolado.',
        type: 'website',
        locale: 'pt_PT',
        siteName: 'Apostolado de Garabandal',
        images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Leilão Solidário — Apostolado de Garabandal' }],
    },
};

export default function LeilaoPage() {
    return (
        <Suspense fallback={null}>
            <LeilaoClient />
        </Suspense>
    );
}
