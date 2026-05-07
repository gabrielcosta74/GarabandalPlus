import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../../lib/config';
import CookiePreferencesButton from '../../../components/privacy/CookiePreferencesButton';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'Cookie Policy of the Garabandal Apostolate covering cookies, local storage and similar technologies.',
  alternates: {
    canonical: `${APP_URL}/en/cookies`,
    languages: {
      en: `${APP_URL}/en/cookies`,
      'pt-BR': `${APP_URL}/cookies`,
      'pt-PT': `${APP_URL}/cookies`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/cookies`,
    title: 'Cookie Policy | Garabandal Apostolate',
    description: 'Cookie Policy of the Garabandal Apostolate.',
  },
};

export default function EnglishCookiesPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
            Cookie Policy
          </h1>
          <p className="text-sm text-slate-500">
            Last updated: 28 April 2026
          </p>
          <p className="text-slate-600 leading-relaxed">
            This policy explains how the Garabandal Apostolate website and web app use cookies,
            local storage and similar technologies.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. What cookies are</h2>
          <p className="text-slate-600 leading-relaxed">
            Cookies are small files stored on your device to support technical operation, security,
            personalisation and, when you consent, analytics or marketing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. Types of cookies we may use</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li><strong>Strictly necessary:</strong> authentication, session, cart, security, abuse prevention, checkout, donations, membership fees and registrations. These cannot be disabled in our panel because they are required to provide the service requested.</li>
            <li><strong>Local preferences:</strong> language, currency, cart state and your consent choice, where applicable.</li>
            <li><strong>Analytics:</strong> measurement of public page usage and website improvement. These are only activated if you accept analytics cookies.</li>
            <li><strong>Marketing:</strong> campaigns, conversion measurement or personalised communications. These are only activated if you accept marketing cookies.</li>
            <li><strong>Essential third parties:</strong> authentication, hosting, payment, anti-fraud and email services may set their own technical identifiers required to provide those services.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Purposes</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Keep authenticated sessions active and protect user accounts.</li>
            <li>Enable checkout, donations, membership fees and pilgrimage registrations.</li>
            <li>Ensure technical integrity, error detection and platform stability.</li>
            <li>Measure performance and public page usage where consent has been given.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Managing preferences</h2>
          <p className="text-slate-600 leading-relaxed">
            You can accept all, reject optional cookies or choose categories in the consent banner.
            You can change your choice at any time using the button below. You can also manage
            cookies in your browser. Disabling necessary cookies may prevent authentication, checkout
            and other essential features.
          </p>
          <CookiePreferencesButton>Manage cookie preferences</CookiePreferencesButton>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Third-party cookies</h2>
          <p className="text-slate-600 leading-relaxed">
            Some flows depend on third-party providers (for example Supabase for authentication and
            database services, Stripe/Reduniq for payments, PostHog for analytics where consented,
            and email/infrastructure providers). These services may set their own technical
            identifiers under their respective policies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Legal basis</h2>
          <p className="text-slate-600 leading-relaxed">
            Strictly necessary cookies are used to provide the requested service and protect the
            platform. Analytics and marketing cookies are used on the basis of your consent, which
            you can withdraw at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Contact</h2>
          <p className="text-slate-600 leading-relaxed">
            For cookie and privacy questions, contact{' '}
            <strong>geral@apostoladodegarabandal.com</strong> or read the{' '}
            <Link href="/en/privacy" className="underline hover:text-slate-900">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <div className="border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>
            Main legal references: ePrivacy Directive (2002/58/EC), Portuguese Law No. 41/2004 and
            the GDPR.
          </p>
        </div>
      </div>
    </main>
  );
}
