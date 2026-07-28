"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send, Bot, User, Sparkles, Phone, Users, ArrowRight, CreditCard, Plane, ClipboardList, Check } from 'lucide-react';
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
};

// Keyed by pilgrimage slug so different peregrinações keep separate sessions.
const storageKey = (slug?: string) => `chat:session:${slug || 'generic'}`;
const messagesKey = (slug?: string) => `chat:messages:${slug || 'generic'}`;

const CHIPS_PAGE_PT = [
    'Como me inscrevo?',
    'Quanto custa?',
    'Posso pagar em prestações?',
    'O voo está incluído?',
    'Que documentos preciso?',
    'E se tiver de cancelar?',
];
const CHIPS_PAGE_EN = [
    'How do I register?',
    'How much does it cost?',
    'Can I pay in installments?',
    'Is the flight included?',
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

type ResolvedAction = {
    key: ChatAction;
    label: string;
    href: string;
    external?: boolean;
    icon: React.ReactNode;
    /** Primary actions get the yellow treatment; the rest stay quiet. */
    primary?: boolean;
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
}: Props) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const CHIPS_PAGE = isWaitlist
        ? (isEn ? CHIPS_WAITLIST_EN : CHIPS_WAITLIST_PT)
        : (isEn ? CHIPS_PAGE_EN : CHIPS_PAGE_PT);
    const CHIPS_FORM = isEn ? CHIPS_FORM_EN : CHIPS_FORM_PT;
    const [isOpen, setIsOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(true);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const sessionId = useSessionId(pilgrimageSlug);
    const isNovemberCampaign = isNovemberCampaignPilgrimage({
        slug: pilgrimageSlug,
        title: pilgrimageTitle,
    });

    const leadCapturedKey = `chat:lead:${pilgrimageSlug || 'generic'}`;
    const [leadCaptured, setLeadCaptured] = useState(() =>
        typeof window !== 'undefined' && window.sessionStorage.getItem(leadCapturedKey) === '1'
    );
    const [leadEmail, setLeadEmail] = useState('');
    const [leadSubmitting, setLeadSubmitting] = useState(false);
    const [leadDone, setLeadDone] = useState(leadCaptured);

    const initialGreeting = useMemo<Message>(() => ({
        id: 'greeting',
        role: 'assistant',
        content: context === 'registration-form'
            // Says out loud that the chat does not register anyone — people have finished
            // a whole conversation here believing they had signed up.
            ? (isEn
                ? `Hello! 🙏 I'm here to help while you complete the registration for **${pilgrimageTitle || 'this pilgrimage'}**.\n\nJust so it's clear: **the registration is completed on the form behind this window, not here in the chat.** I'm only here to help you through it. Ask me anything about rooms, documents, payments, flights or the next step.`
                : `Olá! 🙏 Estou aqui para ajudar enquanto você faz a inscrição da **${pilgrimageTitle || 'peregrinação'}**.\n\nSó para ficar claro: **a inscrição conclui-se no formulário atrás desta janela, não aqui no chat.** Eu só ajudo você a avançar. Pode me perguntar sobre quartos, documentos, pagamentos, voo ou o próximo passo.`)
            : pilgrimageTitle
                ? (isEn
                    ? `Hello! 🙏 I'm the Apostolate of Garabandal assistant. I can help you understand the **${pilgrimageTitle}** - the spiritual experience, itinerary, prices, flights, payments, and whether this pilgrimage is the right step for you. What would you like to know first?`
                    : `Olá! 🙏 Sou o assistente do Apostolado de Garabandal. Posso ajudar você a entender a **${pilgrimageTitle}** - a experiência espiritual, itinerário, valores, voo, pagamentos e se esta peregrinação faz sentido para você. O que você gostaria de saber primeiro?`)
                : (isEn
                    ? 'Hello! 🙏 I am the Apostolate of Garabandal assistant. I can help you understand the pilgrimage and the next step with calm and clarity. What would you like to know first?'
                    : 'Olá! 🙏 Sou o assistente do Apostolado de Garabandal. Posso ajudar você a entender a peregrinação e o próximo passo com calma e clareza. O que você gostaria de saber primeiro?'),
    }), [pilgrimageTitle, context, isEn]);

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
        if (context !== 'registration-form' || !currentStep || !stepLabels?.length) return undefined;
        return {
            current: currentStep,
            total: stepLabels.length,
            label: stepLabels[currentStep - 1],
            next: stepLabels[currentStep],
        };
    }, [context, currentStep, stepLabels]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => { scrollToBottom(); }, [messages, isOpen]);

    useEffect(() => {
        const timer = setTimeout(() => setShowTooltip(false), 6000);
        return () => clearTimeout(timer);
    }, []);

    // On phones the chat is a full-screen sheet, so the sticky booking bar has to
    // step aside and the page behind must stop scrolling. Both are driven by this
    // class (see globals.css) because the bar renders through its own portal.
    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.classList.toggle('chat-open', isOpen);
        return () => document.body.classList.remove('chat-open');
    }, [isOpen]);

    const toggleChat = () => {
        setIsOpen(v => !v);
        setShowTooltip(false);
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: text.trim() };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setIsLoading(true);

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
                const content = data?.content || (isEn ? 'Sorry, an unexpected error occurred. Please try again or write to geral@apostoladodegarabandal.com.' : 'Desculpe, ocorreu um erro inesperado. Por favor tente novamente ou escreva para geral@apostoladodegarabandal.com.');
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
                    ? { ...m, content: (isEn ? 'Sorry, a connection error occurred. Please try again or write to geral@apostoladodegarabandal.com.' : 'Desculpe, ocorreu um erro de ligação. Por favor tente novamente ou escreva para geral@apostoladodegarabandal.com.'), streaming: false }
                    : m
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        sendMessage(input);
    };

    // 68% of conversations never reached a 2nd user message, so the old threshold meant
    // the lead card was almost never seen. One message is enough intent.
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const showLeadCapture = context === 'pilgrimage-page' && userMessageCount >= 1 && !isLoading && !leadDone;

    // Inside the form the header CTA is absent and "start registration" is meaningless,
    // so the standing offer is human help — the thing people ask for when stuck.
    const persistentAction: ResolvedAction | null = context === 'registration-form'
        ? {
            key: 'WHATSAPP',
            label: isEn ? 'I need help — talk to us' : 'Preciso de ajuda — falar connosco',
            href: buildWhatsAppLink(pilgrimageTitle, undefined, isEn),
            external: true,
            icon: <WhatsAppIcon className="w-3.5 h-3.5" />,
        }
        : null;

    const submitLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leadEmail.trim() || leadSubmitting) return;
        setLeadSubmitting(true);
        try {
            await fetch('/api/leads/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: leadEmail.trim(),
                    type: 'chat_lead',
                    channel_preference: 'email',
                    step: 'chat_interest',
                    data: { pilgrimageTitle, sessionId },
                }),
            });
        } catch { /* non-critical */ } finally {
            setLeadSubmitting(false);
            setLeadDone(true);
            setLeadCaptured(true);
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(leadCapturedKey, '1');
            }
        }
    };

    const showChips = messages.length <= 1 && !isLoading;

    // Fire-and-forget capture of "Estou mesmo interessado em ir"; the anchor href opens WhatsApp.
    const handleInterestClick = () => {
        captureInterest({
            source: 'chat_interest',
            sessionId,
            pilgrimageId,
            pilgrimageTitle,
            email: leadCaptured && leadEmail ? leadEmail : undefined,
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
                if (!registrationLink || context === 'registration-form') return null;
                return { key, label, href: registrationLink, icon: <ArrowRight className="w-3.5 h-3.5" />, primary: true };
            case 'LISTA_ESPERA':
                if (!registrationLink) return null;
                return { key, label, href: registrationLink, icon: <ClipboardList className="w-3.5 h-3.5" />, primary: true };
            case 'QUERO_IR':
                return {
                    key,
                    label,
                    href: buildInterestWhatsAppLink(pilgrimageTitle, isEn),
                    external: true,
                    icon: <WhatsAppIcon className="w-3.5 h-3.5" />,
                    primary: true,
                };
            case 'PAGAR':
                return { key, label, href: registrationsHref, icon: <CreditCard className="w-3.5 h-3.5" />, primary: true };
            case 'MINHAS_INSCRICOES':
                return { key, label, href: registrationsHref, icon: <ClipboardList className="w-3.5 h-3.5" /> };
            case 'VOOS':
                if (!pilgrimageSlug) return null;
                return {
                    key,
                    label,
                    href: `${isEn ? '/en/pilgrimages' : '/peregrinacoes'}/${pilgrimageSlug}#voos`,
                    icon: <Plane className="w-3.5 h-3.5" />,
                };
            case 'WHATSAPP':
                return {
                    key,
                    label,
                    href: buildWhatsAppLink(pilgrimageTitle, undefined, isEn),
                    external: true,
                    icon: <WhatsAppIcon className="w-3.5 h-3.5" />,
                };
            case 'CONTACTO':
                return null; // Rendered as the inline form below, not as a link.
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
    const renderContent = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            const md = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
            if (md) {
                return (
                    <a key={i} href={md[2]} target="_blank" rel="noopener noreferrer"
                       className="text-yellow-700 font-semibold underline underline-offset-2 hover:text-yellow-800 break-words">
                        {md[1]}
                    </a>
                );
            }
            if (/^https?:\/\//.test(part)) {
                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer"
                       className="text-yellow-700 font-semibold underline underline-offset-2 hover:text-yellow-800 break-all">
                        {part.replace(/^https?:\/\//, '').slice(0, 40)}{part.length > 48 ? '…' : ''}
                    </a>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        // The FAB sits above the sticky booking bar, whose height it reads from the
        // --sticky-bar-h variable the bar publishes. Pages without a bar (the
        // registration form) resolve to 0px and the FAB drops to a normal offset.
        <div className="fixed right-4 bottom-[calc(var(--sticky-bar-h,0px)+1rem)] lg:bottom-8 lg:right-12 z-[2147483647] flex flex-col items-end pointer-events-none">
            {isOpen && (
                <div className="pointer-events-auto flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl shadow-[0_30px_60px_rgba(0,0,0,0.15)] animate-in fade-in
                    max-sm:fixed max-sm:inset-0 max-sm:z-[2147483647] max-sm:h-[100dvh] max-sm:w-full max-sm:rounded-none max-sm:slide-in-from-bottom-4 max-sm:duration-200
                    sm:mb-4 sm:w-[380px] sm:h-[540px] sm:max-h-[calc(100vh-140px)] sm:rounded-3xl sm:border sm:border-white/50 sm:slide-in-from-bottom-10 sm:duration-300 sm:origin-bottom-right">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-4 max-sm:pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between text-slate-900 shadow-sm relative z-10 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
                                    <Bot className="w-6 h-6 text-yellow-600" />
                                </div>
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-yellow-400 rounded-full"></span>
                            </div>
                            <div>
                                <h3 className="font-bold text-sm leading-tight">{isEn ? 'Apostolate of Garabandal Assistant' : 'Assistente Apostolado de Garabandal'}</h3>
                                <p className="text-[11px] text-yellow-900 font-medium opacity-80">
                                    {pilgrimageTitle ? (isEn ? 'About this pilgrimage' : 'Sobre esta peregrinação') : (isEn ? 'Always online' : 'Sempre online')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <a
                                href={buildWhatsAppLink(pilgrimageTitle, undefined, isEn)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-yellow-600/50 rounded-full transition-colors"
                                aria-label={isEn ? 'Talk on WhatsApp' : 'Falar no WhatsApp'}
                                title={isEn ? 'Talk on WhatsApp' : 'Falar no WhatsApp'}
                            >
                                <Phone className="w-4 h-4" />
                            </a>
                            <button onClick={toggleChat} className="p-2 hover:bg-yellow-600/50 rounded-full transition-colors" aria-label={isEn ? 'Close chat' : 'Fechar chat'}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Registration progress -- makes it visually obvious that the form,
                        not this conversation, is what completes the registration. */}
                    {formStepInfo && (
                        <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                                    {isEn ? 'Your registration' : 'A sua inscrição'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">
                                    {isEn ? 'Step' : 'Passo'} {formStepInfo.current}/{formStepInfo.total}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: formStepInfo.total }).map((_, i) => (
                                    <span
                                        key={i}
                                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                                            i < formStepInfo.current ? 'bg-yellow-400' : 'bg-slate-200'
                                        }`}
                                    />
                                ))}
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1.5 leading-tight">
                                <span className="font-bold text-slate-800">{formStepInfo.label}</span>
                                {formStepInfo.next
                                    ? <span className="text-slate-400"> → {formStepInfo.next}</span>
                                    : <span className="text-slate-400"> {isEn ? '→ press "Confirm Registration"' : '→ carregue em "Confirmar Inscrição"'}</span>}
                            </p>
                        </div>
                    )}

                    {/* Contextual CTA (vacancies + Reservar) -- only on pilgrimage page */}
                    {registrationLink && (
                        isWaitlist ? (
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/60 px-4 py-3 shadow-sm space-y-2">
                                <div className="flex items-center gap-2 text-[11px] md:text-xs text-amber-800 leading-snug">
                                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                    <span>
                                        <span className="font-bold">{isEn ? 'Limited selection' : 'Seleção limitada'}</span>
                                        <span className="text-amber-700/90"> {isEn ? '— only a few will be chosen to go' : '— só alguns serão escolhidos para ir'}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={buildInterestWhatsAppLink(pilgrimageTitle, isEn)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={handleInterestClick}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] md:text-xs font-black bg-[#25D366] hover:bg-[#1fb858] text-white px-3 py-2 rounded-xl shadow-sm hover:shadow-md transition-all text-center"
                                    >
                                        <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
                                        {isEn ? "I'm really interested" : 'Estou mesmo interessado'}
                                    </a>
                                    <Link href={registrationLink} className="inline-flex items-center gap-1 text-[11px] md:text-xs font-bold text-amber-900/80 hover:text-amber-900 underline underline-offset-2 shrink-0">
                                        {isEn ? 'Waiting list' : 'Lista de espera'}
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className={`border-b px-4 py-3 flex items-center justify-between gap-3 shadow-sm ${
                                isNovemberCampaign || (typeof remainingSpots === 'number' && remainingSpots <= 5)
                                    ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200/60'
                                    : 'bg-gradient-to-r from-yellow-50/80 to-amber-50/80 border-yellow-200/60'
                            }`}>
                                <div className={`flex items-center gap-2 text-[11px] md:text-xs leading-tight ${
                                    isNovemberCampaign || (typeof remainingSpots === 'number' && remainingSpots <= 5) ? 'text-red-800' : 'text-slate-700'
                                }`}>
                                    <Users className="w-3.5 h-3.5 shrink-0" />
                                    {isNovemberCampaign ? (
                                        <span><span className="font-bold">{isEn ? 'Last spots' : 'Últimas vagas'}</span><span className="hidden sm:inline"> {isEn ? '— sign up now' : '— inscreva-se já'}</span></span>
                                    ) : typeof remainingSpots === 'number' && remainingSpots <= 5 ? (
                                        <span><span className="font-bold">{isEn ? 'Last spots' : 'Últimas vagas'}</span><span className="hidden sm:inline"> {isEn ? '— sign up now' : '— inscreva-se já'}</span></span>
                                    ) : (
                                        <span><span className="font-bold text-slate-900">{isEn ? 'Limited Spots' : 'Vagas limitadas'}</span><span className="hidden sm:inline text-slate-600"> {isEn ? '— places still available' : '— lugares a preencher'}</span></span>
                                    )}
                                </div>
                                <Link
                                    href={registrationLink}
                                    className="inline-flex items-center gap-1.5 text-[11px] md:text-xs font-black bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-900 px-3 py-1.5 md:py-2 rounded-xl shadow-[0_2px_10px_rgba(245,158,11,0.2)] hover:shadow-[0_4px_15px_rgba(245,158,11,0.3)] transition-all shrink-0"
                                >
                                    {isEn ? 'Start Registration' : 'Iniciar Inscrição'} <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        )
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-4">
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
                                ? actions.map(resolveAction).filter(Boolean) as ResolvedAction[]
                                : [];
                            const showContactForm =
                                msg.role === 'assistant' && !msg.streaming && actions.includes('CONTACTO');
                            return (
                                <div key={msg.id} className="space-y-2">
                                    <div className={`flex gap-2 max-w-[88%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-auto shadow-sm ${msg.role === 'user' ? 'bg-yellow-500' : 'bg-white border border-slate-100'}`}>
                                            {msg.role === 'user' ? <User className="w-4 h-4 text-slate-900" /> : <Bot className="w-4 h-4 text-slate-600" />}
                                        </div>
                                        <div className={`p-3.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${
                                            msg.role === 'user'
                                                ? 'bg-yellow-500 text-slate-900 rounded-2xl rounded-br-sm'
                                                : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-bl-sm'
                                        }`}>
                                            {visibleText
                                                ? renderContent(visibleText)
                                                : msg.streaming && (
                                                    <span className="inline-flex gap-1 items-center h-4">
                                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                                                    </span>
                                                )
                                            }
                                            {msg.streaming && msg.content && (
                                                <span className="inline-block w-0.5 h-3.5 bg-slate-400 animate-pulse ml-0.5 align-middle" />
                                            )}
                                        </div>
                                    </div>
                                    {needsEscalation && (
                                        <div className="ml-9 flex flex-wrap gap-2">
                                            <a
                                                href={buildWhatsAppLink(pilgrimageTitle, undefined, isEn)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#25D366] hover:bg-[#1fb858] text-white px-3 py-2 rounded-full shadow-sm transition-colors"
                                            >
                                                <Phone className="w-3.5 h-3.5" />
                                                {isEn ? 'Talk on WhatsApp' : 'Falar no WhatsApp'}
                                            </a>
                                            <a
                                                href={`mailto:${CONTACT_EMAIL}`}
                                                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded-full shadow-sm transition-colors"
                                            >
                                                {isEn ? 'Send email' : 'Enviar email'}
                                            </a>
                                        </div>
                                    )}
                                    {resolvedActions.length > 0 && (
                                        <div className="ml-9 space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex flex-wrap gap-2">
                                                {resolvedActions.map(action => {
                                                    const className = action.primary
                                                        ? `inline-flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all ${
                                                            action.key === 'QUERO_IR' || action.key === 'WHATSAPP'
                                                                ? 'bg-[#25D366] hover:bg-[#1fb858] text-white'
                                                                : 'bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-900'
                                                        }`
                                                        : 'inline-flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded-full shadow-sm transition-colors';
                                                    return action.external ? (
                                                        <a
                                                            key={action.key}
                                                            href={action.href}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={() => onActionClick(action.key)}
                                                            className={className}
                                                        >
                                                            {action.icon}{action.label}
                                                        </a>
                                                    ) : (
                                                        <Link
                                                            key={action.key}
                                                            href={action.href}
                                                            onClick={() => onActionClick(action.key)}
                                                            className={className}
                                                        >
                                                            {action.icon}{action.label}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                            {resolvedActions.some(a => a.key === 'QUERO_IR') && (
                                                <p className="text-[10px] text-slate-400 leading-tight max-w-[250px]">
                                                    {isEn
                                                        ? 'The Apostolate will select a limited number of people. Register now and talk on WhatsApp to be considered.'
                                                        : 'O Apostolado vai selecionar um número limitado de pessoas. Registe já e fale no WhatsApp para ser considerado(a).'}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {showContactForm && !leadDone && (
                                        <div className="ml-9">
                                            <form onSubmit={submitLead} className="flex gap-2 max-w-[280px]">
                                                <input
                                                    type="email"
                                                    value={leadEmail}
                                                    onChange={e => setLeadEmail(e.target.value)}
                                                    placeholder={isEn ? 'your@email.com' : 'o-seu@email.com'}
                                                    required
                                                    className="flex-1 min-w-0 text-xs bg-white border border-yellow-300 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 rounded-lg px-3 py-2 outline-none"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={leadSubmitting || !leadEmail.trim()}
                                                    className="shrink-0 text-xs font-bold bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-slate-900 px-3 py-2 rounded-lg transition-colors"
                                                >
                                                    {leadSubmitting ? '...' : (isEn ? 'Send' : 'Enviar')}
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                    {showContactForm && leadDone && (
                                        <p className="ml-9 text-xs text-green-700 font-semibold inline-flex items-center gap-1.5">
                                            <Check className="w-3.5 h-3.5" />
                                            {isEn ? 'Thank you! We will be in touch shortly.' : 'Obrigado! Entraremos em contacto brevemente.'}
                                        </p>
                                    )}
                                </div>
                            );
                        })}

                        {showChips && (
                            <div className="pt-2">
                                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">
                                    <Sparkles className="w-3 h-3" />
                                    {isEn ? 'Quick questions' : 'Perguntas rápidas'}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(context === 'registration-form' ? CHIPS_FORM : CHIPS_PAGE).map((chip: string) => (
                                        <button
                                            key={chip}
                                            onClick={() => sendMessage(chip)}
                                            className="text-xs bg-white hover:bg-yellow-50 text-slate-700 border border-slate-200 hover:border-yellow-300 px-3 py-1.5 rounded-full shadow-sm transition-colors"
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Inline lead capture — appears after 2nd user message, once per session */}
                        {showLeadCapture && (
                            <div className="flex gap-2 max-w-[88%]">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-auto shadow-sm bg-white border border-slate-100">
                                    <Bot className="w-4 h-4 text-slate-600" />
                                </div>
                                <div className="bg-white border border-yellow-200 rounded-2xl rounded-bl-sm p-3.5 shadow-sm flex-1">
                                    {leadDone ? (
                                        <p className="text-sm text-green-700 font-semibold">{isEn ? '✓ Thank you! We will be in touch shortly. 🙏' : '✓ Obrigado! Entraremos em contacto brevemente. 🙏'}</p>
                                    ) : (
                                        <>
                                            <p className="text-sm text-slate-700 mb-3">
                                                {isEn ? <>Would you like to receive the <strong>itinerary and detailed information</strong> about this pilgrimage by email?</> : <>Quer receber o <strong>itinerário e informações detalhadas</strong> desta peregrinação por email?</>}
                                            </p>
                                            <form onSubmit={submitLead} className="flex gap-2">
                                                <input
                                                    type="email"
                                                    value={leadEmail}
                                                    onChange={e => setLeadEmail(e.target.value)}
                                                    placeholder={isEn ? 'your@email.com' : 'o-seu@email.com'}
                                                    required
                                                    className="flex-1 min-w-0 text-xs bg-slate-50 border border-slate-200 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 rounded-lg px-3 py-2 outline-none"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={leadSubmitting || !leadEmail.trim()}
                                                    className="shrink-0 text-xs font-bold bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-slate-900 px-3 py-2 rounded-lg transition-colors"
                                                >
                                                    {leadSubmitting ? '...' : (isEn ? 'Send' : 'Enviar')}
                                                </button>
                                            </form>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Persistent next-step bar -- the CTA no longer depends on the
                        assistant remembering to emit a token. */}
                    {persistentAction && (
                        <div className="px-3 pt-2.5 bg-white border-t border-slate-100">
                            <a
                                href={persistentAction.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => onActionClick(persistentAction.key)}
                                className="flex items-center justify-center gap-2 w-full text-xs font-black bg-[#25D366] hover:bg-[#1fb858] text-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all"
                            >
                                {persistentAction.icon}{persistentAction.label}
                            </a>
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-3 bg-white border-t border-slate-100 shrink-0">
                        <form onSubmit={handleSend} className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={isEn ? 'Type your question...' : 'Escreva a sua dúvida...'}
                                disabled={isLoading}
                                className="flex-1 bg-slate-100/80 border border-slate-200 focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400/20 text-sm rounded-full px-5 py-3 transition-all outline-none disabled:opacity-60"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed w-11 h-11 rounded-full shadow-md transition-all flex items-center justify-center shrink-0 group"
                                aria-label={isEn ? 'Send' : 'Enviar'}
                            >
                                <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </button>
                        </form>
                    </div>
                    <div className="bg-slate-50/80 text-[9px] text-slate-400 text-center py-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-slate-100 shrink-0">
                        {isEn ? 'Apostolate AI • For official confirmation: ' : 'IA do Apostolado • Para confirmação oficial: '}geral@apostoladodegarabandal.com
                    </div>
                </div>
            )}

            {/* FAB — hidden on phones while the sheet is open, since the sheet has
                its own close button and the floating one would sit on top of it. */}
            <div className={`relative pointer-events-auto items-center gap-4 ${isOpen ? 'hidden sm:flex' : 'flex'}`}>
                {!isOpen && showTooltip && (
                    <div className="hidden sm:flex items-center bg-white px-4 py-2.5 rounded-2xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-right-5 duration-500 cursor-pointer" onClick={toggleChat}>
                        <span className="text-sm font-bold text-slate-700">{isEn ? 'Got questions? Ask the AI 🙏' : 'Tem dúvidas? Pergunte à IA 🙏'}</span>
                        <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-r border-t border-slate-100 transform rotate-45"></div>
                    </div>
                )}
                <button
                    onClick={toggleChat}
                    aria-label={isOpen ? (isEn ? 'Close chat' : 'Fechar chat') : (isEn ? 'Open chat' : 'Abrir chat')}
                    className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] transition-all duration-300 ${
                        isOpen
                            ? 'bg-slate-900 text-white hover:bg-slate-800 rotate-90 scale-90'
                            : 'bg-gradient-to-tr from-yellow-500 to-yellow-400 text-slate-900 hover:scale-110 hover:shadow-[0_15px_50px_rgba(234,179,8,0.4)]'
                    }`}
                >
                    {isOpen ? <X className="w-7 h-7" /> : <MessageCircle className="w-8 h-8" />}
                    {!isOpen && (
                        <span className="absolute top-0 right-0 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
}
