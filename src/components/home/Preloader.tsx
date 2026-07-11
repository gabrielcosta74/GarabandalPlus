'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../../contexts/LocaleContext';

interface PreloaderProps {
    onComplete: () => void;
}

const WORD = 'GARABANDAL';
const EASE = [0.22, 1, 0.36, 1] as const;

const Preloader: React.FC<PreloaderProps> = ({ onComplete }) => {
    const { locale } = useLocale();
    const [isPresent, setIsPresent] = useState(true);

    useEffect(() => {
        let completionTimer: ReturnType<typeof setTimeout> | undefined;
        const hideTimer = setTimeout(() => {
            setIsPresent(false);
            completionTimer = setTimeout(onComplete, 700); // Allow exit animation to finish
        }, 1100);
        return () => {
            clearTimeout(hideTimer);
            if (completionTimer) clearTimeout(completionTimer);
        };
    }, [onComplete]);

    return (
        <AnimatePresence>
            {isPresent && (
                <motion.div
                    aria-hidden="true"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-garabandal-mist overflow-hidden"
                    initial={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                    exit={{
                        clipPath: 'inset(0% 0% 100% 0%)',
                        transition: { duration: 0.7, ease: EASE },
                    }}
                >
                    <div className="relative flex flex-col items-center px-8">
                        {/* Eyebrow */}
                        <motion.span
                            initial={{ opacity: 0, letterSpacing: '0.2em' }}
                            animate={{ opacity: 1, letterSpacing: '0.5em' }}
                            transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
                            className="mb-5 ml-[0.5em] text-[0.65rem] md:text-xs font-medium uppercase text-garabandal-gold"
                        >
                            {locale === 'en' ? 'Apostolate' : 'Apostolado'}
                        </motion.span>

                        {/* Wordmark — letter mask reveal */}
                        <div className="flex font-serif text-4xl md:text-6xl tracking-[0.15em] text-garabandal-dark uppercase">
                            {WORD.split('').map((char, i) => (
                                <span key={i} className="inline-block overflow-hidden">
                                    <motion.span
                                        className="inline-block"
                                        initial={{ y: '110%' }}
                                        animate={{ y: '0%' }}
                                        transition={{
                                            delay: 0.25 + i * 0.05,
                                            duration: 0.7,
                                            ease: EASE,
                                        }}
                                    >
                                        {char}
                                    </motion.span>
                                </span>
                            ))}
                        </div>

                        {/* Hairline that draws across */}
                        <motion.div
                            className="mt-6 h-px w-40 origin-center bg-gradient-to-r from-transparent via-garabandal-gold to-transparent"
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{ scaleX: 1, opacity: 1 }}
                            transition={{ delay: 0.75, duration: 0.7, ease: EASE }}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Preloader;
