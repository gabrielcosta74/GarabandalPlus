import Image from 'next/image';
import { Eyebrow, H2_CLASS, Section, buttonClass } from './ui';
import { CATEGORIES } from '../../lib/cms/categories';
import Link from 'next/link';

/**
 * Newcomer-friendly introduction: "What is Garabandal?". Image + short copy +
 * three facts, so a first-time visitor gets the premise in one screen.
 */
const WhatIsGarabandal = ({ locale }: { locale: 'pt' | 'en' }) => {
    const isEn = locale === 'en';

    const historyArchiveHref = isEn
        ? `/en/${CATEGORIES.historia.en.slug}`
        : `/${CATEGORIES.historia.pt.slug}`;
    const historyHref = isEn ? '/en/garabandal-history' : '/a-historia-de-garabandal';
    const readingLinks = isEn
        ? [
            { href: '/en/the-messages', label: 'The messages of 1961 and 1965' },
            { href: '/en/as-quatro-videntes', label: 'The four seers' },
            { href: '/en/locais-a-visitar', label: 'Visiting Garabandal' },
        ]
        : [
            { href: '/as-mensagens', label: 'As mensagens de 1961 e 1965' },
            { href: '/as-quatro-videntes', label: 'As quatro videntes' },
            { href: '/locais-a-visitar', label: 'Visitar Garabandal' },
        ];

    const facts = isEn
        ? [
            { value: '1961', label: 'First apparition' },
            { value: '4', label: 'Young visionaries' },
            { value: '1961–65', label: 'Period of the accounts' },
        ]
        : [
            { value: '1961', label: 'Primeira aparição' },
            { value: '4', label: 'Jovens videntes' },
            { value: '1961–65', label: 'Período dos relatos' },
        ];

    return (
        <Section tone="white" labelledBy="home-what-heading">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-24">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-line">
                    <Image
                        src="/images/meninasgarabandal.jpg"
                        alt={isEn ? 'The four visionaries of Garabandal' : 'As quatro videntes de Garabandal'}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover"
                    />
                </div>

                <div className="max-w-xl">
                    <Eyebrow>{isEn ? 'The story' : 'A história'}</Eyebrow>
                    <h2 id="home-what-heading" className={H2_CLASS}>
                        {isEn ? 'What is Garabandal?' : 'O que é Garabandal?'}
                    </h2>

                    <div className="mt-8 space-y-5 text-lg leading-[1.7] text-muted">
                        <p>
                            {isEn
                                ? 'San Sebastián de Garabandal is a village in Cantabria, northern Spain, known for the accounts of apparitions of Our Lady of Mount Carmel between 1961 and 1965. Four girls are associated with those events: Conchita González, Mari Loli Mazón, Jacinta González and Mari Cruz González.'
                                : 'San Sebastián de Garabandal é uma aldeia da Cantábria, no norte de Espanha, conhecida pelos relatos das aparições de Nossa Senhora do Carmo entre 1961 e 1965. Quatro meninas ficaram ligadas a estes acontecimentos: Conchita González, Mari Loli Mazón, Jacinta González e Mari Cruz González.'}
                        </p>
                        <p>
                            {isEn
                                ? 'The two public messages, dated 18 October 1961 and 18 June 1965, call for conversion, prayer, penance and devotion to the Eucharist. Begin with the history, then explore the message texts and testimonies preserved in the Apostolate’s archive.'
                                : 'As duas mensagens públicas, de 18 de outubro de 1961 e 18 de junho de 1965, apelam à conversão, à oração, à penitência e ao amor à Eucaristia. Comece pela história e aprofunde depois os textos das mensagens e os testemunhos preservados no arquivo do Apostolado.'}
                        </p>
                    </div>

                    <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-line pt-8">
                        {facts.map((f) => (
                            <div key={f.label}>
                                <dt className="sr-only">{f.label}</dt>
                                <dd className={`${f.value.length > 4 ? 'text-xl sm:text-3xl' : 'text-3xl sm:text-4xl'} font-semibold tracking-[-0.03em] text-ink`}>{f.value}</dd>
                                <p aria-hidden className="mt-1 text-sm text-muted">{f.label}</p>
                            </div>
                        ))}
                    </dl>

                    <div className="mt-10 flex flex-wrap items-center gap-5">
                        <Link href={historyHref} className={buttonClass('secondary')}>
                            {isEn ? 'Discover the story' : 'Conhecer a história'}
                        </Link>
                        <Link href={historyArchiveHref} className="text-sm font-medium text-muted underline-offset-4 hover:text-brand hover:underline focus-visible:underline">
                            {isEn ? 'Browse the historical archive' : 'Explorar o arquivo histórico'}
                        </Link>
                    </div>
                    <nav aria-label={isEn ? 'Continue exploring Garabandal' : 'Continuar a conhecer Garabandal'} className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm leading-relaxed">
                        {readingLinks.map((link) => (
                            <Link key={link.href} href={link.href} className="font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand focus-visible:decoration-brand">
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
        </Section>
    );
};

export default WhatIsGarabandal;
