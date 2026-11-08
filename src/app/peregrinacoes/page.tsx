import { getPilgrimagesAction } from './actions';
import { getEditorialData } from './editorial-data';
import PilgrimagesView, { type Pilgrimage } from './PilgrimagesView';

// Tudo é lido no servidor (cache de 5 min) para a página chegar completa no
// HTML: melhor para SEO e as animações arrancam sem conteúdo a "saltar".
export default async function PilgrimagesPage() {
    let pilgrimages: Pilgrimage[] = [];
    try {
        const result = await getPilgrimagesAction();
        if (Array.isArray(result?.data)) pilgrimages = result.data as Pilgrimage[];
    } catch (err) {
        console.error('❌ [Peregrinacoes] Server fetch failed:', err);
    }

    const editorial = await getEditorialData();

    return <PilgrimagesView initialPilgrimages={pilgrimages} editorial={editorial} />;
}
