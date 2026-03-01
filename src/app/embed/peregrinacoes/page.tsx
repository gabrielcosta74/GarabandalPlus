import { getPilgrimagesAction } from '../../peregrinacoes/actions';
import PilgrimageShowcase from '../../../components/home/PilgrimageShowcase';

export const revalidate = 300;

export default async function EmbedPeregrinacoesPage() {
    const { data: pilgrimages } = await getPilgrimagesAction();

    const upcomingPilgrimages = pilgrimages || [];

    return (
        <div className="bg-slate-900 min-h-screen">
            <PilgrimageShowcase pilgrimages={upcomingPilgrimages} />
        </div>
    );
}
