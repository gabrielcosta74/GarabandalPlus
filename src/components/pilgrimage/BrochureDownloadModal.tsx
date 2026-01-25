"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Smartphone, Mail, X, CheckCircle, Download, ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";
import { useCurrency } from "../providers/CurrencyProvider";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

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
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = forceOpen !== undefined;
    const open = isControlled ? forceOpen : internalOpen;
    const setOpen = isControlled ? onOpenChange! : setInternalOpen;

    const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
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
                    email: channel === "email" ? inputValue : undefined,
                    phone: channel === "whatsapp" ? inputValue : undefined,
                    type: "brochure_request",
                    channel_preference: channel,
                    currency: currency // Pass currency preference
                }),
            });

            if (res.ok) {
                setSuccess(true);
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
                        Ver Roteiro Detalhado
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
                                <h2 className="text-2xl font-serif font-bold text-gray-900">Enviado!</h2>
                                <p className="text-lg text-gray-600">
                                    {channel === 'whatsapp' ? 'Verifique o seu WhatsApp.' : 'Verifique o seu Email.'}
                                    <br />O programa já está a caminho.
                                </p>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="mt-6 px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Fechar Janela
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
                                        <h2 className="text-2xl font-serif font-bold tracking-tight">Roteiro & Detalhes</h2>
                                        <p className="text-slate-300 text-sm max-w-[200px] mx-auto leading-relaxed">
                                            Veja o itinerário, hotéis e tudo o que está incluído.
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
                                            <span className="text-[10px] font-bold text-garabandal-gold uppercase tracking-widest">+500 Peregrinos</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8">
                                    {/* Channel Selector - Refined Pills */}
                                    <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
                                        <button
                                            type="button"
                                            onClick={() => setChannel("whatsapp")}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold text-sm",
                                                channel === "whatsapp"
                                                    ? "bg-white text-slate-900 shadow-sm"
                                                    : "text-slate-500 hover:text-slate-700"
                                            )}
                                        >
                                            <Smartphone className="w-4 h-4" />
                                            WhatsApp
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setChannel("email")}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold text-sm",
                                                channel === "email"
                                                    ? "bg-white text-slate-900 shadow-sm"
                                                    : "text-slate-500 hover:text-slate-700"
                                            )}
                                        >
                                            <Mail className="w-4 h-4" />
                                            Email
                                        </button>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <label htmlFor="name" className="text-xs font-bold text-slate-400 uppercase tracking-widest">O seu Primeiro Nome</label>
                                            <input
                                                id="name" required
                                                value={name} onChange={e => setName(e.target.value)}
                                                className="w-full h-14 px-5 rounded-2xl text-lg bg-slate-50 border border-slate-200 focus:border-garabandal-gold focus:ring-4 focus:ring-garabandal-gold/5 outline-none transition-all placeholder:text-slate-300"
                                                placeholder="Como podemos tratá-lo?"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="contact" className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                {channel === "whatsapp" ? "WhatsApp (Brasil/Internacional)" : "O seu melhor Email"}
                                            </label>

                                            {channel === "whatsapp" ? (
                                                <div className="phone-input-container">
                                                    <PhoneInput
                                                        international
                                                        defaultCountry="BR"
                                                        value={inputValue}
                                                        onChange={(val) => setInputValue(val || "")}
                                                        className="w-full h-14 px-5 rounded-2xl text-lg bg-slate-50 border border-slate-200 focus-within:border-garabandal-gold focus-within:ring-4 focus-within:ring-garabandal-gold/5 outline-none transition-all flex items-center gap-3"
                                                        placeholder="Digite seu celular"
                                                    />
                                                    <style jsx global>{`
                                                        .PhoneInputInput {
                                                            background: transparent;
                                                            border: none;
                                                            outline: none;
                                                            font-size: 1.125rem;
                                                            flex: 1;
                                                            height: 100%;
                                                            color: #0f172a;
                                                        }
                                                        .PhoneInputCountry {
                                                            padding: 4px;
                                                            background: white;
                                                            border-radius: 8px;
                                                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                                                        }
                                                    `}</style>
                                                </div>
                                            ) : (
                                                <input
                                                    id="contact"
                                                    type="email"
                                                    required
                                                    value={inputValue} onChange={e => setInputValue(e.target.value)}
                                                    className="w-full h-14 px-5 rounded-2xl text-lg bg-slate-50 border border-slate-200 focus:border-garabandal-gold focus:ring-4 focus:ring-garabandal-gold/5 outline-none transition-all placeholder:text-slate-300"
                                                    placeholder="Ex: maria@email.com"
                                                />
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading || !name || !inputValue}
                                            className={cn(
                                                "w-full h-16 text-lg font-bold rounded-2xl mt-4 shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3",
                                                channel === "whatsapp"
                                                    ? "bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-green-500/20"
                                                    : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20",
                                                loading && "opacity-70 cursor-not-allowed"
                                            )}
                                        >
                                            {loading ? (
                                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    {channel === 'whatsapp' ? <Smartphone className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                                                    <span>Receber no meu {channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</span>
                                                </>
                                            )}
                                        </button>

                                        <p className="text-[11px] text-center text-slate-400 mt-6 leading-relaxed flex items-center justify-center gap-2">
                                            <ShieldCheck className="w-3 h-3" />
                                            <span>Privacidade Garantida. Sem SPAM.</span>
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
