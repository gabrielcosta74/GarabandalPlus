import type { ReactNode } from 'react';
import Image from 'next/image';

export const metadata = {
    title: 'Portal de Orações | Apostolado de Garabandal',
};

export default function PortalLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-hidden">
            <header className="bg-white border-b border-slate-200 px-3 py-3 sm:px-6 sm:py-4">
                <div className="max-w-6xl mx-auto flex items-center gap-2 sm:gap-3 min-w-0">
                    <Image
                        src="/images/assinatura-garabandal.png"
                        alt="Apostolado de Garabandal"
                        width={140}
                        height={40}
                        className="h-auto w-28 shrink-0 object-contain sm:w-[140px]"
                    />
                    <span className="text-slate-300 text-lg font-light shrink-0">|</span>
                    <span className="min-w-0 truncate text-xs text-slate-500 font-medium sm:text-sm">Portal de Orações</span>
                </div>
            </header>
            <main className="flex-1 max-w-6xl mx-auto w-full px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
                {children}
            </main>
        </div>
    );
}
