import { Metadata } from 'next';
import IntentionsClient from './IntentionsClient';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
    title: 'Pedido de oração',
    description: 'Envie suas intenções a Nossa Senhora. Acenda uma vela virtual e confie suas preces ao Santuário de Garabandal.',
    alternates: {
        canonical: `${APP_URL}/intencoes`,
        languages: {
            'pt-BR': `${APP_URL}/intencoes`,
            'pt-PT': `${APP_URL}/intencoes`,
            en: `${APP_URL}/en/intentions`,
        },
    },
};

export default function IntentionsPage() {
    return <IntentionsClient />;
}
