import AppDownloadBand from './AppDownloadBand';
import CampaignShowcase from './CampaignShowcase';
import ContactBar from './ContactBar';
import DevotionalGrid from './DevotionalGrid';
import Endorsements from './Endorsements';
import FeaturedArticles from './FeaturedArticles';
import FeaturedStore from './FeaturedStore';
import Hero from './Hero';
import HomePilgrimagePreview from './HomePilgrimagePreview';
import HomeQuotaWarning from './HomeQuotaWarning';
import LatestArticles from './LatestArticles';
import LatestNews from './LatestNews';
import SpiritualPillars from './SpiritualPillars';
import WhatIsGarabandal from './WhatIsGarabandal';
import YouTubeLives from './YouTubeLives';
import type { DonationMeta } from '../../lib/donations';
import type { HomeContent } from '../../lib/cms/home';
import type { YouTubeVideo } from '../../lib/youtube';
import type { ComponentProps } from 'react';

interface HomePageProps {
  meta: DonationMeta;
  pilgrimages?: ComponentProps<typeof HomePilgrimagePreview>['pilgrimages'];
  featuredProducts?: ComponentProps<typeof FeaturedStore>['products'];
  homeContent?: HomeContent;
  lives?: YouTubeVideo[];
  locale?: 'pt' | 'en';
}

/**
 * Server composition for the homepage. Interactive areas keep their own small
 * client boundaries; the full document no longer hydrates as one component.
 */
export default function HomePageClient({
  meta,
  pilgrimages = [],
  featuredProducts = [],
  homeContent,
  lives = [],
  locale = 'pt',
}: HomePageProps) {
  return (
    <main className="home-page min-h-screen bg-white text-ink selection:bg-brand selection:text-white">
      <div className="relative isolate">
        <div className="relative z-10">
          <HomeQuotaWarning />
          <Hero locale={locale} />

          {/* Keep the complete crawlable HTML, while allowing the browser to
              skip layout and paint work for distant sections on first load. */}
          <div className="home-below-fold">
            <WhatIsGarabandal locale={locale} />
            {homeContent && <DevotionalGrid categories={homeContent.categories} locale={locale} />}
            {pilgrimages.length > 0 && <HomePilgrimagePreview pilgrimages={pilgrimages} locale={locale} />}
            <Endorsements locale={locale} />
            <YouTubeLives videos={lives} locale={locale} />
            {homeContent && <FeaturedArticles articles={homeContent.featured} locale={locale} />}
            {homeContent && homeContent.articles.length > 0 && (
              <LatestArticles articles={homeContent.articles} locale={locale} />
            )}
            <SpiritualPillars locale={locale} />
            <CampaignShowcase meta={meta} locale={locale} />
            {homeContent && (
              <LatestNews
                items={homeContent.latestNews}
                locale={locale}
                allHref={locale === 'pt' ? '/noticias' : '/en/news'}
              />
            )}
            <AppDownloadBand locale={locale} />
            <FeaturedStore products={featuredProducts} locale={locale} />
            <ContactBar locale={locale} />
          </div>
        </div>
      </div>
    </main>
  );
}
