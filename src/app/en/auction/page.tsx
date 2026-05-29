import { Metadata } from 'next';
import { Suspense } from 'react';
import LeilaoClient from '../../leilao/LeilaoClient';
import { APP_URL } from '../../../lib/config';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '../../../lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Charity Auction — Garabandal Apostolate',
    description: 'Bid and contribute directly to the building of the Apostolate House and Marian evangelisation.',
    keywords: [
        'Garabandal charity auction',
        'Catholic online auction',
        'religious art auction',
        'support Apostolate House',
        'Catholic charity bidding',
    ],
    alternates: {
        canonical: `${APP_URL}/en/auction`,
        languages: {
            en: `${APP_URL}/en/auction`,
            'pt-BR': `${APP_URL}/leilao`,
            'pt-PT': `${APP_URL}/leilao`,
        },
    },
    openGraph: {
        url: `${APP_URL}/en/auction`,
        title: 'Charity Auction — Garabandal Apostolate',
        description: 'Bid and support the mission of the Apostolate.',
        type: 'website',
        locale: 'en_GB',
        siteName: SITE_NAME,
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Charity Auction — Garabandal Apostolate' }],
    },
};

export default function EnAuctionPage() {
    return (
        <Suspense fallback={null}>
            <LeilaoClient />
        </Suspense>
    );
}
