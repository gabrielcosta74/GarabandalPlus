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
                ? 'bg-garabandal-dark/90 backdrop-blur-xl border-b border-white/5 py-4 shadow-2xl'
                : 'bg-transparent py-8 lg:py-10'
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
                <div className="hidden md:flex items-center space-x-8">
                    {NAVIGATION_LINKS.map((link) => {
                        if (link.name === 'Ser Membro') {
                            const button = (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="px-8 py-3 rounded-full bg-white text-garabandal-dark text-xs font-bold tracking-widest uppercase hover:bg-garabandal-gold hover:text-white hover:shadow-lg hover:shadow-garabandal-gold/40 transition-all duration-300 transform hover:-translate-y-1"
                                >
                                    {link.name}
                                </Link>
                            );
                            return (
                                <NonMemberOnly key={link.name}>
                                    {button}
                                </NonMemberOnly>
                            );
                        }

                        return (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="relative group text-sm font-bold tracking-widest uppercase text-white/80 hover:text-white transition-colors py-2"
                            >
                                {link.name}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-garabandal-gold transition-all duration-300 group-hover:w-full opacity-0 group-hover:opacity-100" />
                            </Link>
                        );
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
                                    className="text-center text-white/80 hover:text-garabandal-gold py-4 rounded-2xl bg-white/5 uppercase tracking-widest text-sm font-bold block"
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
