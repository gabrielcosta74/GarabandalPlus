"use client";

import { usePathname } from 'next/navigation';
import { captureAnalyticsEvent } from '../../lib/analytics';

// Apostolado WhatsApp contact number (international format, digits only for wa.me).
const WHATSAPP_NUMBER = '351915206815';
const WHATSAPP_DISPLAY = '+351 915 206 815';

// Locale prefixes used by the localized route trees.
const LOCALES = new Set(['en', 'es', 'fr', 'it']);

// Dedicated top-level routes that are NOT served by the CMS `[slug]` catch-all.
// A bare single-segment path matching one of these is a real route, not a CMS page,
// so the WhatsApp button should still show there.
const DEDICATED_ROUTES = new Set([
    'account', 'admin', 'api', 'auth', 'auth-callback', 'biblioteca',
    'cancelar-subscricao', 'convite', 'cookies', 'donations', 'embed',
    'encomendas', 'ensinamentos', 'historia', 'intencoes', 'l', 'leilao',
    'login', 'loja', 'loja-online', 'member', 'membership', 'mensagens',
    'noticias', 'peregrinacoes', 'portal-oracoes', 'privacidade', 'profecias',
    'register', 'reset-password', 'sobre-nos', 'termos', 'testemunhos',
    'thank-you', 'tornar-membro', 'transparencia',
]);

// Detect CMS reading pages (article detail + CMS page detail), where the
// floating WhatsApp button should be hidden, per request.
function isCmsReadingPage(pathname: string): boolean {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return false;

    // Drop a leading locale prefix so PT-root and localized trees share logic.
    const rest = LOCALES.has(segments[0]) ? segments.slice(1) : segments;
    if (rest.length === 0) return false;

    // Article detail: /l/<slug> (and /<locale>/l/<slug>).
    if (rest[0] === 'l' && rest.length >= 2) return true;

    // CMS page detail: the bare `[slug]` catch-all — a single content segment
    // that is not one of the dedicated top-level routes.
    if (rest.length === 1 && !DEDICATED_ROUTES.has(rest[0])) return true;

    return false;
}

export default function WhatsAppFloatingButton() {
    const pathname = usePathname();

    // Hide on pilgrimage pages (PT /peregrinacoes and EN /pilgrimages), per request.
    const isPilgrimage =
        pathname?.startsWith('/peregrinacoes') ||
        pathname?.startsWith('/en/pilgrimages');
    if (isPilgrimage) return null;

    // Hide on CMS article/page reading views, per request.
    if (pathname && isCmsReadingPage(pathname)) return null;

    return (
        <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Contactar o Apostolado por WhatsApp (${WHATSAPP_DISPLAY})`}
            title="Fale connosco no WhatsApp"
            onClick={() => captureAnalyticsEvent('whatsapp_contact_clicked', {
                source: 'floating_button',
                path: pathname || '/',
            })}
            // Raised on mobile/tablet to clear the fixed MobileBottomNav (hidden at lg+).
            // z-40: above page content, but below modals/overlays (z-50+) and the mobile nav.
            className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 32"
                fill="currentColor"
                className="h-7 w-7"
                aria-hidden="true"
            >
                <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.257.59 4.46 1.71 6.405L3.2 28.8l6.55-1.717a12.74 12.74 0 0 0 6.253 1.593h.005c7.06 0 12.8-5.74 12.8-12.8 0-3.42-1.332-6.635-3.752-9.055A12.715 12.715 0 0 0 16.003 3.2Zm0 23.36h-.004a10.57 10.57 0 0 1-5.385-1.475l-.386-.23-3.886 1.02 1.037-3.79-.252-.39a10.55 10.55 0 0 1-1.617-5.625c0-5.867 4.776-10.64 10.648-10.64a10.57 10.57 0 0 1 7.524 3.12 10.55 10.55 0 0 1 3.117 7.524c0 5.867-4.776 10.64-10.633 10.64Zm5.835-7.967c-.32-.16-1.892-.933-2.185-1.04-.293-.107-.507-.16-.72.16-.213.32-.826 1.04-1.013 1.253-.187.213-.373.24-.693.08-.32-.16-1.35-.498-2.572-1.587-.95-.847-1.592-1.893-1.779-2.213-.186-.32-.02-.493.14-.653.144-.143.32-.373.48-.56.16-.187.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.733-.986-2.373-.26-.624-.524-.54-.72-.55l-.613-.01c-.213 0-.56.08-.853.4-.293.32-1.12 1.093-1.12 2.667 0 1.573 1.146 3.093 1.306 3.307.16.213 2.253 3.44 5.46 4.825.763.33 1.358.527 1.822.674.766.244 1.463.21 2.014.127.614-.092 1.892-.773 2.159-1.52.266-.747.266-1.387.186-1.52-.08-.133-.293-.213-.613-.373Z" />
            </svg>
        </a>
    );
}
