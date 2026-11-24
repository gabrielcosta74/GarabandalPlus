import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Terms and Conditions for using the Garabandal Apostolate platform — pilgrimages, store, donations and membership.',
  alternates: {
    canonical: `${APP_URL}/en/terms`,
    languages: {
      en: `${APP_URL}/en/terms`,
      'pt-BR': `${APP_URL}/termos`,
      'pt-PT': `${APP_URL}/termos`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/terms`,
    title: 'Terms & Conditions | Garabandal Apostolate',
    description: 'Platform usage rules, payments, registrations and online store terms.',
  },
};

export default function EnglishTermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">Terms and Conditions</h1>
          <p className="text-sm text-slate-500">Last updated: 24 November 2026</p>
          <p className="text-slate-600 leading-relaxed">
            These terms govern use of the Garabandal Apostolate website, web app and member app.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Operator and scope</h2>
          <p className="text-slate-600 leading-relaxed">
            The platform is operated by Associação do Apostolado de Garabandal, NIPC 517582023,
            Largo da Igreja, n.º 36, 4535-275 Paços de Brandão, Portugal. Contact us at
            geral@apostoladodegarabandal.com or +351 915 206 815. These terms cover the website,
            member area, Rezar+ digital subscription, pilgrimages, donations, membership fees and online store.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. Accounts</h2>
          <p className="text-slate-600 leading-relaxed">
            Part of the app can be used without an account; the community, bookings and the Rezar+
            subscription require one. You must provide accurate details and protect your account. Abusive, fraudulent or unlawful
            use may lead to restricted access. You may request account deletion in the app profile,
            subject to records we must retain by law.
          </p>
        </section>

        <section id="user-content" className="space-y-3 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-900">3. User content</h2>
          <p className="text-slate-600 leading-relaxed">
            People with an account may share prayer requests, graces, reflections, photos, comments, prayer gatherings and messages in the live Mass chat. By posting you declare that the content is yours or that you have the right to share it, and accept the rules below.
          </p>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li><strong>There is no tolerance for objectionable content or abusive behaviour.</strong> Defamatory, obscene, violent, discriminatory, hateful, harassing, misleading, advertising or unlawful content, and third-party personal data, are prohibited.</li>
            <li>Anyone with an account can report posts, comments, gatherings or profiles and block other people in the app. Blocking is immediate and can be managed in the profile.</li>
            <li>Reports are reviewed by the team as quickly as possible. Content that breaks these rules is hidden or removed, and the accounts responsible may have community access restricted or be suspended. You may ask for a review using the contacts above.</li>
            <li>Content reported by several people may be hidden automatically while awaiting review.</li>
            <li>Before publication, text and photos are checked automatically by OpenAI, after express permission. These checks do not replace human review. The Apostolate does not endorse user content and may remove it at any time.</li>
          </ul>
        </section>

        <section id="pilgrimages" className="space-y-3 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-900">4. Pilgrimages</h2>
          <p className="text-slate-600 leading-relaxed">
            Registrations depend on availability, validation of details and payment confirmation.
            The itinerary, price, instalments and cancellation rules for each pilgrimage are shown
            in its own offer. Those specific conditions govern where they differ from these general terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Membership, donations and Rezar+</h2>
          <p className="text-slate-600 leading-relaxed">
            Payments may be processed by external providers (such as Stripe or Reduniq) under their own terms. Donations and fees are recorded for administrative, accounting and tax purposes. Donations are voluntary, do not unlock features or digital content and, when started in the app, are completed outside it in the device browser. Membership fees are a statutory obligation of association members, not a purchase of digital content. The Rezar+ subscription, when available, is sold through the App Store or Google Play, which show the price, renewal period and any offers before purchase; automatic renewal, cancellation and refunds follow the rules of that store. Rezar+ gives access to search and questions in the Bible and the Catechism, the conversational rosary and the guided examination of conscience. It does not confer membership, a member number or association rights; members with current fees already have these features. Purchases can be restored in the app. The app does not collect card details.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Online store</h2>
          <p className="text-slate-600 leading-relaxed">
            Prices and availability may change without affecting confirmed orders. Distance contracts carry the statutory consumer rights in Portugal. Shipping costs, deadlines and conditions are shown at checkout before confirmation. The{' '}
            <Link href="/en/store/return-policy" className="underline hover:text-slate-900">Return Policy</Link>{' '}
            also applies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Intellectual property and third-party services</h2>
          <p className="text-slate-600 leading-relaxed">
            Site content, marks and graphics are protected unless stated otherwise. We work to keep
            information accurate and the service available, but liability is governed by applicable law.
          </p>
          <p className="text-slate-600 leading-relaxed">
            The Videos section of the app uses YouTube API Services. By using it you also accept the{' '}
            <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900">YouTube Terms of Service</a>
            . Videos belong to their channels.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Answers from the artificial intelligence assistants may contain errors and do not replace the Magisterium of the Church, a priest or spiritual direction. You can report an answer in the app.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Personal data and changes</h2>
          <p className="text-slate-600 leading-relaxed">
            Personal data and cookies are described in our{' '}
            <Link href="/en/privacy" className="underline hover:text-slate-900">Privacy Policy</Link>{' '}
            and <Link href="/en/cookies" className="underline hover:text-slate-900">Cookie Policy</Link>.
            We may update these terms; the version published here is the current one.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">9. Governing law and disputes</h2>
          <p className="text-slate-600 leading-relaxed">
            These terms are governed by Portuguese law. In case of dispute, consumer dispute rules and the competent courts in Portugal apply, without limiting mandatory consumer protection.
          </p>
        </section>
      </div>
    </main>
  );
}
