import { Metadata } from 'next';
import IntentionsClient from './IntentionsClient';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
    title: 'Pedido de oração',
    description: 'Envie suas intenções a Nossa Senhora. Acenda uma vela virtual e confie suas preces ao Santuário de Garabandal.',
    alternates: {
        canonical: `${APP_URL}/intencoes`,
    },
};

export default function IntentionsPage() {
    return <IntentionsClient />;
}
