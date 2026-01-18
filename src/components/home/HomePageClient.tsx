'use client';

import React, { useState } from 'react';
import Preloader from './Preloader';
import Navbar from './Navbar';
import Hero from './Hero';
import Pillars from './Pillars';
import Campaign from './Campaign';
import Sustain from './Sustain';
import Testimonials from './Testimonials';
import { DonationMeta } from '../../lib/donations';

interface HomePageClientProps {
    meta: DonationMeta;
}

const HomePageClient: React.FC<HomePageClientProps> = ({ meta }) => {
    const [loading, setLoading] = useState(true);

    return (
        <main className="min-h-screen bg-garabandal-dark text-slate-100 selection:bg-garabandal-gold selection:text-white">
            {/* Intro Sequence */}
            <Preloader onComplete={() => setLoading(false)} />

            {/* Main Content - revealed after loader */}
            {!loading && (
                <div className="relative isolate">
                    {/* Background Overlay */}
                    {/* Background Overlay */}
                    <div className="fixed inset-0 z-0 pointer-events-none bg-garabandal-dark flex items-center justify-center">
                        <div className="relative w-full h-[85vh] max-w-5xl">
                            <img
                                src="/images/nossasenhoragarabandal.jpg"
                                alt=""
                                className="w-full h-full object-contain opacity-90 brightness-110"
                            />
                            {/* Spotlight Gradient Mask */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0f172a_70%)] z-10" />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10">
                        <Navbar />
                        <Hero />
                        <Pillars />
                        <Campaign meta={meta} />
                        <Sustain />
                        <Testimonials />
                    </div>
                </div>
            )}
        </main>
    );
};

export default HomePageClient;
