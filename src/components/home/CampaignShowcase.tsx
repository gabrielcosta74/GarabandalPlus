import { CAMPAIGN_CONTENT, CASA_IMAGE_URL } from './constants';
import Link from 'next/link';
import Image from 'next/image';
import { DonationMeta, formatCurrency } from '../../lib/donations';
import { getTranslations } from '../../i18n';
import { CONTAINER, Eyebrow, H2_CLASS, buttonClass } from './ui';

interface CampaignShowcaseProps {
    meta: DonationMeta;
    locale: 'pt' | 'en';
}

/**
 * The one emotional, full-bleed moment on the page: the Welcome House campaign.
 * Single column over the photograph; progress and amounts stay readable on ink.
 */
const CampaignShowcase = ({ meta, locale }: CampaignShowcaseProps) => {
    const t = getTranslations(locale);
    const isEn = locale === 'en';

    const progress = meta.goal <= 0 ? 0 : Math.min(100, Math.round((meta.raised / meta.goal) * 100));

    return (
        <section aria-labelledby="home-campaign-heading" className="relative isolate overflow-hidden bg-ink py-24 text-white md:py-32">
            <Image
                src={CASA_IMAGE_URL}
                alt=""
                fill
                className="object-cover"
                sizes="100vw"
            />
            <div className="absolute inset-0 bg-ink/70" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />

            <div className={`${CONTAINER} relative z-10`}>
                <div className="max-w-xl">
                    <Eyebrow onDark>{isEn ? 'Welcome House project' : 'Projeto Casa de Acolhimento'}</Eyebrow>
                    <h2 id="home-campaign-heading" className={H2_CLASS}>
                        {isEn ? 'Welcome House' : CAMPAIGN_CONTENT.title}
                    </h2>

                    <p className="mt-6 text-lg leading-relaxed text-white/80">
                        {isEn
                            ? 'The Association has acquired a house in the mountains near Garabandal to serve as support for pilgrims seeking to encounter God through Garabandal.'
                            : CAMPAIGN_CONTENT.description}
                    </p>

                    <div className="mt-10">
                        <div className="flex items-baseline justify-between text-sm">
                            <span className="text-white/70">{isEn ? 'Progress' : 'Progresso'}</span>
                            <span className="font-semibold">{progress}%</span>
                        </div>
                        <div
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={isEn ? 'Campaign progress' : 'Progresso da campanha'}
                            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20"
                        >
                            <div style={{ width: `${progress}%` }} className="h-full rounded-full bg-white" />
                        </div>

                        <dl className="mt-6 grid grid-cols-2 gap-4 sm:gap-6">
                            <div>
                                <dt className="text-sm text-white/70">{isEn ? 'Raised' : 'Angariado'}</dt>
                                <dd className="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{formatCurrency(meta.raised)}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-white/70">{isEn ? 'Goal' : 'Meta'}</dt>
                                <dd className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white/70 sm:text-3xl">{formatCurrency(meta.goal)}</dd>
                            </div>
                        </dl>
                    </div>

                    <Link href={t.urls.donations} className={buttonClass('light', 'mt-10')}>
                        {isEn ? 'Donate to the project' : CAMPAIGN_CONTENT.cta}
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default CampaignShowcase;
