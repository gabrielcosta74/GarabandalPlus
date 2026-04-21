"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    streaming?: boolean;
};

type Props = {
    pilgrimageSlug?: string;
    pilgrimageTitle?: string;
};

const DEFAULT_CHIPS = [
    'Como me inscrevo?',
    'Quanto custa?',
    'Posso pagar em prestações?',
    'O voo está incluído?',
    'Que documentos preciso?',
    'E se tiver de cancelar?',
];

function useSessionId() {
    const ref = useRef<string>('');
    if (!ref.current) {
        ref.current = typeof crypto !== 'undefined'
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
    }
    return ref.current;
}

export default function ChatWidget({ pilgrimageSlug, pilgrimageTitle }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(true);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const sessionId = useSessionId();

    const initialGreeting = useMemo<Message>(() => ({
        id: 'greeting',
        role: 'assistant',
        content: pilgrimageTitle
            ? `Olá! 🙏 Sou o assistente do Apostolado de Garabandal. Estou aqui para ajudar com todas as suas dúvidas sobre a **${pilgrimageTitle}** — inscrição, preços, itinerário, pagamentos. Como posso ajudar?`
            : 'Olá! 🙏 Sou o assistente do Apostolado de Garabandal. Como posso ajudar com a sua peregrinação?',
    }), [pilgrimageTitle]);

    const [messages, setMessages] = useState<Message[]>([initialGreeting]);

    useEffect(() => {
        setMessages(prev => prev.length <= 1 ? [initialGreeting] : prev);
    }, [initialGreeting]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => { scrollToBottom(); }, [messages, isOpen]);

    useEffect(() => {
        const timer = setTimeout(() => setShowTooltip(false), 6000);
        return () => clearTimeout(timer);
    }, []);

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
                }),
            });

            if (!response.body) throw new Error('No response body');

            const contentType = response.headers.get('content-type') || '';

            // Fallback: API returned JSON (error case) — show content directly
            if (contentType.includes('application/json')) {
                const data = await response.json().catch(() => ({}));
                const content = data?.content || 'Desculpe, ocorreu um erro inesperado. Por favor tente novamente ou escreva para apoio@garabandalplus.com.';
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
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
            console.error('[ChatWidget] Error:', err);
            setMessages(prev => prev.map(m =>
                m.id === assistantId
                    ? { ...m, content: 'Desculpe, ocorreu um erro de ligação. Por favor tente novamente ou escreva para apoio@garabandalplus.com.', streaming: false }
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

    const showChips = messages.length <= 1 && !isLoading;

    const renderContent = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : <span key={i}>{part}</span>
        );
    };

    return (
        <div className="fixed bottom-32 right-4 md:bottom-8 md:right-12 z-[2147483647] flex flex-col items-end pointer-events-none">
            {isOpen && (
                <div className="mb-4 w-[calc(100vw-32px)] sm:w-[380px] h-[540px] max-h-[calc(100vh-140px)] bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.15)] border border-white/50 flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-300 origin-bottom-right">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-4 flex items-center justify-between text-slate-900 shadow-sm relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
                                    <Bot className="w-6 h-6 text-yellow-600" />
                                </div>
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-yellow-400 rounded-full"></span>
                            </div>
                            <div>
                                <h3 className="font-bold text-sm leading-tight">Assistente Apostolado de Garabandal</h3>
                                <p className="text-[11px] text-yellow-900 font-medium opacity-80">
                                    {pilgrimageTitle ? 'Sobre esta peregrinação' : 'Sempre online'}
                                </p>
                            </div>
                        </div>
                        <button onClick={toggleChat} className="p-2 hover:bg-yellow-600/50 rounded-full transition-colors" aria-label="Fechar chat">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-4">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-2 max-w-[88%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-auto shadow-sm ${msg.role === 'user' ? 'bg-yellow-500' : 'bg-white border border-slate-100'}`}>
                                    {msg.role === 'user' ? <User className="w-4 h-4 text-slate-900" /> : <Bot className="w-4 h-4 text-slate-600" />}
                                </div>
                                <div className={`p-3.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${
                                    msg.role === 'user'
                                        ? 'bg-yellow-500 text-slate-900 rounded-2xl rounded-br-sm'
                                        : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-bl-sm'
                                }`}>
                                    {msg.content
                                        ? renderContent(msg.content)
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
                        ))}

                        {showChips && (
                            <div className="pt-2">
                                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">
                                    <Sparkles className="w-3 h-3" />
                                    Perguntas rápidas
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {DEFAULT_CHIPS.map((chip) => (
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

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-white border-t border-slate-100">
                        <form onSubmit={handleSend} className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Escreva a sua dúvida..."
                                disabled={isLoading}
                                className="flex-1 bg-slate-100/80 border border-slate-200 focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400/20 text-sm rounded-full px-5 py-3 transition-all outline-none disabled:opacity-60"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed w-11 h-11 rounded-full shadow-md transition-all flex items-center justify-center shrink-0 group"
                                aria-label="Enviar"
                            >
                                <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </button>
                        </form>
                    </div>
                    <div className="bg-slate-50/80 text-[9px] text-slate-400 text-center py-2 border-t border-slate-100">
                        IA do Apostolado • Para confirmação oficial: apoio@garabandalplus.com
                    </div>
                </div>
            )}

            {/* FAB */}
            <div className="relative pointer-events-auto flex items-center gap-4">
                {!isOpen && showTooltip && (
                    <div className="hidden sm:flex items-center bg-white px-4 py-2.5 rounded-2xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-right-5 duration-500 cursor-pointer" onClick={toggleChat}>
                        <span className="text-sm font-bold text-slate-700">Tem dúvidas? Pergunte à IA 🙏</span>
                        <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-r border-t border-slate-100 transform rotate-45"></div>
                    </div>
                )}
                <button
                    onClick={toggleChat}
                    aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
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
