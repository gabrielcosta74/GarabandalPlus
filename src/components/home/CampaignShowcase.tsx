import { CAMPAIGN_CONTENT, CASA_IMAGE_URL } from './constants';
import { ArrowUpRight, Home, Heart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { DonationMeta, formatCurrency } from '../../lib/donations';
import { getTranslations } from '../../i18n';

interface CampaignShowcaseProps {
    meta: DonationMeta;
    locale: 'pt' | 'en';
}

const CampaignShowcase = ({ meta, locale }: CampaignShowcaseProps) => {
    const t = getTranslations(locale);
    const isEn = locale === 'en';

    const progress = meta.goal <= 0 ? 0 : Math.min(100, Math.round((meta.raised / meta.goal) * 100));

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-24 bg-slate-950">

            {/* Parallax Background - Optimized with will-change and Next/Image */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 h-full w-full">
                    <Image
                        src={CASA_IMAGE_URL}
                        alt="Casa de Acolhimento"
                        fill
                        className="object-cover"
                        sizes="100vw"
                    />
                </div>

                {/* Simplified Overlay - Removed mix-blend-multiply for performance */}
                <div className="absolute inset-0 bg-slate-950/60" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            </div>

            <div className="container mx-auto px-6 relative z-10 w-full">
                <div className="grid items-end gap-12 lg:grid-cols-2 lg:gap-20">

                    {/* Left: Content Card */}
                    <div className="lg:mb-12">
                        <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                            {/* Simplified Glow Effect */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[60px] pointer-events-none" />

                            <div className="relative z-10">
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">
                                    <Home className="w-3 h-3" />
                                    {isEn ? 'Welcome House Project' : 'Projeto Casa de Acolhimento'}
                                </span>

                                <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white mb-6 leading-[1.1]">
                                    {isEn ? 'Welcome House' : CAMPAIGN_CONTENT.title}
                                </h2>

                                <p className="text-xl text-slate-300 font-light leading-relaxed mb-8 border-l-2 border-amber-500/50 pl-6">
                                    {isEn
                                        ? 'The Association has acquired a house in the mountains near Garabandal to serve as support for pilgrims seeking to encounter God through Garabandal.'
                                        : CAMPAIGN_CONTENT.description}
                                </p>

                                <div className="flex flex-col gap-6">
                                    {/* Progress Bar */}
                                    <div className="relative pt-2">
                                        <div className="flex justify-between items-end mb-2 text-sm font-medium">
                                            <span className="text-amber-400">{isEn ? 'Current Progress' : 'Progresso Atual'}</span>
                                            <span className="text-white">{progress}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                style={{ width: `${progress}%` }}
                                                className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.4)] relative"
                                            >
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-white blur-[1px]" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                                            <div className="text-xs text-white/50 uppercase tracking-widest mb-1">{isEn ? 'Raised' : 'Angariado'}</div>
                                            <div className="text-2xl md:text-3xl font-serif text-white">{formatCurrency(meta.raised)}</div>
                                        </div>
                                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                                            <div className="text-xs text-white/50 uppercase tracking-widest mb-1">{isEn ? 'Final Goal' : 'Meta Final'}</div>
                                            <div className="text-xl md:text-2xl font-serif text-white/60">{formatCurrency(meta.goal)}</div>
                                        </div>
                                    </div>

                                    <Link href={t.urls.donations} className="group relative mt-4 flex w-full items-center justify-center gap-3 rounded-xl bg-amber-500 px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-900 shadow-xl shadow-amber-900/20 transition-all duration-300 hover:bg-amber-400">
                                        <span>{isEn ? 'Donate to the Project' : CAMPAIGN_CONTENT.cta}</span>
                                        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Floating Quote/Highlight - Simplified animation */}
                    <div className="lg:h-full flex items-center justify-center lg:justify-end pb-12 lg:pb-32">
                        <div className="relative max-w-sm">
                            <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/10 to-blue-500/10 rounded-[2rem] blur-xl opacity-50" />
                            <div className="relative bg-slate-900/90 backdrop-blur-sm border border-white/10 p-8 rounded-[2rem] text-center">
                                <Heart className="w-8 h-8 text-amber-500 mx-auto mb-4 fill-amber-500/20" />
                                <p className="font-serif text-2xl text-white italic mb-4">
                                    &ldquo;{isEn ? 'Your support builds this refuge.' : CAMPAIGN_CONTENT.subtitle}&rdquo;
                                </p>
                                <div className="w-12 h-1 bg-gradient-to-r from-amber-500 to-transparent mx-auto rounded-full" />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default CampaignShowcase;
