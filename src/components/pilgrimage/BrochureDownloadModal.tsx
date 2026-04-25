"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Mail, X, CheckCircle, ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";
import { useCurrency } from "../providers/CurrencyProvider";
import { useLocale } from "../../contexts/LocaleContext";
import { captureAnalyticsEvent } from "../../lib/analytics";

interface BrochureDownloadModalProps {
    pilgrimageId: string;
    slug?: string;
    className?: string;
    trigger?: React.ReactNode;
    forceOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function BrochureDownloadModal({ pilgrimageId, slug, className, trigger, forceOpen, onOpenChange }: BrochureDownloadModalProps) {
    const { currency } = useCurrency();
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = forceOpen !== undefined;
    const open = isControlled ? forceOpen : internalOpen;
    const setOpen = isControlled ? onOpenChange! : setInternalOpen;

    const [inputValue, setInputValue] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/leads/capture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pilgrimageId,
                    name,
                    email: inputValue,
                    type: "brochure_request",
                    channel_preference: "email",
                    locale,
                    currency: currency // Pass currency preference
                }),
            });

            if (res.ok) {
                setSuccess(true);
                captureAnalyticsEvent('brochure_requested', {
                    pilgrimage_id: pilgrimageId,
                    channel: 'email',
                    locale,
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Trigger */}
            <div onClick={() => setOpen(true)} className="cursor-pointer">
                {trigger || (
                    <button className={cn("flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-garabandal-gold transition-colors underline-offset-4 hover:underline", className)}>
                        <FileText className="w-4 h-4" />
                        {isEn ? 'See Detailed Itinerary' : 'Ver Roteiro Detalhado'}
                    </button>
                )}
            </div>

            {/* Modal Overlay & Content - Portaled to Body */}
            {open && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100000000] flex items-center justify-center p-4 sm:p-6 font-sans">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setOpen(false)}
                    />

                    {/* Content */}
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors z-20"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {success ? (
                            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 bg-green-50/50">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2 animate-in zoom-in duration-300">
                                    <CheckCircle className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-serif font-bold text-gray-900">{isEn ? 'Sent!' : 'Enviado!'}</h2>
                                <p className="text-lg text-gray-600">
                                    {isEn ? 'Check your Email.' : 'Verifique o seu Email.'}
                                    <br />{isEn ? 'The programme is on its way.' : 'O programa já está a caminho.'}
                                </p>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="mt-6 px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    {isEn ? 'Close Window' : 'Fechar Janela'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {/* Header Visualization - Premium Style */}
                                <div className="bg-slate-950 p-6 pt-10 text-white text-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-garabandal-gold/20 to-transparent pointer-events-none"></div>
                                    <div className="relative z-10 space-y-3">
                                        <div className="mx-auto w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md shadow-2xl">
                                            <FileText className="w-8 h-8 text-garabandal-gold" />
                                        </div>
                                        <h2 className="text-2xl font-serif font-bold tracking-tight">{isEn ? 'Itinerary & Details' : 'Roteiro & Detalhes'}</h2>
                                        <p className="text-slate-300 text-sm max-w-[200px] mx-auto leading-relaxed">
                                            {isEn ? 'See the itinerary, hotels and everything included.' : 'Veja o itinerário, hotéis e tudo o que está incluído.'}
                                        </p>

                                        {/* Social Proof Badge */}
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-garabandal-gold/10 border border-garabandal-gold/20 rounded-full mt-4">
                                            <div className="flex -space-x-2">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="w-4 h-4 rounded-full border border-slate-900 bg-slate-800 flex items-center justify-center text-[6px] font-bold">
                                                        {String.fromCharCode(64 + i)}
                                                    </div>
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-bold text-garabandal-gold uppercase tracking-widest">{isEn ? '+500 Pilgrims' : '+500 Peregrinos'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8">
                                    <div className="flex items-center justify-center gap-2 p-3 bg-slate-100 rounded-2xl mb-8 text-slate-700">
                                        <Mail className="w-4 h-4" />
                                        <span className="text-sm font-bold">{isEn ? 'Sent by Email' : 'Envio por Email'}</span>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <label htmlFor="name" className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isEn ? 'Your First Name' : 'O seu Primeiro Nome'}</label>
                                            <input
                                                id="name" required
                                                value={name} onChange={e => setName(e.target.value)}
                                                className="w-full h-14 px-5 rounded-2xl text-lg bg-slate-50 border border-slate-200 focus:border-garabandal-gold focus:ring-4 focus:ring-garabandal-gold/5 outline-none transition-all placeholder:text-slate-300"
                                                placeholder={isEn ? 'How should we address you?' : 'Como podemos tratá-lo?'}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="contact" className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                {isEn ? 'Your best Email' : 'O seu melhor Email'}
                                            </label>
                                            <input
                                                id="contact"
                                                type="email"
                                                required
                                                value={inputValue} onChange={e => setInputValue(e.target.value)}
                                                className="w-full h-14 px-5 rounded-2xl text-lg bg-slate-50 border border-slate-200 focus:border-garabandal-gold focus:ring-4 focus:ring-garabandal-gold/5 outline-none transition-all placeholder:text-slate-300"
                                                placeholder={isEn ? 'e.g. mary@email.com' : 'Ex: maria@email.com'}
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading || !name || !inputValue}
                                            className={cn(
                                                "w-full h-16 text-lg font-bold rounded-2xl mt-4 shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3",
                                                "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20",
                                                loading && "opacity-70 cursor-not-allowed"
                                            )}
                                        >
                                            {loading ? (
                                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Mail className="w-5 h-5" />
                                                    <span>{isEn ? 'Receive in my Email' : 'Receber no meu Email'}</span>
                                                </>
                                            )}
                                        </button>

                                        <p className="text-[11px] text-center text-slate-400 mt-6 leading-relaxed flex items-center justify-center gap-2">
                                            <ShieldCheck className="w-3 h-3" />
                                            <span>{isEn ? 'Privacy Guaranteed. No SPAM.' : 'Privacidade Garantida. Sem SPAM.'}</span>
                                        </p>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
