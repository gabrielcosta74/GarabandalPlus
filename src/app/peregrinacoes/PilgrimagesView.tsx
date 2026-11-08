"use client";

import { useState } from 'react';
import '../../components/pilgrimage/editorial/editorial.css';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { QuotaWarning } from '../../components/membership/QuotaWarning';
import { getCivilDateTimestamp, isPubliclyListedPilgrimage, todayCivilTimestamp } from '../../lib/utils';
import { PilgrimagesHero } from '../../components/pilgrimage/editorial/PilgrimagesHero';
import { FeaturedDeparture, OtherDepartures } from '../../components/pilgrimage/editorial/Departures';
import { PILGRIMAGES_HERO_IMAGE } from '../../lib/pilgrimage-covers';
import { GalleryCollage, Mission, TestimonialsMarquee, WaitlistPanel, WhyUs } from '../../components/pilgrimage/editorial/ClassicSections';
import { dateRangeOf, remainingSpotsOf, shortTitleOf, type EditionPilgrimage } from '../../components/pilgrimage/editorial/utils';
import type { EditorialData } from './editorial-data';

export type Pilgrimage = EditionPilgrimage & {
    base_price?: number;
    meeting_point_text?: string;
    flight_info_text?: string;
    payment_plan_text?: string;
    cancellation_policy_text?: string;
    not_included_items?: string[];
};

export default function PilgrimagesView({ initialPilgrimages, editorial }: { initialPilgrimages: Pilgrimage[]; editorial: EditorialData }) {
    const { locale, t } = useLocale();
    const { memberData } = useAuth();
    const isEn = locale === 'en';
    const p = t.pilgrimages;
    const listHref = isEn ? '/en/pilgrimages' : '/peregrinacoes';

    const todayTs = todayCivilTimestamp();
    const isBookable = (pilgrimage: Pilgrimage) => {
        const startsAt = getCivilDateTimestamp(pilgrimage.start_date);
        const isFuture = Number.isFinite(startsAt) && startsAt >= todayTs;
        const isAvailableStatus = pilgrimage.status !== 'closed' && pilgrimage.status !== 'waitlist';
        return isFuture && isAvailableStatus && remainingSpotsOf(pilgrimage) > 0;
    };
    const byDate = (a: Pilgrimage, b: Pilgrimage) => {
        const aDate = getCivilDateTimestamp(a.start_date);
        const bDate = getCivilDateTimestamp(b.start_date);
        return (Number.isFinite(aDate) ? aDate : 0) - (Number.isFinite(bDate) ? bDate : 0);
    };

    // Defesa no cliente: rascunhos/teste nunca renderizam.
    const visible = initialPilgrimages.filter(isPubliclyListedPilgrimage).sort(byDate);
    const bookable = visible.filter(isBookable);
    const unavailable = visible.filter((pilgrimage) => !isBookable(pilgrimage));
    // Em destaque: a próxima partida com vagas.
    const featured = bookable[0] || null;
    const otherOpen = bookable.slice(1);

    // Porquê connosco: uma foto diferente por ponto, sem a colagem com texto.
    // Grupos pequenos → Pinheiros (Brasil); Organizado → Burgos; Espiritual → igreja com frade.
    const galleryUrls = editorial.gallery.map((img) => img.image_url);
    const pickGallery = (needle: string, fallback: number) => galleryUrls.find((url) => url.includes(needle)) || galleryUrls[fallback];
    const whyUsImages = [pickGallery('WA0065', 0), pickGallery('WA0046', 1), pickGallery('WA0003', 2)].filter(Boolean) as string[];

    // Hero: foto de grupo nos Pinheiros + fotos da galeria, a passar.
    const heroImages = Array.from(new Set([PILGRIMAGES_HERO_IMAGE.src, ...editorial.gallery.map((img) => img.image_url)])).slice(0, 6);

    return (
        <div className="pe-root relative overflow-x-clip">
            <PilgrimagesHero
                isEn={isEn}
                images={heroImages}
                nextDeparture={featured ? {
                    href: `${listHref}/${featured.slug}`,
                    title: shortTitleOf(featured, isEn),
                    dateLabel: dateRangeOf(featured, isEn).label,
                } : null}
            />

            <QuotaWarning memberData={memberData} className="mx-auto mt-10 max-w-6xl px-5 md:px-8 lg:px-12" />

            {visible.length === 0 ? (
                <section id="partidas" className="mx-auto max-w-6xl px-5 py-24 text-center md:px-8 lg:px-12">
                    <h2 className="pe-title text-3xl">{p.noActive}</h2>
                    <p className="mx-auto mt-3 max-w-md leading-relaxed text-[var(--pe-muted)]">{p.noActiveDesc}</p>
                </section>
            ) : (
                <>
                    {/* A próxima partida com vagas tem a sua própria secção */}
                    {featured && (
                        <FeaturedDeparture
                            pilgrimage={featured}
                            isEn={isEn}
                            listHref={listHref}
                            eyebrow={p.upcoming}
                            soldOutCount={unavailable.filter((pilgrimage) => pilgrimage.status !== 'waitlist').length}
                        />
                    )}
                    <OtherDepartures
                        otherOpen={otherOpen}
                        unavailable={unavailable}
                        isEn={isEn}
                        listHref={listHref}
                        soldOutLabel={p.card.soldOut}
                        waitlistLabel={p.card.waitlist}
                        withAnchor={!featured}
                    />
                </>
            )}

            <TestimonialsMarquee testimonials={editorial.testimonials} isEn={isEn} title={p.testimonials} />

            <WhyUs
                isEn={isEn}
                images={whyUsImages}
                points={[
                    { title: p.hero.trustSmallGroups, text: p.hero.trustSmallGroupsDesc },
                    { title: p.hero.trustOrganized, text: p.hero.trustOrganizedDesc },
                    { title: p.hero.trustSpiritual, text: p.hero.trustSpiritualDesc },
                ]}
            />

            <GalleryCollage images={galleryUrls} title={p.gallery.title} subtitle={p.gallery.subtitle} isEn={isEn} />

            <Mission
                title={p.missionTitle}
                desc={p.missionDesc}
                items={[
                    { title: p.missionDonation, text: p.missionDonationDesc },
                    { title: p.flightInfoTitle, text: p.flightInfoDesc },
                ]}
            />

            <WaitlistPanel title={p.waitlistTitle} desc={p.waitlistDesc} form={<GeneralWaitlistForm />} />
        </div>
    );
}

function GeneralWaitlistForm() {
    const { locale, t } = useLocale();
    const isEn = locale === 'en';
    const p = t.pilgrimages;
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        try {
            const res = await fetch('/api/leads/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    type: 'general_waitlist',
                    channel_preference: 'email',
                    locale
                })
            });

            if (res.ok) {
                setStatus('success');
                setEmail('');
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'success') {
        return (
            <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-white/5 p-6 text-center animate-fade-in">
                <p className="mb-1 font-medium text-white">{p.waitlistConfirmed}</p>
                <p className="text-sm text-white/70">{p.waitlistConfirmedDesc}</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="relative mx-auto flex max-w-lg flex-col gap-3 rounded-full sm:flex-row sm:border sm:border-white/15 sm:bg-white/5 sm:p-1.5">
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={p.waitlistPlaceholder}
                disabled={loading}
                aria-label={p.waitlistPlaceholder}
                className="h-14 w-full appearance-none rounded-full border border-white/15 bg-white/5 px-6 text-base text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50 sm:flex-1 sm:border-0 sm:bg-transparent"
            />
            <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full min-w-[150px] shrink-0 items-center justify-center rounded-full bg-brand px-8 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
                {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : p.waitlistButton}
            </button>
            {status === 'error' && (
                <div className="absolute -bottom-8 left-0 w-full text-center">
                    <p className="text-sm text-red-300">{isEn ? 'An error occurred. Please try again.' : 'Ocorreu um erro. Tente novamente.'}</p>
                </div>
            )}
        </form>
    );
}
