import { Section, SectionHeader } from './ui';

/**
 * Renowned endorsements of Garabandal (social proof / credibility band).
 *
 * ⚠️ REVER ANTES DE PUBLICAR: estas são versões documentadas das citações.
 * Confirmar o texto e a atribuição exatos com a equipa do Apostolado.
 * Em particular, a frase atribuída à Madre Teresa é, em muitas fontes,
 * atribuída a Conchita González (uma das videntes) — verificar antes do go-live.
 */

interface Endorsement {
    quotePt: string;
    quoteEn: string;
    author: string;
    rolePt: string;
    roleEn: string;
}

const ENDORSEMENTS: Endorsement[] = [
    {
        quotePt: 'É a história mais bela da Humanidade depois do nascimento de Jesus Cristo.',
        quoteEn: 'It is the most beautiful story of Humanity since the birth of Jesus Christ.',
        author: 'Papa Paulo VI',
        rolePt: 'Sumo Pontífice',
        roleEn: 'Supreme Pontiff',
    },
    {
        quotePt: 'Sim, é verdade que Nossa Senhora está a aparecer em Garabandal.',
        quoteEn: 'Yes, it is true that Our Lady is appearing at Garabandal.',
        author: 'São Padre Pio',
        rolePt: 'Místico e confessor',
        roleEn: 'Mystic and confessor',
    },
    {
        quotePt: 'Desde o início senti que os acontecimentos de Garabandal eram verdadeiros.',
        quoteEn: 'From the very beginning I felt that the events of Garabandal were true.',
        author: 'Madre Teresa de Calcutá',
        rolePt: 'Fundadora das Missionárias da Caridade',
        roleEn: 'Founder of the Missionaries of Charity',
    },
];

const Endorsements = ({ locale }: { locale: 'pt' | 'en' }) => {
    const isEn = locale === 'en';

    return (
        <Section tone="paper" labelledBy="home-endorsements-heading">
            <SectionHeader
                id="home-endorsements-heading"
                eyebrow={isEn ? 'Testimony' : 'Testemunho'}
                title={isEn ? 'What they said about Garabandal' : 'O que disseram sobre Garabandal'}
            />

            <div className="grid gap-12 md:grid-cols-3 md:gap-10">
                {ENDORSEMENTS.map((e) => (
                    <figure key={e.author} className="flex flex-col border-t border-ink pt-6">
                        <blockquote className="flex-1 font-serif text-[1.375rem] leading-[1.5] text-ink">
                            &ldquo;{isEn ? e.quoteEn : e.quotePt}&rdquo;
                        </blockquote>
                        <figcaption className="mt-6 text-sm">
                            <span className="font-semibold text-ink">{e.author}</span>
                            <span className="mt-0.5 block text-muted">{isEn ? e.roleEn : e.rolePt}</span>
                        </figcaption>
                    </figure>
                ))}
            </div>
        </Section>
    );
};

export default Endorsements;
