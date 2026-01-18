'use client';

import React, { useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { NAVIGATION_LINKS } from './constants';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import NonMemberOnly from '../../components/site/NonMemberOnly';

const Navbar: React.FC = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { scrollY } = useScroll();

    useMotionValueEvent(scrollY, "change", (latest) => {
        setIsScrolled(latest > 50);
    });

    return (
        <motion.nav
            className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${isScrolled
                ? 'bg-garabandal-dark/80 backdrop-blur-xl border-b border-white/5 py-4'
                : 'bg-transparent py-8'
                }`}
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ delay: 2.5, duration: 1 }}
        >
            <div className="container mx-auto px-6 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="font-serif text-lg tracking-widest text-white group flex flex-col">
                    <span className="leading-none">APOSTOLADO DE GARABANDAL</span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center space-x-4">
                    {NAVIGATION_LINKS.map((link) => {
                        const button = (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={`
                    px-6 py-2 rounded-full text-[11px] font-bold tracking-widest uppercase transition-all duration-300 transform hover:scale-105 active:scale-95
                    ${link.name === 'Ser Membro'
                                        ? 'bg-white text-garabandal-dark hover:bg-garabandal-gold hover:text-white shadow-lg hover:shadow-garabandal-gold/50'
                                        : 'text-white/70 hover:text-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                                    }
                  `}
                            >
                                {link.name}
                            </Link>
                        );

                        if (link.name === 'Ser Membro') {
                            return (
                                <NonMemberOnly key={link.name}>
                                    {button}
                                </NonMemberOnly>
                            );
                        }

                        return button;
                    })}
                </div>

                {/* Mobile Toggle */}
                <button
                    className="md:hidden text-white p-2 rounded-full hover:bg-white/10"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="md:hidden bg-garabandal-dark border-b border-white/10 absolute w-full shadow-xl"
                >
                    <div className="flex flex-col p-6 space-y-4">
                        {NAVIGATION_LINKS.map((link) => {
                            const item = (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-center text-white/80 hover:text-garabandal-gold py-4 rounded-2xl bg-white/5 uppercase tracking-widest text-xs font-bold block"
                                >
                                    {link.name}
                                </Link>
                            );

                            if (link.name === 'Ser Membro') {
                                return (
                                    <NonMemberOnly key={link.name}>
                                        {item}
                                    </NonMemberOnly>
                                );
                            }
                            return item;
                        })}
                    </div>
                </motion.div>
            )}
        </motion.nav>
    );
};

export default Navbar;
