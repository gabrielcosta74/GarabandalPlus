"use client";

import { X, Package, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../../contexts/LocaleContext';

interface BookingOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function BookingOnboardingModal({ isOpen, onClose }: BookingOnboardingModalProps) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    // Prevent hydration mismatch
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto relative">
                            {/* Decorative Header */}
                            <div className="bg-yellow-500 h-32 relative overflow-hidden flex items-center justify-center">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg relative z-10 animate-in zoom-in duration-500">
                                    <CheckCircle2 className="w-10 h-10 text-yellow-600" />
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 bg-black/10 hover:bg-black/20 text-white rounded-full p-2 transition-colors z-20"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            <div className="p-8 text-center space-y-6">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-slate-900">{isEn ? 'All set!' : 'Tudo pronto!'}</h2>
                                    <p className="text-slate-500 text-lg">{isEn ? 'Your account was created automatically and you are already logged in.' : 'A tua conta foi criada automaticamente e já estás logado.'}</p>
                                </div>

                                {/* The Lesson */}
                                <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-100 text-left space-y-4 relative">
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                        <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        {isEn ? 'Where are my tickets?' : 'Onde estão os meus bilhetes?'}
                                    </h3>

                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        {isEn ? <>Whenever you come back to the site, just click the <strong className="text-slate-900">"My Registrations"</strong> menu (at the top of the page or in the mobile menu) to see this page.</> : <>Sempre que voltares ao site, basta clicares no menu <strong className="text-slate-900">"Minhas Inscrições"</strong> (no topo da página ou no menu do telemóvel) para veres esta página.</>}
                                    </p>

                                    {/* Visual Cue - Arrow pointing (Desktop/Mobile simplified) */}
                                    <div className="hidden md:block absolute -top-12 -right-8 w-24">
                                        <svg viewBox="0 0 100 100" className="w-full h-full text-yellow-500 rotate-12 drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="3">
                                            <path d="M20,80 Q50,20 80,10" />
                                            <path d="M80,10 L70,20 M80,10 L65,5" />
                                        </svg>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={onClose}
                                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-4 rounded-xl shadow-xl shadow-yellow-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] text-lg"
                                    >
                                        {isEn ? 'Got it, view my registration' : 'Entendido, ver a minha inscrição'}
                                    </button>
                                    <p className="text-xs text-slate-400">
                                        {isEn ? 'We also sent you an email with a direct link to this page.' : 'Enviámos também um email com o link direito para aqui.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
