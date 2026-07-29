"use client";

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { SpecificWaitlistForm } from './SpecificWaitlistForm';
import { useLocale } from '../../contexts/LocaleContext';

type WaitlistModalProps = {
    isOpen: boolean;
    onClose: () => void;
    pilgrimageId: string;
    pilgrimageTitle: string;
};

/**
 * Wraps the existing waiting-list form in a dialog so the sold-out page can keep
 * showing the price, the flights and the dates instead of swapping them out.
 */
export default function WaitlistModal({
    isOpen,
    onClose,
    pilgrimageId,
    pilgrimageTitle,
}: WaitlistModalProps) {
    const { locale } = useLocale();
    const isEn = locale === 'en';

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100000000] flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label={isEn ? 'Join the waiting list' : 'Entrar na lista de espera'}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain sm:max-w-lg">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={isEn ? 'Close' : 'Fechar'}
                    className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="[&>div]:rounded-b-none [&>div]:sm:rounded-b-3xl">
                    <SpecificWaitlistForm
                        pilgrimageId={pilgrimageId}
                        pilgrimageTitle={pilgrimageTitle}
                    />
                </div>
            </div>
        </div>
    );
}
