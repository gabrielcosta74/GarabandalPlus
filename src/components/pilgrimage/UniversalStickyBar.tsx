"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, FileText, Download } from 'lucide-react';
// import { BrochureDownloadModal } from './BrochureDownloadModal';
import { cn } from '../../lib/utils';
import { useCurrency } from '../providers/CurrencyProvider';

type UniversalStickyBarProps = {
    price: number;
    deposit: number;
    link: string;
    isClosed: boolean;
    pilgrimageId: string;
    slug: string;
    buttonText?: string;
    depositValue?: number;
};

export default function UniversalStickyBar({
    price,
    deposit,
    link,
    isClosed,
    slug,
    buttonText = "Iniciar Inscrição",
    depositValue = 0
}: UniversalStickyBarProps) {
    const [mounted, setMounted] = useState(false);
    const { formatPrice } = useCurrency();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    if (isClosed) {
        return null;
    }

    // Simplified Content without hidden classes first to verify visibility
    const barContent = (
        <div
            id="UNIVERSAL_STICKY_BAR_FINAL"
            className="fixed bottom-0 left-0 w-full z-[99999999] bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] safe-area-bottom pb-6 xl:hidden"
            style={{ pointerEvents: 'auto' }}
        >
            <div className="container mx-auto px-4 py-4">
                <div className="flex flex-col gap-3">

                    {/* Top Row: Price and Small Info */}
                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <div className="flex flex-col">
                            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-widest">Preço do Terrestre</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-900 leading-none">{formatPrice(price + deposit)}</span>
                                <span className="text-xs text-slate-500 font-bold">/ pessoa</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-md text-[10px] font-bold uppercase tracking-tight border border-green-100">
                                <Download className="w-3 h-3" /> Programa Disponível
                            </span>
                        </div>
                    </div>

                    {/* 2. Actions (Grid for 2 buttons) */}
                    <div className="flex-1 grid grid-cols-2 gap-2">
                        {/* WhatsApp Button */}
                        <a
                            href="https://wa.me/351915206815"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white font-bold text-sm active:scale-95 transition-all shadow-sm"
                        >
                            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                            <span>WhatsApp</span>
                        </a>

                        {/* Booking area wrapper */}
                        <div className="flex flex-col gap-1 w-full relative">
                            <Link
                                href={link}
                                className="flex items-center justify-center gap-2 h-14 bg-yellow-400 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-tight shadow-xl shadow-yellow-500/20 active:scale-95 transition-all w-full border-b-4 border-yellow-600"
                            >
                                <span>{buttonText}</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>

                            {/* Reassurance text popover for sticky bar */}
                            {!isClosed && buttonText !== 'Gerir Inscrição' && buttonText !== 'Lista de Espera' && (
                                <div className="absolute bottom-[calc(100%+8px)] right-0 w-[240px] bg-slate-900 text-white p-3 rounded-xl shadow-2xl before:content-[''] before:absolute before:-bottom-2 before:right-8 before:w-4 before:h-4 before:bg-slate-900 before:rotate-45 animate-fade-in-up">
                                    <p className="text-[10px] leading-tight font-medium text-slate-200">
                                        Após realizar a sua inscrição terá que realizar num prazo máximo de 5 dias úteis, o pagamento/doação do valor da inscrição para confirmar e garantir a sua inscrição.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // Render directly to body
    try {
        return createPortal(barContent, document.body);
    } catch (e) {
        console.error("STICKY_BAR: Portal Error", e);
        return barContent; // Fallback to inline
    }
}
