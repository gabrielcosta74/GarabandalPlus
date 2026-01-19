
import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { BrochureDownloadModal } from './BrochureDownloadModal';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type MobileBookingBarProps = {
    price: number;
    deposit: number;
    link: string;
    isClosed: boolean;
    buttonText?: string;
};

export default function MobileBookingBar({ price, deposit, link, isClosed, buttonText = "Inscrever", pilgrimageId }: MobileBookingBarProps & { pilgrimageId?: string }) {
    if (isClosed) return null;

    // Use Portal to escape stacking contexts of parent animations (VIPLayout)
    // We need a mounted check for Next.js hydration
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    const content = (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-5px_30px_-5px_rgba(0,0,0,0.15)] z-[99999] xl:hidden safe-area-bottom pb-6">
            <div className="flex items-center gap-3 container mx-auto px-1">
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5 truncate">Total c/ Voos</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-slate-900 leading-none">{price + deposit}€</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">/ pax</span>
                    </div>
                </div>

                {pilgrimageId && (
                    <BrochureDownloadModal
                        pilgrimageId={pilgrimageId}
                        className="bg-yellow-50 text-yellow-700 border border-yellow-200 p-0 rounded-xl hover:bg-yellow-100 active:scale-95 transition-all !no-underline"
                        trigger={
                            <button className="flex flex-col items-center justify-center bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-xl h-12 w-16 shadow-sm active:scale-95 transition-all shrink-0">
                                <FileText className="w-5 h-5 mb-0.5" />
                                <span className="text-[8px] font-bold uppercase tracking-wide leading-none">Programa</span>
                            </button>
                        }
                    />
                )}

                <Link
                    href={link}
                    className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 h-12 shrink-0"
                >
                    {buttonText} <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
