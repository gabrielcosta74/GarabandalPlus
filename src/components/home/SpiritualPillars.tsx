import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from '../../i18n';
import { Section, SectionHeader, buttonClass } from './ui';

/** "Join us": the two ways to take part: prayer and membership. */
const SpiritualPillars = ({ locale }: { locale: 'pt' | 'en' }) => {
  const t = getTranslations(locale);
  const isEn = locale === 'en';

  const items = [
    {
      key: 'prayer',
      image: '/images/padrerezar.webp',
      title: isEn ? 'Prayer network' : 'Rede de oração',
      text: isEn
        ? 'Add your intentions to our worldwide chain of prayer.'
        : 'Junte as suas intenções à nossa corrente mundial de oração.',
      cta: isEn ? 'Send intention' : 'Enviar intenção',
      href: t.urls.intentions,
      variant: 'secondary' as const,
    },
    {
      key: 'members',
      image: '/images/associacao.webp',
      title: isEn ? 'Apostolate members' : 'Membros do Apostolado',
      text: isEn
        ? 'Join a spiritual family that keeps the Apostolate’s mission alive.'
        : 'Junte-se à família espiritual que mantém viva a missão do Apostolado.',
      cta: isEn ? 'Become a member' : 'Ser membro',
      href: t.urls.becomeMember,
      variant: 'primary' as const,
    },
  ];

  return (
    <Section tone="paper" labelledBy="home-join-heading">
      <SectionHeader
        id="home-join-heading"
        eyebrow={isEn ? 'Take part' : 'Participar'}
        title={isEn ? 'Join the mission' : 'Junte-se à missão'}
      />

      <div className="grid gap-8 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col overflow-hidden rounded-xl border border-line bg-white">
            <div className="relative aspect-[16/9] bg-line">
              <Image src={item.image} alt="" fill sizes="(max-width: 768px) 100vw, 580px" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col items-start p-7 md:p-9">
              <h3 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{item.title}</h3>
              <p className="mt-3 max-w-sm flex-1 text-base leading-relaxed text-muted">{item.text}</p>
              <Link href={item.href} className={buttonClass(item.variant, 'mt-8')}>{item.cta}</Link>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
};

export default SpiritualPillars;
