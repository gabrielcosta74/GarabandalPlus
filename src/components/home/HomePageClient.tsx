'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Preloader from './Preloader';
import Hero from './Hero';
import Pillars from './Pillars';
import Campaign from './Campaign';
import Sustain from './Sustain';
import NextPilgrimage from './NextPilgrimage';
import FeaturedStore from './FeaturedStore';
import { DonationMeta } from '../../lib/donations';
import { useAuth } from '../../contexts/AuthContext';
import { QuotaWarning } from '../membership/QuotaWarning';


interface HomePageClientProps {
    meta: DonationMeta;
    nextPilgrimage?: any;
    featuredProducts?: any[];
}

const HomePageClient: React.FC<HomePageClientProps> = ({ meta, nextPilgrimage, featuredProducts = [] }) => {
    const [loading, setLoading] = useState(true);
    const { memberData } = useAuth();


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
                            <Image
                                src="/images/nossasenhoragarabandal.jpg"
                                alt=""
                                fill
                                priority
                                sizes="100vw"
                                className="object-contain opacity-90 brightness-110"
                            />
                            {/* Spotlight Gradient Mask */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0f172a_70%)] z-10" />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10">
                        {/* Member Warning Injection */}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-24 lg:mt-28 mb-4">
                            <QuotaWarning memberData={memberData} />
                        </div>

                        <Hero />
                        <Pillars />
                        <Campaign meta={meta} />
                        <FeaturedStore products={featuredProducts || []} />
                        {nextPilgrimage && <NextPilgrimage nextPilgrimage={nextPilgrimage} />}
                        <Sustain />
                    </div>
                </div>
            )}
        </main>
    );
};

export default HomePageClient;
