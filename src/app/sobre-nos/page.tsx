import { Metadata } from 'next';
import { APP_URL } from '../../lib/config';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
    title: 'Sobre o Apostolado',
    description: 'Conheça a história e a missão do Apostolado de Garabandal. Há mais de 16 anos a divulgar as mensagens de Nossa Senhora do Carmo de Garabandal em língua portuguesa.',
    alternates: {
        canonical: `${APP_URL}/sobre-nos`,
    },
};

export default function SobreNosPage() {
    return <AboutClient />;
}
