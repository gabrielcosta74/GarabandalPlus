import { Clock, Mail, MessageCircle, Instagram, Youtube } from 'lucide-react';
import { CONTACT_EMAIL, buildWhatsAppLink } from '../../lib/chat-config';

// Social profiles. Instagram is confirmed; ⚠️ confirmar o canal do YouTube.
const INSTAGRAM_URL = 'https://www.instagram.com/apostoladodegarabandaloficial/';
const YOUTUBE_URL = 'https://www.youtube.com/@apostoladodegarabandal';

/**
 * "Get in touch" band placed just above the footer. Surfaces opening hours,
 * phone/WhatsApp, email and social channels — info the reference site shows
 * prominently but our homepage lacked.
 */
const ContactBar = ({ locale }: { locale: 'pt' | 'en' }) => {
    const isEn = locale === 'en';

    const channels = [
        {
            icon: Clock,
            label: isEn ? 'Opening hours' : 'Horário',
            value: isEn ? 'Every day · 9 AM to 7 PM' : 'Todos os dias · 9h às 19h',
            href: undefined as string | undefined,
        },
        {
            icon: Mail,
            label: 'Email',
            value: CONTACT_EMAIL,
            href: `mailto:${CONTACT_EMAIL}`,
        },
    ];

    return (
        <section className="relative bg-[#070d18] border-t border-white/5 py-20 md:py-24 overflow-hidden">
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-14">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-amber-300/80 mb-6">
                        {isEn ? 'Contact' : 'Contacto'}
                    </span>
                    <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-white leading-tight">
                        {isEn ? 'Talk to us' : 'Fale connosco'}
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {channels.map((c) => {
                        const Inner = (
                            <>
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shrink-0">
                                    <c.icon size={22} />
                                </div>
                                <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">{c.label}</p>
                                <p className="text-white font-medium break-words">{c.value}</p>
                            </>
                        );

                        const base =
                            'flex flex-col rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-7 transition-colors duration-300';

                        return (
                            <div
                                key={c.label}
                            >
                                {c.href ? (
                                    <a
                                        href={c.href}
                                        target={c.href.startsWith('http') ? '_blank' : undefined}
                                        rel={c.href.startsWith('http') ? 'noreferrer' : undefined}
                                        className={`${base} hover:border-amber-500/30 hover:bg-white/[0.06]`}
                                    >
                                        {Inner}
                                    </a>
                                ) : (
                                    <div className={base}>{Inner}</div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Social */}
                <div className="flex flex-wrap items-center justify-center gap-5 mt-12">
                    <span className="w-full text-center text-sm uppercase tracking-widest text-slate-400 font-medium sm:w-auto sm:mr-1">{isEn ? 'Follow us' : 'Siga-nos'}</span>
                    <a
                        href={INSTAGRAM_URL}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Instagram"
                        className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-lg transition-all hover:-translate-y-1 hover:border-transparent hover:text-white hover:bg-gradient-to-br hover:from-[#f58529] hover:via-[#dd2a7b] hover:to-[#8134af] hover:shadow-[0_10px_30px_-6px_rgba(221,42,123,0.6)]"
                    >
                        <Instagram size={28} strokeWidth={2.25} />
                    </a>
                    <a
                        href={YOUTUBE_URL}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="YouTube"
                        className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-lg transition-all hover:-translate-y-1 hover:border-transparent hover:bg-[#ff0000] hover:shadow-[0_10px_30px_-6px_rgba(255,0,0,0.6)]"
                    >
                        <Youtube size={28} strokeWidth={2.25} />
                    </a>
                    <a
                        href={buildWhatsAppLink()}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="WhatsApp"
                        className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-lg transition-all hover:-translate-y-1 hover:border-transparent hover:bg-[#25d366] hover:shadow-[0_10px_30px_-6px_rgba(37,211,102,0.6)]"
                    >
                        <MessageCircle size={28} strokeWidth={2.25} />
                    </a>
                </div>
            </div>
        </section>
    );
};

export default ContactBar;
