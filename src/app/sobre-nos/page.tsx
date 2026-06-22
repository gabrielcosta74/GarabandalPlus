import { Metadata } from 'next';
import { APP_URL } from '../../lib/config';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
    title: 'Sobre o Apostolado de Garabandal — Missão e História',
    description: 'Conheça a missão do Apostolado de Garabandal: há mais de 16 anos a divulgar as aparições e mensagens de Nossa Senhora do Carmo de Garabandal no Brasil e em Portugal.',
    keywords: [
        'Apostolado de Garabandal história',
        'missão apostolado mariano',
        'Nossa Senhora de Garabandal Brasil',
        'associação católica Portugal',
        'divulgação aparições Garabandal',
        'apostolado mariano português',
    ],
    alternates: {
        canonical: `${APP_URL}/sobre-nos`,
        languages: {
            'pt-BR': `${APP_URL}/sobre-nos`,
            'pt-PT': `${APP_URL}/sobre-nos`,
            'en': `${APP_URL}/en/about`,
        },
    },
    openGraph: {
        url: `${APP_URL}/sobre-nos`,
        title: 'Sobre o Apostolado de Garabandal — Missão e História',
        description: 'Há mais de 16 anos a divulgar as mensagens de Nossa Senhora de Garabandal no Brasil e em Portugal.',
        type: 'website',
        locale: 'pt_BR',
        siteName: 'Apostolado de Garabandal',
        images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Sobre o Apostolado de Garabandal' }],
    },
};

export default function SobreNosPage() {
    return <AboutClient />;
}
