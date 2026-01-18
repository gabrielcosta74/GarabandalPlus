import { Metadata } from 'next';
import DonationsClient from './DonationsClient';

export const metadata: Metadata = {
    title: 'Fazer Doação',
    description: 'Ajude a construir a Casa de Acolhimento em Garabandal. A sua partilha apoia peregrinos e obras de evangelização.',
};

export default function DonationsPage() {
    return <DonationsClient />;
}
