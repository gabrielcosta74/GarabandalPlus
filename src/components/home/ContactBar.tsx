import { Instagram, Mail, MessageCircle, Youtube } from 'lucide-react';
import { CONTACT_EMAIL, buildWhatsAppLink } from '../../lib/chat-config';
import { Section, SectionHeader } from './ui';

// Social profiles. Instagram is confirmed; ⚠️ confirmar o canal do YouTube.
const INSTAGRAM_HANDLE = 'apostoladodegarabandaloficial';
const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;
const YOUTUBE_URL = 'https://www.youtube.com/@apostoladodegarabandal';

/**
 * "Get in touch" band placed just above the footer: opening hours, email and
 * the social channels (Instagram, YouTube, WhatsApp).
 */
const ContactBar = ({ locale }: { locale: 'pt' | 'en' }) => {
    const isEn = locale === 'en';

    const social = [
        { label: 'Instagram', href: INSTAGRAM_URL, icon: Instagram, handle: `@${INSTAGRAM_HANDLE}` },
        { label: 'YouTube', href: YOUTUBE_URL, icon: Youtube, handle: isEn ? 'Apostolate channel' : 'Canal do Apostolado' },
        { label: 'WhatsApp', href: buildWhatsAppLink(), icon: MessageCircle, handle: isEn ? 'Message us' : 'Enviar mensagem' },
    ];

    const row = 'flex items-center gap-4 py-4 text-ink';
    const iconBox = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink transition-colors';

    return (
        <Section tone="paper" labelledBy="home-contact-heading">
            <SectionHeader
                id="home-contact-heading"
                eyebrow={isEn ? 'Contact' : 'Contacto'}
                title={isEn ? 'Talk to us' : 'Fale connosco'}
            />

            <div className="grid gap-12 md:grid-cols-2">
                <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
                        {isEn ? 'Get in touch' : 'Informações'}
                    </h3>
                    <ul className="divide-y divide-line border-y border-line">
                        <li className={row}>
                            <span className={iconBox} aria-hidden><Mail size={18} /></span>
                            <span>
                                <span className="block text-sm text-muted">Email</span>
                                <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{CONTACT_EMAIL}</a>
                            </span>
                        </li>
                        <li className={row}>
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-sm font-semibold" aria-hidden>9–19</span>
                            <span>
                                <span className="block text-sm text-muted">{isEn ? 'Opening hours' : 'Horário'}</span>
                                <span className="font-semibold">{isEn ? 'Every day · 9 AM to 7 PM' : 'Todos os dias · 9h às 19h'}</span>
                            </span>
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
                        {isEn ? 'Follow us' : 'Siga-nos'}
                    </h3>
                    <ul className="divide-y divide-line border-y border-line">
                        {social.map((s) => (
                            <li key={s.label}>
                                <a
                                    href={s.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`${row} group focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand`}
                                >
                                    <span className={`${iconBox} group-hover:border-ink`} aria-hidden><s.icon size={18} /></span>
                                    <span className="min-w-0">
                                        <span className="block font-semibold">{s.label}</span>
                                        <span className="block truncate text-sm text-muted">{s.handle}</span>
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Section>
    );
};

export default ContactBar;
