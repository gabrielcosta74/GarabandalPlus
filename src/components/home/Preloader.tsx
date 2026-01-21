'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PreloaderProps {
    onComplete: () => void;
}

const Preloader: React.FC<PreloaderProps> = ({ onComplete }) => {
    const [isPresent, setIsPresent] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsPresent(false);
            setTimeout(onComplete, 400); // Allow exit animation to finish
        }, 800);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <AnimatePresence>
            {isPresent && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-garabandal-dark"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }}
                >
                    <div className="text-center relative px-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="relative z-10 flex flex-col items-center"
                        >
                            {/* Top: Apostolado */}
                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.3 }}
                                className="text-garabandal-gold/90 mb-4 font-light text-xs md:text-sm tracking-[0.4em] uppercase"
                            >
                                Apostolado
                            </motion.p>

                            {/* Divider */}
                            <motion.div
                                className="h-px bg-white/20 mb-6"
                                initial={{ width: 0 }}
                                animate={{ width: "80px" }}
                                transition={{ delay: 0.2, duration: 0.4, ease: "easeInOut" }}
                            />

                            {/* Bottom: Garabandal */}
                            <h1 className="font-serif text-4xl md:text-6xl text-white tracking-widest uppercase shadow-black drop-shadow-lg">
                                Garabandal
                            </h1>
                        </motion.div>

                        {/* Ambient Background Glow */}
                        <motion.div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-garabandal-gold/10 rounded-full blur-3xl pointer-events-none"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Preloader;
