import type { ReactNode } from 'react';
import Image from 'next/image';

export const metadata = {
    title: 'Portal de Orações | Apostolado de Garabandal',
};

export default function PortalLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <Image
                        src="/images/assinatura-garabandal.png"
                        alt="Apostolado de Garabandal"
                        width={140}
                        height={40}
                        className="object-contain"
                    />
                    <span className="text-slate-300 text-lg font-light">|</span>
                    <span className="text-sm text-slate-500 font-medium">Portal de Orações</span>
                </div>
            </header>
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
                {children}
            </main>
        </div>
    );
}
