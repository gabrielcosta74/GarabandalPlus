import { Metadata } from 'next';
import IntentionsClient from './IntentionsClient';

export const metadata: Metadata = {
    title: 'Pedido de Oração',
    description: 'Envie as suas intenções a Nossa Senhora. Acenda uma vela virtual no Santuário de Garabandal.',
};

export default function IntentionsPage() {
    return <IntentionsClient />;
}
