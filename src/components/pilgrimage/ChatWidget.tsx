"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { MessageCircle, X, ArrowUp, Sparkles, Users, ArrowRight, CreditCard, Plane, ClipboardList, Mail } from 'lucide-react';
import {
    buildWhatsAppLink,
    buildInterestWhatsAppLink,
    ESCALATION_MARKERS,
    CONTACT_EMAIL,
    parseChatActions,
    ACTION_LABELS,
    type ChatAction,
} from '../../lib/chat-config';
import { captureInterest } from '../../lib/interest-capture';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { useLocale } from '../../contexts/LocaleContext';
import { isNovemberCampaignPilgrimage } from '../../lib/utils';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    streaming?: boolean;
};

type Props = {
    pilgrimageSlug?: string;
    pilgrimageTitle?: string;
    /** Pilgrimage id — used to attach "Estou interessado em ir" captures to the pilgrimage. */
    pilgrimageId?: string;
    /** Where the widget is mounted. Sent to the API so the bot can adapt. */
    context?: 'pilgrimage-page' | 'registration-form';
    /** Remaining spots to surface urgency + CTA inside the chat. Only used on pilgrimage-page. */
    remainingSpots?: number;
    /** Destination for the "Iniciar Inscrição" CTA. Omitted -> CTA hidden. */
    registrationLink?: string;
    /** If true, replace the CTA with a subtle "Lista de espera" note. */
    isWaitlist?: boolean;
    /** 1-based step the person is on inside the registration form. */
    currentStep?: number;
    /** Ordered labels of the registration form steps, for the in-chat stepper. */
    stepLabels?: string[];
    /** Opens the page's flights modal. Without it, "See flight options" links to the pilgrimage page. */
    onOpenFlights?: () => void;
    /** Hides the floating button while a page modal is open, so it does not sit on its text. */
    hideLauncher?: boolean;
};

type SendSource = 'typed' | 'chip' | 'suggestion';

// Keyed by pilgrimage slug so different peregrinações keep separate sessions.
const storageKey = (slug?: string) => `chat:session:${slug || 'generic'}`;
const messagesKey = (slug?: string) => `chat:messages:${slug || 'generic'}`;
const NUDGE_KEY = 'chat:nudged';

// Same gradient as the "Ser membro" button (.btn-member), for surfaces that must not shimmer.
const BRAND_GRADIENT = 'bg-[linear-gradient(135deg,#4b7bf0_0%,var(--color-brand)_45%,var(--color-brand-700)_100%)]';

const CHIPS_PAGE_PT = [
    'Quanto custa?',
    'Posso pagar em prestações?',
    'O voo está incluído?',
    'Como me inscrevo?',
    'Que documentos preciso?',
    'E se tiver de cancelar?',
];
const CHIPS_PAGE_EN = [
    'How much does it cost?',
    'Can I pay in installments?',
    'Is the flight included?',
    'How do I register?',
    'What documents do I need?',
    'What if I need to cancel?',
];

// Form chips lead with the moments people actually get stuck at — the old set was
// all informational and none of them unblocked anyone mid-form.
const CHIPS_FORM_PT = [
    'Onde finalizo a inscrição?',
    'Já preenchi tudo, e agora?',
    'Não consigo preencher um campo',
    'Quanto tenho de pagar agora?',
    'Que tipo de quarto escolher?',
    'Tenho alergias alimentares, o que indico?',
];
const CHIPS_FORM_EN = [
    'Where do I finish the registration?',
    "I've filled everything, what now?",
    "I can't fill in a field",
    'How much do I pay now?',
    'Which room type should I choose?',
    'I have food allergies, what do I put?',
];

const CHIPS_WAITLIST_PT = [
    'Ainda dá para entrar?',
    'Há chance de abrir mais lugares?',
    'Como garanto a minha vaga?',
    'Quero muito ir, o que faço?',
    'Falar com o Apostolado agora',
];
const CHIPS_WAITLIST_EN = [
    'Can I still get in?',
    'Any chance more spots open?',
    'How do I secure my place?',
    'I really want to go, what do I do?',
    'Talk to the Apostolate now',
];

function useSessionId(slug?: string) {
    const ref = useRef<string>('');
    if (!ref.current) {
        const key = storageKey(slug);
        if (typeof window !== 'undefined') {
            const stored = window.sessionStorage.getItem(key);
            if (stored) {
                ref.current = stored;
            } else {
                ref.current = typeof crypto !== 'undefined'
                    ? crypto.randomUUID()
                    : Math.random().toString(36).slice(2);
                window.sessionStorage.setItem(key, ref.current);
            }
        } else {
            ref.current = Math.random().toString(36).slice(2);
        }
    }
    return ref.current;
}

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)');
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    return isMobile;
}

// iOS keeps 100dvh at the full screen height while the keyboard is up, which pushed
// the input under the keyboard. The visual viewport is the part actually visible.
function useVisualViewport(enabled: boolean) {
    const [box, setBox] = useState<{ height: number; top: number } | null>(null);
    useEffect(() => {
        const vv = window.visualViewport;
        if (!enabled || !vv) { setBox(null); return; }
        const update = () => setBox({ height: vv.height, top: vv.offsetTop });
        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, [enabled]);
    return box;
}

type ResolvedAction = {
    key: ChatAction;
    label: string;
    href: string;
    external?: boolean;
    icon: React.ReactNode;
    /** Primary actions get the brand treatment; the rest stay quiet. */
    primary?: boolean;
    /** Runs in place of navigating, for actions that open something on this page. */
    onSelect?: () => void;
};

export default function ChatWidget({
    pilgrimageSlug,
    pilgrimageTitle,
    pilgrimageId,
    context = 'pilgrimage-page',
    remainingSpots,
    registrationLink,
    isWaitlist,
    currentStep,
    stepLabels,
    onOpenFlights,
    hideLauncher,
}: Props) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const isForm = context === 'registration-form';
    const CHIPS_PAGE = isWaitlist
        ? (isEn ? CHIPS_WAITLIST_EN : CHIPS_WAITLIST_PT)
        : (isEn ? CHIPS_PAGE_EN : CHIPS_PAGE_PT);
    const CHIPS_FORM = isEn ? CHIPS_FORM_EN : CHIPS_FORM_PT;
    const [isOpen, setIsOpen] = useState(false);
    const [showNudge, setShowNudge] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const pinnedToBottomRef = useRef(true);
    const abortRef = useRef<AbortController | null>(null);
    // Messages already on screen when the panel opened render without an entrance animation.
    const settledIdsRef = useRef<Set<string>>(new Set());
    const sessionId = useSessionId(pilgrimageSlug);
    const isMobile = useIsMobile();
    const reduceMotion = useReducedMotion();
    const dragControls = useDragControls();
    const viewport = useVisualViewport(isOpen && isMobile);
    const isNovemberCampaign = isNovemberCampaignPilgrimage({
        slug: pilgrimageSlug,
        title: pilgrimageTitle,
    });

    const initialGreeting = useMemo<Message>(() => ({
        id: 'greeting',
        role: 'assistant',
        content: isForm
            // Says out loud that the chat does not register anyone — people have finished
            // a whole conversation here believing they had signed up.
            ? (isEn
                ? `Hello! I'm here to help while you complete the registration for **${pilgrimageTitle || 'this pilgrimage'}**.\n\n**Complete the registration in the form behind this window.** I can help with rooms, documents, payments, flights or the next step.`
                : `Olá! Estou aqui para ajudar durante a inscrição na **${pilgrimageTitle || 'peregrinação'}**.\n\n**Conclua a inscrição no formulário atrás desta janela.** Posso ajudar com quartos, documentos, pagamentos, voos ou o próximo passo.`)
            : pilgrimageTitle
                ? (isEn
                    ? `Hello! 🙏 I'm the Apostolate's assistant. Ask me anything about the **${pilgrimageTitle}**: prices and installments, the itinerary, flights or how to register.`
                    : `Olá! 🙏 Sou o assistente do Apostolado. Pergunte-me o que quiser sobre a **${pilgrimageTitle}**: valores e prestações, itinerário, voo ou como se inscrever.`)
                : (isEn
                    ? "Hello! 🙏 I'm the Apostolate's assistant. Ask me anything about our pilgrimages."
                    : 'Olá! 🙏 Sou o assistente do Apostolado. Pergunte-me o que quiser sobre as nossas peregrinações.'),
    }), [pilgrimageTitle, isForm, isEn]);

    const [messages, setMessages] = useState<Message[]>(() => {
        if (typeof window === 'undefined') return [initialGreeting];
        try {
            const stored = window.sessionStorage.getItem(messagesKey(pilgrimageSlug));
            if (stored) {
                const parsed = JSON.parse(stored) as Message[];
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch { /* ignore corrupted storage */ }
        return [initialGreeting];
    });

    useEffect(() => {
        setMessages(prev => prev.length <= 1 ? [initialGreeting] : prev);
    }, [initialGreeting]);

    // Persist messages across navigations within the same tab.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const serializable = messages.map(({ id, role, content }) => ({ id, role, content }));
            window.sessionStorage.setItem(messagesKey(pilgrimageSlug), JSON.stringify(serializable));
        } catch { /* ignore quota errors */ }
    }, [messages, pilgrimageSlug]);

    // Sent to the API so the assistant knows exactly where the person is instead of
    // guessing step names — the single biggest source of bad answers in the form.
    const formStepInfo = useMemo(() => {
        if (!isForm || !currentStep || !stepLabels?.length) return undefined;
        return {
            current: currentStep,
            total: stepLabels.length,
            label: stepLabels[currentStep - 1],
            next: stepLabels[currentStep],
        };
    }, [isForm, currentStep, stepLabels]);

    // Follow the stream only while the person is reading the end. Scrolling
    // smoothly on every token made the sheet judder on phones.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        // A fresh conversation opens at the top so the greeting is read in full.
        if (messages.length <= 1) el.scrollTop = 0;
        else if (pinnedToBottomRef.current) el.scrollTop = el.scrollHeight;
    }, [messages, isOpen]);

    const onMessagesScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };

    // One gentle invitation per session, on every screen size. The old tooltip was
    // desktop-only and the permanent red dot read as a fake notification.
    useEffect(() => {
        try {
            if (window.sessionStorage.getItem(NUDGE_KEY)) return;
        } catch { /* storage blocked */ }
        const showTimer = setTimeout(() => {
            setShowNudge(true);
            try { window.sessionStorage.setItem(NUDGE_KEY, '1'); } catch { /* ignore */ }
        }, isForm ? 20000 : 8000);
        return () => clearTimeout(showTimer);
    }, [isForm]);

    useEffect(() => {
        if (!showNudge) return;
        const hideTimer = setTimeout(() => setShowNudge(false), 10000);
        return () => clearTimeout(hideTimer);
    }, [showNudge]);

    // On phones the chat is a full-screen sheet, so the sticky booking bar has to
    // step aside and the page behind must stop scrolling. Both are driven by this
    // class (see globals.css) because the bar renders through its own portal.
    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.classList.toggle('chat-open', isOpen);
        return () => document.body.classList.remove('chat-open');
    }, [isOpen]);

    // On phones the sheet looks like a screen of its own, so the Android back
    // button must close it instead of leaving the pilgrimage page.
    useEffect(() => {
        if (!isOpen || !isMobile) return;
        if (!window.history.state?.chatOpen) {
            window.history.pushState({ ...window.history.state, chatOpen: true }, '');
        }
        const onPop = () => {
            if (!window.history.state?.chatOpen) setIsOpen(false);
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [isOpen, isMobile]);

    const openChat = (source: 'fab' | 'nudge') => {
        settledIdsRef.current = new Set(messages.map(m => m.id));
        pinnedToBottomRef.current = true;
        setIsOpen(true);
        setShowNudge(false);
        captureAnalyticsEvent('chat_opened', {
            source,
            pilgrimage_slug: pilgrimageSlug,
            chat_context: context,
            returning: messages.length > 1,
        });
    };

    const closeChat = useCallback(() => {
        if (isMobile && window.history.state?.chatOpen) {
            window.history.back(); // the popstate listener closes the sheet
        } else {
            setIsOpen(false);
        }
    }, [isMobile]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeChat(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, closeChat]);

    const resizeInput = () => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    useEffect(resizeInput, [input]);

    const sendMessage = async (text: string, source: SendSource = 'typed') => {
        if (!text.trim() || isLoading) return;

        const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: text.trim() };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setIsLoading(true);
        pinnedToBottomRef.current = true;

        captureAnalyticsEvent('chat_message_sent', {
            source,
            message_index: nextMessages.filter(m => m.role === 'user').length,
            pilgrimage_slug: pilgrimageSlug,
            chat_context: context,
        });

        const assistantId = `a-${Date.now()}`;
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true }]);

        abortRef.current = new AbortController();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortRef.current.signal,
                body: JSON.stringify({
                    messages: nextMessages.map(({ role, content }) => ({ role, content })),
                    pilgrimageSlug,
                    pilgrimageTitle,
                    sessionId,
                    context,
                    locale,
                    formStep: formStepInfo,
                }),
            });

            if (!response.body) throw new Error('No response body');

            const contentType = response.headers.get('content-type') || '';

            // Fallback: API returned JSON (error case) — show content directly
            if (contentType.includes('application/json')) {
                const data = await response.json().catch(() => ({}));
                // Errors still end in the WhatsApp button: when the assistant is down, a
                // person ready to ask is exactly who should reach the team instead.
                const content = `${data?.content || (isEn ? 'Sorry, an unexpected error occurred. Please try again or write to geral@apostoladodegarabandal.com.' : 'Desculpe, ocorreu um erro inesperado. Por favor tente novamente ou escreva para geral@apostoladodegarabandal.com.')}\n[[WHATSAPP]]`;
                setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content, streaming: false } : m
                ));
                return;
            }

            // Normal case: SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let done = false;

            while (!done) {
                const { done: streamDone, value } = await reader.read();
                if (streamDone) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;
                    const raw = trimmed.slice(5).trim();
                    if (raw === '[DONE]') { done = true; break; }
                    try {
                        const parsed = JSON.parse(raw);
                        const delta = parsed?.content;
                        if (delta) {
                            setMessages(prev => prev.map(m =>
                                m.id === assistantId
                                    ? { ...m, content: m.content + delta }
                                    : m
                            ));
                        }
                    } catch { /* skip malformed chunk */ }
                }
            }

            setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, streaming: false } : m
            ));
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            console.error('[ChatWidget] Error:', err);
            setMessages(prev => prev.map(m =>
                m.id === assistantId
                    ? { ...m, content: `${isEn ? 'Sorry, a connection error occurred. Please try again or write to geral@apostoladodegarabandal.com.' : 'Desculpe, ocorreu um erro de ligação. Por favor tente novamente ou escreva para geral@apostoladodegarabandal.com.'}\n[[WHATSAPP]]`, streaming: false }
                    : m
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        sendMessage(input, 'typed');
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSend();
        }
    };

    // Inside the form the header CTA is absent and "start registration" is meaningless,
    // so the standing offer is human help — the thing people ask for when stuck.
    const persistentAction: ResolvedAction | null = isForm
        ? {
            key: 'WHATSAPP',
            label: isEn ? 'I need help — talk to us' : 'Preciso de ajuda — falar connosco',
            href: buildWhatsAppLink(pilgrimageTitle, undefined, isEn),
            external: true,
            icon: <WhatsAppIcon className="w-4 h-4" />,
        }
        : null;

    // Fire-and-forget capture of "Estou mesmo interessado em ir"; the anchor href opens WhatsApp.
    const handleInterestClick = () => {
        captureInterest({
            source: 'chat_interest',
            sessionId,
            pilgrimageId,
            pilgrimageTitle,
            locale: isEn ? 'en' : 'pt',
        });
    };

    // Turns the tokens the assistant emitted into real, tappable buttons. Telling
    // someone to "click the yellow button" fails on mobile, where the chat covers it.
    const resolveAction = (key: ChatAction): ResolvedAction | null => {
        const label = ACTION_LABELS[key][isEn ? 'en' : 'pt'];
        const registrationsHref = isEn ? '/en/my-registrations' : '/peregrinacoes/minhas-inscricoes';

        switch (key) {
            case 'INSCREVER':
                // Never offer "start registration" to someone already inside the form.
                if (!registrationLink || isForm) return null;
                return { key, label, href: registrationLink, icon: <ArrowRight className="w-4 h-4" />, primary: true };
            case 'LISTA_ESPERA':
                if (!registrationLink) return null;
                return { key, label, href: registrationLink, icon: <ClipboardList className="w-4 h-4" />, primary: true };
            case 'QUERO_IR':
                return {
                    key,
                    label,
                    href: buildInterestWhatsAppLink(pilgrimageTitle, isEn),
                    external: true,
                    icon: <WhatsAppIcon className="w-4 h-4" />,
                    primary: true,
                };
            case 'PAGAR':
                return { key, label, href: registrationsHref, icon: <CreditCard className="w-4 h-4" />, primary: true };
            case 'MINHAS_INSCRICOES':
                return { key, label, href: registrationsHref, icon: <ClipboardList className="w-4 h-4" /> };
            case 'VOOS':
                if (!pilgrimageSlug) return null;
                // The page shows flights in a modal, not at an anchor: the old "#voos"
                // link went nowhere. Close the chat so the modal is not hidden behind it.
                return {
                    key,
                    label,
                    href: `${isEn ? '/en/pilgrimages' : '/peregrinacoes'}/${pilgrimageSlug}`,
                    icon: <Plane className="w-4 h-4" />,
                    onSelect: onOpenFlights
                        ? () => { closeChat(); onOpenFlights(); }
                        : undefined,
                };
            case 'WHATSAPP':
                return {
                    key,
                    label,
                    href: buildWhatsAppLink(pilgrimageTitle, undefined, isEn),
                    external: true,
                    icon: <WhatsAppIcon className="w-4 h-4" />,
                };
            default:
                return null;
        }
    };

    const onActionClick = (key: ChatAction) => {
        captureAnalyticsEvent('chat_cta_clicked', {
            action: key,
            pilgrimage_slug: pilgrimageSlug,
            chat_context: context,
        });
        if (key === 'QUERO_IR') handleInterestClick();
    };

    // Handles **bold** plus markdown and bare links — the model pastes URLs (PDFs,
    // payment pages) often enough that raw "[text](url)" was showing up on screen.
    const renderInline = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
            }
            const md = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
            if (md) {
                return (
                    <a key={i} href={md[2]} target="_blank" rel="noopener noreferrer"
                       className="text-brand-700 font-semibold underline underline-offset-2 hover:text-brand break-words">
                        {md[1]}
                    </a>
                );
            }
            if (/^https?:\/\//.test(part)) {
                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer"
                       className="text-brand-700 font-semibold underline underline-offset-2 hover:text-brand break-all">
                        {part.replace(/^https?:\/\//, '').slice(0, 40)}{part.length > 48 ? '…' : ''}
                    </a>
                );
            }
            return <span key={i}>{part.replace(/\*\*/g, '')}</span>;
        });
    };

    // Lists used to show up as raw "- item" lines; headings the prompt forbids
    // still slip through now and then, so they degrade to a bold line.
    const renderContent = (text: string) => {
        type Block = { kind: 'p' | 'ul' | 'ol'; lines: string[] };
        const blocks: Block[] = [];
        for (const rawLine of text.split('\n')) {
            const line = rawLine.trim();
            if (!line) { blocks.push({ kind: 'p', lines: [] }); continue; }
            const bullet = line.match(/^[-•*]\s+(.*)$/);
            const ordered = line.match(/^\d+[.)]\s+(.*)$/);
            const kind: Block['kind'] = bullet ? 'ul' : ordered ? 'ol' : 'p';
            const content = bullet?.[1] ?? ordered?.[1] ?? line.replace(/^#{1,6}\s+(.*)$/, '**$1**');
            const last = blocks[blocks.length - 1];
            if (last && last.kind === kind && (kind !== 'p' || last.lines.length > 0)) last.lines.push(content);
            else blocks.push({ kind, lines: [content] });
        }
        return blocks.filter(b => b.lines.length > 0).map((block, i) => {
            if (block.kind === 'ul') {
                return (
                    <ul key={i} className="space-y-1 pl-1">
                        {block.lines.map((l, j) => (
                            <li key={j} className="flex gap-2"><span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" /><span>{renderInline(l)}</span></li>
                        ))}
                    </ul>
                );
            }
            if (block.kind === 'ol') {
                return (
                    <ol key={i} className="space-y-1">
                        {block.lines.map((l, j) => (
                            <li key={j} className="flex gap-2"><span className="shrink-0 font-semibold text-brand-700 tabular-nums">{j + 1}.</span><span>{renderInline(l)}</span></li>
                        ))}
                    </ol>
                );
            }
            return <p key={i}>{block.lines.map((l, j) => <span key={j}>{j > 0 && <br />}{renderInline(l)}</span>)}</p>;
        });
    };

    const lastMessage = messages[messages.length - 1];
    const lastParsed = lastMessage?.role === 'assistant' && !lastMessage.streaming
        ? parseChatActions(lastMessage.content)
        : null;
    // Before the first question: the curated starters. After each answer: whatever
    // the assistant proposed for this person, so the conversation never stalls.
    // Starters live inside the conversation, under the greeting: as a footer they
    // wrapped into three rows on desktop and hid the greeting itself.
    const starterChips = messages.length <= 1 && !isLoading ? (isForm ? CHIPS_FORM : CHIPS_PAGE) : [];
    // When the model forgets its suggestions, fall back to starters not yet asked.
    const askedQuestions = new Set(messages.filter(m => m.role === 'user').map(m => m.content.trim()));
    const fallbackChips = (isForm ? CHIPS_FORM : CHIPS_PAGE).filter(chip => !askedQuestions.has(chip)).slice(0, 3);
    const suggestionChips = !isLoading && !starterChips.length && lastParsed
        ? (lastParsed.suggestions.length ? lastParsed.suggestions : fallbackChips)
        : [];

    const urgent = isNovemberCampaign || (typeof remainingSpots === 'number' && remainingSpots <= 5);

    const panelMotion = reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : isMobile
            ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
            : { initial: { opacity: 0, y: 24, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.97 } };

    const nudgeText = isForm
        ? (isEn ? 'Need help with the form?' : 'Precisa de ajuda com o formulário?')
        : (isEn ? 'Questions about prices or flights? Ask me 🙏' : 'Dúvidas sobre valores ou voo? Pergunte-me 🙏');

    return (
        // The FAB sits above the sticky booking bar, whose height it reads from the
        // --sticky-bar-h variable the bar publishes. Pages without a bar (the
        // registration form) resolve to 0px and the FAB drops to a normal offset.
        <div className={`fixed right-4 bottom-[calc(var(--sticky-bar-h,0px)+1rem)] lg:bottom-8 lg:right-10 z-[2147483647] flex flex-col items-end pointer-events-none ${isForm ? 'registration-chat' : ''}`}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="chat-panel"
                        role="dialog"
                        aria-label={isEn ? 'Pilgrimage assistant' : 'Assistente da peregrinação'}
                        {...panelMotion}
                        transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }}
                        drag={isMobile && !reduceMotion ? 'y' : false}
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.7 }}
                        onDragEnd={(_e, info) => {
                            if (info.offset.y > 120 || info.velocity.y > 600) closeChat();
                        }}
                        style={isMobile && viewport ? { height: viewport.height, top: viewport.top } : undefined}
                        className="pointer-events-auto flex flex-col overflow-hidden bg-white shadow-[0_24px_64px_-12px_rgba(30,58,138,0.35)]
                            max-sm:fixed max-sm:inset-x-0 max-sm:top-0 max-sm:z-[2147483647] max-sm:h-[100dvh] max-sm:w-full
                            sm:mb-4 sm:w-[400px] sm:h-[600px] sm:max-h-[calc(100vh-130px)] sm:rounded-[28px] sm:border sm:border-brand-200/60 sm:origin-bottom-right"
                    >
                        {/* Header — the drag handle for swipe-to-close on phones. */}
                        <div
                            onPointerDown={(e) => { if (isMobile) dragControls.start(e); }}
                            className={`${BRAND_GRADIENT} relative shrink-0 px-4 pb-3.5 pt-3 max-sm:pt-[max(0.75rem,env(safe-area-inset-top))] text-white touch-none select-none`}
                        >
                            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/40 sm:hidden" aria-hidden />
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="relative shrink-0">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur">
                                            <Sparkles className="h-5 w-5 text-white" />
                                        </div>
                                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-brand bg-emerald-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="truncate text-[15px] font-semibold leading-tight">
                                            {isEn ? 'AI assistant' : 'Assistente IA'}
                                        </h3>
                                        {/* Says "AI" plainly: people took the bot for the team and for the registration itself. */}
                                        <p className="mt-0.5 truncate text-[12px] leading-tight text-white/80">
                                            {isEn ? 'Online · replies instantly' : 'Online · responde na hora'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <a
                                        href={buildWhatsAppLink(pilgrimageTitle, undefined, isEn)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => onActionClick('WHATSAPP')}
                                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 transition-colors hover:bg-white/25 active:scale-95"
                                        aria-label={isEn ? 'Talk to the team on WhatsApp' : 'Falar com a equipa no WhatsApp'}
                                        title={isEn ? 'Talk to the team on WhatsApp' : 'Falar com a equipa no WhatsApp'}
                                    >
                                        <WhatsAppIcon className="h-[18px] w-[18px]" />
                                    </a>
                                    <button
                                        onClick={closeChat}
                                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm transition-all hover:bg-brand-50 active:scale-95"
                                        aria-label={isEn ? 'Close chat' : 'Fechar chat'}
                                        title={isEn ? 'Close chat' : 'Fechar chat'}
                                    >
                                        <X className="h-5 w-5" strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Registration progress -- makes it visually obvious that the form,
                            not this conversation, is what completes the registration. */}
                        {formStepInfo && (
                            <div className="shrink-0 border-b border-slate-200/80 bg-brand-50/60 px-4 py-2.5">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700/80">
                                        {isEn ? 'Your registration' : 'A sua inscrição'}
                                    </span>
                                    <span className="text-[12px] font-semibold text-slate-600">
                                        {isEn ? 'Step' : 'Passo'} {formStepInfo.current}/{formStepInfo.total}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: formStepInfo.total }).map((_, i) => (
                                        <span
                                            key={i}
                                            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                                                i < formStepInfo.current ? 'bg-brand' : 'bg-slate-200'
                                            }`}
                                        />
                                    ))}
                                </div>
                                <p className="mt-1.5 text-[13px] leading-tight text-slate-600">
                                    <span className="font-semibold text-slate-900">{formStepInfo.label}</span>
                                    {formStepInfo.next
                                        ? <span className="text-slate-500"> → {formStepInfo.next}</span>
                                        : <span className="text-slate-500"> {isEn ? '→ press "Confirm Registration"' : '→ carregue em "Confirmar Inscrição"'}</span>}
                                </p>
                            </div>
                        )}

                        {/* Contextual CTA (vacancies + registration) -- only on pilgrimage page */}
                        {registrationLink && (
                            isWaitlist ? (
                                <div className="shrink-0 space-y-2 border-b border-amber-200/60 bg-amber-50 px-4 py-3">
                                    <div className="flex items-center gap-2 text-[13px] leading-snug text-amber-900">
                                        <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                                        <span>
                                            <span className="font-semibold">{isEn ? 'Limited selection' : 'Seleção limitada'}</span>
                                            <span className="text-amber-800/90"> {isEn ? '— only a few will be chosen' : '— só alguns serão escolhidos'}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <a
                                            href={buildInterestWhatsAppLink(pilgrimageTitle, isEn)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => onActionClick('QUERO_IR')}
                                            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#1fb858] active:scale-[0.98]"
                                        >
                                            <WhatsAppIcon className="h-4 w-4 shrink-0" />
                                            {isEn ? "I'm really interested" : 'Estou mesmo interessado'}
                                        </a>
                                        <Link href={registrationLink} className="shrink-0 text-[13px] font-semibold text-amber-900 underline underline-offset-2">
                                            {isEn ? 'Waiting list' : 'Lista de espera'}
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-2.5">
                                    <div className={`flex min-w-0 items-center gap-2 text-[13px] leading-tight ${urgent ? 'text-red-700' : 'text-slate-600'}`}>
                                        {urgent
                                            ? <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60 motion-reduce:hidden" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span>
                                            : <Users className="h-4 w-4 shrink-0 text-brand" />}
                                        <span className="truncate font-semibold">
                                            {urgent ? (isEn ? 'Last spots' : 'Últimas vagas') : (isEn ? 'Limited spots' : 'Vagas limitadas')}
                                        </span>
                                    </div>
                                    <Link
                                        href={registrationLink}
                                        onClick={() => onActionClick('INSCREVER')}
                                        className="btn-member min-h-10 shrink-0 gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white"
                                    >
                                        <span>{isEn ? 'Start Registration' : 'Iniciar Inscrição'}</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            )
                        )}

                        {/* Messages */}
                        <div
                            ref={scrollRef}
                            onScroll={onMessagesScroll}
                            className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,#f6f8fe_0%,#eef2fb_100%)] px-4 py-4"
                            aria-live="polite"
                        >
                            {messages.map((msg) => {
                                const { visibleText, actions } = msg.role === 'assistant'
                                    ? parseChatActions(msg.content)
                                    : { visibleText: msg.content, actions: [] as ChatAction[] };
                                const needsEscalation =
                                    msg.role === 'assistant' &&
                                    !msg.streaming &&
                                    ESCALATION_MARKERS.some(marker => msg.content.includes(marker)) &&
                                    !actions.includes('WHATSAPP');
                                const resolvedActions = msg.role === 'assistant' && !msg.streaming
                                    ? (actions.map(resolveAction).filter(Boolean) as ResolvedAction[])
                                        .sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)))
                                    : [];
                                const isUser = msg.role === 'user';
                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={settledIdsRef.current.has(msg.id) || reduceMotion ? false : { opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25, ease: 'easeOut' }}
                                        className="space-y-2"
                                    >
                                        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[86%] px-4 py-3 text-[15px] leading-relaxed ${
                                                isUser
                                                    ? 'rounded-[20px] rounded-br-md border border-brand-200/80 bg-brand-100/70 text-slate-900 whitespace-pre-wrap'
                                                    : 'space-y-2 rounded-[20px] rounded-bl-md border border-slate-200/70 bg-white text-slate-700 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.12)]'
                                            }`}>
                                                {isUser
                                                    ? msg.content
                                                    : visibleText
                                                        ? renderContent(visibleText)
                                                        : msg.streaming && (
                                                            <span className="flex h-5 items-center gap-1" aria-label={isEn ? 'Typing' : 'A escrever'}>
                                                                <span className="h-2 w-2 animate-bounce rounded-full bg-brand/60 [animation-delay:-0.3s]" />
                                                                <span className="h-2 w-2 animate-bounce rounded-full bg-brand/60 [animation-delay:-0.15s]" />
                                                                <span className="h-2 w-2 animate-bounce rounded-full bg-brand/60" />
                                                            </span>
                                                        )
                                                }
                                            </div>
                                        </div>
                                        {needsEscalation && (
                                            <div className="flex flex-wrap gap-2">
                                                <a
                                                    href={buildWhatsAppLink(pilgrimageTitle, undefined, isEn)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => onActionClick('WHATSAPP')}
                                                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1fb858] active:scale-[0.98]"
                                                >
                                                    <WhatsAppIcon className="h-4 w-4" />
                                                    {isEn ? 'Talk on WhatsApp' : 'Falar no WhatsApp'}
                                                </a>
                                                <a
                                                    href={`mailto:${CONTACT_EMAIL}`}
                                                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                                                >
                                                    <Mail className="h-4 w-4" />
                                                    {isEn ? 'Send email' : 'Enviar email'}
                                                </a>
                                            </div>
                                        )}
                                        {resolvedActions.length > 0 && (
                                            <motion.div
                                                initial={settledIdsRef.current.has(msg.id) || reduceMotion ? false : { opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3, delay: 0.1 }}
                                                className="max-w-[86%] space-y-1.5"
                                            >
                                                <div className="flex flex-wrap gap-2">
                                                    {resolvedActions.map(action => {
                                                        // Primary actions are full-width buttons, never pill-shaped like a
                                                        // chat bubble — people read the blue pill as a message, not a button.
                                                        const className = action.primary
                                                            ? (action.key === 'QUERO_IR' || action.key === 'WHATSAPP'
                                                                ? 'flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 text-[15px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(37,211,102,0.7)] transition-all hover:bg-[#1fb858] active:scale-[0.98]'
                                                                : 'btn-member min-h-12 w-full gap-2 rounded-2xl px-5 text-[15px] font-bold tracking-wide text-white active:scale-[0.98]')
                                                            : 'inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50';
                                                        const content = action.primary && action.key !== 'QUERO_IR'
                                                            ? <><span>{action.label}</span>{action.icon}</>
                                                            : <>{action.icon}{action.label}</>;
                                                        if (action.onSelect) {
                                                            return (
                                                                <button
                                                                    key={action.key}
                                                                    type="button"
                                                                    onClick={() => { onActionClick(action.key); action.onSelect?.(); }}
                                                                    className={className}
                                                                >
                                                                    {content}
                                                                </button>
                                                            );
                                                        }
                                                        return action.external ? (
                                                            <a
                                                                key={action.key}
                                                                href={action.href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={() => onActionClick(action.key)}
                                                                className={className}
                                                            >
                                                                {content}
                                                            </a>
                                                        ) : (
                                                            <Link
                                                                key={action.key}
                                                                href={action.href}
                                                                onClick={() => onActionClick(action.key)}
                                                                className={className}
                                                            >
                                                                {content}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                                {resolvedActions.some(a => a.key === 'QUERO_IR') && (
                                                    <p className="max-w-[280px] text-[12px] leading-snug text-slate-500">
                                                        {isEn
                                                            ? 'The Apostolate will select a limited number of people. Register now and talk on WhatsApp to be considered.'
                                                            : 'O Apostolado vai selecionar um número limitado de pessoas. Registe já e fale no WhatsApp para ser considerado(a).'}
                                                    </p>
                                                )}
                                            </motion.div>
                                        )}
                                    </motion.div>
                                );
                            })}

                            {starterChips.length > 0 && (
                                <motion.div
                                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: 0.15 }}
                                    className="pt-1"
                                >
                                    <p className="mb-2 text-[12px] font-semibold text-slate-500">
                                        {isEn ? 'Frequently asked' : 'Perguntas frequentes'}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {starterChips.map((chip) => (
                                            <button
                                                key={chip}
                                                onClick={() => sendMessage(chip, 'chip')}
                                                className="min-h-10 rounded-xl border border-brand-200 bg-white px-3.5 text-left text-[14px] font-medium text-brand-700 shadow-sm transition-all hover:border-brand hover:bg-brand-50 active:scale-[0.97]"
                                            >
                                                {chip}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Next questions the assistant proposed for this person. */}
                        <AnimatePresence initial={false}>
                            {suggestionChips.length > 0 && (
                                <motion.div
                                    key={lastMessage?.id ?? 'chips'}
                                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="shrink-0 border-t border-slate-100 bg-white pt-2.5"
                                >
                                    <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-0.5">
                                        {suggestionChips.map((chip) => (
                                            <button
                                                key={chip}
                                                onClick={() => sendMessage(chip, 'suggestion')}
                                                className="min-h-9 shrink-0 whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-3.5 text-[13px] font-medium text-brand-700 transition-all hover:border-brand hover:bg-white active:scale-[0.97]"
                                            >
                                                {chip}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Persistent next-step bar -- the CTA no longer depends on the
                            assistant remembering to emit a token. */}
                        {persistentAction && (
                            <div className="shrink-0 bg-white px-3 pt-2.5">
                                <a
                                    href={persistentAction.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => onActionClick(persistentAction.key)}
                                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#1fb858] active:scale-[0.99]"
                                >
                                    {persistentAction.icon}{persistentAction.label}
                                </a>
                            </div>
                        )}

                        {/* Input -- 16px text so iOS does not zoom the page on focus. */}
                        <div className="shrink-0 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
                            <form onSubmit={handleSend} className="flex items-end gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-1.5 pl-4 transition-all focus-within:border-brand focus-within:bg-white focus-within:ring-4 focus-within:ring-brand/10">
                                <textarea
                                    ref={inputRef}
                                    rows={1}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={onInputKeyDown}
                                    // Not in this React version's textarea typings, but supported by mobile keyboards.
                                    {...({ enterKeyHint: 'send' } as Record<string, string>)}
                                    placeholder={isEn ? 'Type your question…' : 'Escreva a sua dúvida…'}
                                    aria-label={isEn ? 'Your question' : 'A sua dúvida'}
                                    className="max-h-[120px] flex-1 resize-none bg-transparent py-2 text-base leading-6 text-slate-900 outline-none placeholder:text-slate-400"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className={`${BRAND_GRADIENT} flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-all hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:shadow-none`}
                                    aria-label={isEn ? 'Send' : 'Enviar'}
                                >
                                    <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                                </button>
                            </form>
                            <p className="mt-2 text-center text-[11px] leading-tight text-slate-400">
                                {isEn ? 'AI can make mistakes · official confirmation: ' : 'A IA pode errar · confirmação oficial: '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:text-slate-600">{CONTACT_EMAIL}</a>
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB — hidden on phones while the sheet is open, since the sheet has
                its own close button and the floating one would sit on top of it. */}
            <div className={`relative pointer-events-auto items-center gap-3 ${hideLauncher && !isOpen ? 'hidden' : isOpen ? 'hidden sm:flex' : 'flex'}`}>
                <AnimatePresence>
                    {!isOpen && showNudge && (
                        <motion.button
                            key="nudge"
                            type="button"
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            onClick={() => openChat('nudge')}
                            className="relative max-w-[230px] rounded-2xl border border-brand-200/70 bg-white px-4 py-2.5 text-left text-[14px] font-semibold leading-snug text-slate-800 shadow-[0_10px_30px_-8px_rgba(30,58,138,0.35)]"
                        >
                            {nudgeText}
                            <span className="absolute right-[-6px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-brand-200/70 bg-white" />
                        </motion.button>
                    )}
                </AnimatePresence>
                <motion.button
                    onClick={() => (isOpen ? closeChat() : openChat('fab'))}
                    aria-label={isOpen ? (isEn ? 'Close chat' : 'Fechar chat') : (isEn ? 'Open chat' : 'Abrir chat')}
                    aria-expanded={isOpen}
                    whileHover={reduceMotion ? undefined : { scale: 1.06, y: -2 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                    className={`relative h-14 w-14 rounded-full text-white sm:h-[60px] sm:w-[60px] ${isOpen ? 'flex items-center justify-center bg-slate-900 shadow-lg' : 'btn-member'}`}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={isOpen ? 'close' : 'open'}
                            initial={reduceMotion ? false : { rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="flex items-center justify-center"
                        >
                            {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-7 w-7" />}
                        </motion.span>
                    </AnimatePresence>
                    {!isOpen && showNudge && (
                        <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500" />
                    )}
                </motion.button>
            </div>
        </div>
    );
}
