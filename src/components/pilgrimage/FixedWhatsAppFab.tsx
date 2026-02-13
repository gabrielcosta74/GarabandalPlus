"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrochureDownloadModal } from './BrochureDownloadModal';

type FixedWhatsAppFabProps = {
    pilgrimageId: string;
};

export default function FixedWhatsAppFab({ pilgrimageId }: FixedWhatsAppFabProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const fabContent = (
        <div
            id="DESKTOP_BROCHURE_FAB"
            className="fixed bottom-10 right-10 z-[2147483647] hidden xl:block animate-in slide-in-from-bottom-10 fade-in duration-700 delay-500"
            style={{ pointerEvents: 'auto' }}
        >
            <BrochureDownloadModal
                pilgrimageId={pilgrimageId}
                className="!no-underline"
                trigger={
                    <button
                        className="flex items-center gap-4 pl-4 pr-6 py-4 rounded-full bg-white text-slate-900 font-bold shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_60px_rgba(15,23,42,0.35)] hover:scale-110 transition-all border-2 border-slate-300 group cursor-pointer"
                        style={{ isolation: 'isolate' }}
                    >
                        <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-lg group-hover:rotate-12 transition-transform">
                            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v16H4z M7 8l5 4 5-4" /></svg>
                        </div>
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] uppercase tracking-widest text-slate-700 font-extrabold mb-0.5">Roteiro Completo</span>
                            <span className="text-base font-bold text-slate-900">Receber por Email</span>
                        </div>
                    </button>
                }
            />
        </div>
    );

    return createPortal(fabContent, document.body);
}
