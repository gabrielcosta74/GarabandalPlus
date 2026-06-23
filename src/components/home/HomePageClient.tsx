'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Preloader from './Preloader';
import Hero from './Hero';
import WhatIsGarabandal from './WhatIsGarabandal';
import Endorsements from './Endorsements';
import ContactBar from './ContactBar';
import SpiritualPillars from './SpiritualPillars';
import CampaignShowcase from './CampaignShowcase';
import SupportArea from './SupportArea';
import PilgrimageShowcase from './PilgrimageShowcase';
import FeaturedStore from './FeaturedStore';
import DevotionalGrid from './DevotionalGrid';
import FeaturedArticles from './FeaturedArticles';
import LatestArticles from './LatestArticles';
import LatestNews from './LatestNews';
import YouTubeLives from './YouTubeLives';
import InstagramFollow from './InstagramFollow';
import { DonationMeta } from '../../lib/donations';
import type { HomeContent } from '../../lib/cms/home';
import type { YouTubeVideo } from '../../lib/youtube';
import { useAuth } from '../../contexts/AuthContext';
import { QuotaWarning } from '../membership/QuotaWarning';


interface HomePageClientProps {
    meta: DonationMeta;
    pilgrimages?: any[];
    featuredProducts?: any[];
    homeContent?: HomeContent;
    lives?: YouTubeVideo[];
    locale?: 'pt' | 'en';
}

const HomePageClient: React.FC<HomePageClientProps> = ({ meta, pilgrimages = [], featuredProducts = [], homeContent, lives = [], locale = 'pt' }) => {
    const [loading, setLoading] = useState(true);
    const { memberData } = useAuth();


    return (
        <main className="min-h-screen bg-garabandal-mist text-slate-900 selection:bg-garabandal-gold selection:text-white">
            {/* Intro Sequence */}
            <Preloader onComplete={() => setLoading(false)} />

            {/* Main Content - revealed after loader */}
            {!loading && (
                <div className="relative isolate">
                    {/* Background Overlay Removed for a cleaner readable look */}
                    <div className="fixed inset-0 z-0 pointer-events-none bg-garabandal-mist" />

                    {/* Content */}
                    <div className="relative z-10">
                        {/* Member Warning Injection */}
                        <QuotaWarning
                            memberData={memberData}
                            className="container mx-auto mt-24 lg:mt-28 mb-4"
                        />

                        <Hero />
                        {/* Newcomer intro: orients first-time visitors right after the Hero */}
                        <WhatIsGarabandal />
                        {/* Devotional content first (self-hides until content is published) */}
                        {homeContent && <DevotionalGrid categories={homeContent.categories} locale={locale} />}
                        {/* Latest YouTube lives, right after "Conhecer Garabandal" */}
                        <YouTubeLives videos={lives} locale={locale} />
                        {/* Follow on Instagram — right after the lives */}
                        <InstagramFollow locale={locale} />
                        {homeContent && <FeaturedArticles articles={homeContent.featured} locale={locale} />}
                        {/* "Artigos" — the CMS posts content type (/l/<slug>), latest first */}
                        {homeContent && homeContent.articles.length > 0 && (
                            <LatestArticles articles={homeContent.articles} locale={locale} />
                        )}
                        {/* Renowned endorsements (social proof) */}
                        <Endorsements />
                        <SpiritualPillars />
                        <CampaignShowcase meta={meta} />
                        {pilgrimages && pilgrimages.length > 0 && <PilgrimageShowcase pilgrimages={pilgrimages} />}
                        {homeContent && (
                            <LatestNews
                                items={homeContent.latestNews}
                                locale={locale}
                                allHref={locale === 'pt' ? '/noticias' : '/en/news'}
                            />
                        )}
                        <FeaturedStore products={featuredProducts || []} />
                        <SupportArea />
                        {/* Contact band just above the footer */}
                        <ContactBar />
                    </div>
                </div>
            )}
        </main>
    );
};

export default HomePageClient;
