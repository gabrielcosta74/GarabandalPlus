"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "../../contexts/LocaleContext";

interface MobileDonationCTAProps {
    onDonate: () => void;
}

export default function MobileDonationCTA({ onDonate }: MobileDonationCTAProps) {
    const [isVisible, setIsVisible] = useState(false);
    const { locale } = useLocale();
    const isEn = locale === 'en';

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling down a bit (e.g., 100px)
            const scrolled = window.scrollY > 100;
            setIsVisible(scrolled);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden"
                >
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t border-white/50" />

                    <div className="relative flex items-center justify-between gap-4 max-w-md mx-auto">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 leading-tight">
                                {isEn ? 'Help us build' : 'Ajude a construir'}
                            </span>
                            <span className="text-xs text-gray-500">
                                {isEn ? 'Every gesture matters.' : 'Cada gesto conta.'}
                            </span>
                        </div>

                        <button
                            onClick={onDonate}
                            className="px-6 py-3 bg-garabandal-gold text-garabandal-dark font-bold text-sm rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all w-auto whitespace-nowrap"
                        >
                            {isEn ? 'Donate Now' : 'Doar Agora'}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
