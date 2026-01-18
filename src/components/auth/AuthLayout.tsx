"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Star } from 'lucide-react';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    backgroundImage?: string;
    quote?: string;
}

const DEFAULT_BG = "https://images.unsplash.com/photo-1510303099958-3d5df0274191?q=80&w=3431&auto=format&fit=crop";

export default function AuthLayout({
    children,
    title,
    subtitle,
    backgroundImage = DEFAULT_BG,
    quote = "A Oração é a chave que abre o Céu."
}: AuthLayoutProps) {
    return (
        <div className="min-h-screen flex bg-garabandal-mist">
            {/* Left Side - Cinematic Content (Desktop Only) */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="hidden lg:flex w-1/2 relative overflow-hidden bg-black text-white"
            >
                {/* Background Image with Parallax/Zoom effect */}
                <motion.div
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 10, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
                    className="absolute inset-0 bg-cover bg-center opacity-60"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                />

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                {/* Content */}
                <div className="relative z-10 p-16 flex flex-col justify-between h-full w-full">
                    {/* Logo Area */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-garabandal-gold flex items-center justify-center">
                            <Star className="w-4 h-4 text-white" fill="currentColor" />
                        </div>
                        <span className="font-serif text-lg font-bold tracking-widest uppercase">Apostolado</span>
                    </div>

                    {/* Lower Content */}
                    <div className="space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                            className="w-12 h-1 bg-garabandal-gold"
                        />
                        <motion.blockquote
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7, duration: 1 }}
                            className="font-serif text-3xl md:text-4xl leading-tight max-w-lg"
                        >
                            "{quote}"
                        </motion.blockquote>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.9 }}
                            className="text-white/60 text-sm tracking-widest uppercase font-bold"
                        >
                            Garabandal App
                        </motion.p>
                    </div>
                </div>
            </motion.div>

            {/* Right Side - Form Area */}
            <div className="w-full lg:w-1/2 flex flex-col relative bg-white">
                {/* Mobile Background (Absolute) */}
                <div className="absolute inset-0 lg:hidden bg-cover bg-center z-0" style={{ backgroundImage: `url(${backgroundImage})` }}>
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                </div>

                {/* Return Button */}
                <div className="relative z-20 p-6 lg:p-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-garabandal-dark lg:text-gray-400 lg:hover:text-black transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Voltar ao início
                    </Link>
                </div>

                {/* Form Container */}
                <div className="flex-1 flex items-center justify-center p-6 lg:p-20 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="w-full max-w-md space-y-8"
                    >
                        {/* Mobile Logo */}
                        <div className="lg:hidden flex items-center gap-2 justify-center mb-8 text-white">
                            <div className="w-10 h-10 rounded-full bg-garabandal-gold flex items-center justify-center shadow-lg shadow-garabandal-gold/20">
                                <Star className="w-5 h-5 text-white" fill="currentColor" />
                            </div>
                        </div>

                        <div className="text-center lg:text-left">
                            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-white lg:text-garabandal-dark mb-3">
                                {title}
                            </h2>
                            {subtitle && (
                                <p className="text-white/60 lg:text-gray-500 font-light text-lg">
                                    {subtitle}
                                </p>
                            )}
                        </div>

                        <div className="bg-white/10 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none rounded-3xl p-6 lg:p-0 border border-white/10 lg:border-none shadow-2xl lg:shadow-none">
                            {children}
                        </div>
                    </motion.div>
                </div>

                {/* Footer */}
                <div className="relative z-20 p-6 lg:p-8 text-center text-xs text-white/40 lg:text-gray-400">
                    &copy; {new Date().getFullYear()} Apostolado de Garabandal
                </div>
            </div>
        </div>
    );
}

// Input Component for this theme
export const PremiumInput = ({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string, error?: string }) => {
    return (
        <div className="group">
            <label className="block text-xs font-bold uppercase tracking-widest text-white/80 lg:text-gray-500 mb-2 ml-1 group-focus-within:text-garabandal-gold transition-colors">
                {label}
            </label>
            <input
                className={`
                    w-full px-5 py-4 rounded-xl outline-none transition-all duration-300
                    bg-white/5 lg:bg-gray-50 
                    border ${error ? 'border-red-400 lg:border-red-300' : 'border-white/10 lg:border-gray-100'}
                    text-white lg:text-gray-900 placeholder:text-white/20 lg:placeholder:text-gray-400
                    focus:bg-white/10 lg:focus:bg-white focus:border-garabandal-gold/50 lg:focus:border-garabandal-gold
                    focus:ring-4 focus:ring-garabandal-gold/10 lg:focus:ring-garabandal-gold/5
                `}
                {...props}
            />
            {error && (
                <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-red-400 lg:text-red-500 text-xs mt-1.5 ml-1 font-medium"
                >
                    {error}
                </motion.p>
            )}
        </div>
    );
};
