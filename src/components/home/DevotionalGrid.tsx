import type { HomeCategory } from '../../lib/cms/home';
import { MediaCard, Section, SectionHeader } from './ui';

/**
 * Devotional entry grid for the homepage: the main content gateways (História,
 * Mensagens, Profecias, Testemunhos, ...). Uniform image-first cards, one column
 * on phones, three on desktop.
 */
export default function DevotionalGrid({
  categories,
  locale,
}: {
  categories: HomeCategory[];
  locale: 'pt' | 'en';
}) {
  if (!categories.length) return null;
  const isPt = locale === 'pt';
  const churchPositionCard = isPt
    ? {
        key: 'church-position',
        label: 'A posição da Igreja',
        intro: 'Garabandal nunca foi condenado pela Igreja. Conheça a situação do processo e a documentação disponível.',
        href: '/a-posicao-da-igreja',
        cover: '/images/igrejagarabandal.webp',
      }
    : {
        key: 'church-position',
        label: "The Church's position",
        intro: 'Garabandal has never been condemned by the Church. Learn about the status of the process and the available documentation.',
        href: '/en/a-posicao-da-igreja',
        cover: '/images/igrejagarabandal.webp',
      };
  const cards = [...categories, churchPositionCard];

  return (
    <Section tone="paper" labelledBy="home-discover-heading">
      <SectionHeader
        id="home-discover-heading"
        eyebrow={isPt ? 'Explorar' : 'Explore'}
        title={isPt ? 'Conhecer Garabandal' : 'Discover Garabandal'}
        description={isPt
          ? 'A história, as mensagens e as profecias de Nossa Senhora do Carmo em Garabandal.'
          : 'The history, messages and prophecies of Our Lady of Mount Carmel at Garabandal.'}
      />

      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((cat) => (
          <MediaCard
            key={cat.key}
            href={cat.href}
            image={cat.cover}
            title={cat.label}
            excerpt={cat.intro}
            aspect="aspect-[4/3]"
            excerptLines="line-clamp-3"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
          />
        ))}
      </div>
    </Section>
  );
}
