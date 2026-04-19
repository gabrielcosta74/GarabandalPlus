"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Star, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';

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
                {/* Mobile Background: Removed for clean white aesthetics on mobile */}

                {/* Return Button */}
                <div className="relative z-20 p-6 lg:p-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors group">
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
                        {/* Mobile Logo: Star Removed */}

                        <div className="text-center lg:text-left">
                            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
                                {title}
                            </h2>
                            {subtitle && (
                                <p className="text-gray-500 font-light text-lg">
                                    {subtitle}
                                </p>
                            )}
                        </div>

                        <div className="bg-transparent rounded-3xl p-0 shadow-none">
                            {children}
                        </div>
                    </motion.div>
                </div>

                {/* Footer */}
                <div className="relative z-20 p-6 lg:p-8 text-center text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} Apostolado de Garabandal
                </div>
            </div>
        </div>
    );
}

// Input Component for this theme
export const PremiumInput = ({ label, error, type, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string, error?: string }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className="group">
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 ml-1 group-focus-within:text-garabandal-gold transition-colors">
                {label}
            </label>
            <div className="relative">
                <input
                    type={inputType}
                    className={`
                        w-full px-5 py-4 rounded-xl outline-none transition-all duration-300
                        bg-gray-50 
                        border ${error ? 'border-red-300' : 'border-gray-200'}
                        text-gray-900 placeholder:text-gray-400
                        focus:bg-white focus:border-garabandal-gold
                        focus:ring-4 focus:ring-garabandal-gold/10
                        ${isPassword ? 'pr-12' : ''}
                    `}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors p-1"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
            {error && (
                <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-red-500 text-xs mt-1.5 ml-1 font-medium"
                >
                    {error}
                </motion.p>
            )}
        </div>
    );
};

// Google Button Component
export const GoogleButton = ({
    text = "Continuar com Google",
    isLoading = false,
    className = "",
    referralCode,
    locale,
    next,
}: {
    text?: string;
    isLoading?: boolean;
    className?: string;
    referralCode?: string;
    locale?: string;
    next?: string;
}) => {
    const handleGoogleLogin = async () => {
        if (!supabaseBrowser) return;
        try {
            const params = new URLSearchParams();
            if (referralCode) params.set('ref', referralCode);
            if (locale) params.set('locale', locale);
            if (next) params.set('next', next);
            const qs = params.toString();
            const callbackUrl = `${window.location.origin}/auth-callback${qs ? `?${qs}` : ''}`;
            const { error } = await supabaseBrowser.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: callbackUrl,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) throw error;
        } catch (err) {
            console.error('Erro Google Login:', err);
        }
    };

    return (
        <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className={`
        w-full py-3.5 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 
        text-gray-700 font-bold text-sm flex items-center justify-center gap-3 
        transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed
        ${className}
      `}
        >
            {/* Google "G" Icon SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                />
                <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                />
                <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                />
                <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                />
            </svg>
            {text}
        </button>
    );
};
