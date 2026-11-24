import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../../lib/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy of the Garabandal Apostolate platform — pilgrimages, donations, store and member area.',
  alternates: {
    canonical: `${APP_URL}/en/privacy`,
    languages: {
      en: `${APP_URL}/en/privacy`,
      'pt-BR': `${APP_URL}/privacidade`,
      'pt-PT': `${APP_URL}/privacidade`,
    },
  },
  openGraph: {
    url: `${APP_URL}/en/privacy`,
    title: 'Privacy Policy | Garabandal Apostolate',
    description: 'How we process personal data, data subject rights and security measures.',
  },
};

export default function EnglishPrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-500">Last updated: 24 November 2026</p>
          <p className="text-slate-600 leading-relaxed">
            This policy explains how the Garabandal Apostolate processes personal data on the website,
            web app and mobile app, including memberships, pilgrimages, donations, the store and support.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Data controller</h2>
          <p className="text-slate-600 leading-relaxed">
            Associação do Apostolado de Garabandal, NIPC 517582023, Largo da Igreja, n.º 36,
            4535-275 Paços de Brandão, Portugal. Contact: geral@apostoladodegarabandal.com.
            To exercise privacy rights, use that address with the subject “Data Protection”.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. Data we process</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Identity and contact: name, email, phone, date of birth, sex, country, address and tax details (including NIF/CPF) where applicable.</li>
            <li>Account and authentication: credentials, technical session identifiers and authentication status. Part of the app can be used without an account; progress then stays on the device until the person creates or opens an account, and moves to it.</li>
            <li>Use of the member area: novena progress, completed prayers, favourites and activity the app needs to work.</li>
            <li>Spiritual features: private or published prayer intentions, content reports, prayer progress and days of prayer, and assistant answers you choose to report. Some of this data may reveal religious beliefs.</li>
            <li>Community: name, photos chosen for the profile or posts, captions, comments, prayer requests and graces, gatherings and prayer rooms, live Mass chat, reactions, friendships, blocks and reports. Other people may see your name and profile photo; you choose who sees a post before publishing. Some requests published to the whole community may be shown, without name or photo, to people using the app without an account.</li>
            <li>Bible and Catechism assistants: a record of your permission to use AI providers, with version and date, and the number of questions asked. Questions are not kept as a history; to avoid repeating the same request, an answer may be stored with no link to the account and without the text of the question. Questions and answers you report are available for review.</li>
            <li>Notifications and device: random installation identifier, push notification identifier, system, app version, language, time zone, last use, the permission granted on the phone and notification preferences.</li>
            <li>App usage metrics: screens opened, sessions, prayers started and finished, videos watched and saved, buttons used, system, version and, on Android, the source of the installation. When signed in they are linked to the account; without an account, to a random installation identifier. They never include the text of prayers, requests, questions or the examination of conscience.</li>
            <li>Microphone and voice (conversational rosary): only with permission and during prayer. Sound and speech recognition are processed on the device; they are not sent to or stored on our servers.</li>
            <li>Rezar+ digital subscription: account identifier, product, store, test or production environment, transaction reference, subscription status and end of the access period. We do not receive the card details used in the store.</li>
            <li>Booking the Apostolate house: dates, number and names of companions, contacts and notes given in the request.</li>
            <li>Pilgrimage registration: details of the pilgrim and companions, accommodation, room, flights, meeting points, logistical preferences, proofs and history.</li>
            <li>Health data supplied for travel safety: allergies, dietary restrictions, health notes and assistance needs, used only to organise and accompany the pilgrimage.</li>
            <li>Transactions and online store: amounts, payment method, references, payment status, orders, shipping and invoicing.</li>
            <li>Communications and support: messages sent through forms, email and support channels.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Purposes and legal bases</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Contract: managing the account, registrations, membership fees, donations, orders, bookings and Rezar+ access, and providing the app features you use.</li>
            <li>Legal obligations: invoicing, accounting and tax records, fraud prevention and cooperation with authorities.</li>
            <li>Legitimate interest: platform security, audit, abuse prevention and improving the app through usage metrics, without advertising. You may object using the contact above.</li>
            <li>Data that may reveal religious beliefs: processed in the course of the legitimate activities of the Association, a non-profit body with a religious aim, in relation to members and people in regular contact with it (Article 9(2)(d) GDPR), and with express permission before posting in the community or using the AI assistants.</li>
            <li>Video suggestions: the order of videos takes into account the themes of prayers made in the app and videos watched, saved or dismissed. It has no legal effects and is not used for advertising.</li>
            <li>Consent: promotional communications that are not strictly necessary, where applicable.</li>
            <li>Express permission for the AI assistants: we explain and ask before sending questions to external providers. You can withdraw it in the assistant; reading remains available.</li>
            <li>Express permission to post in the community: before you accept the rules, we explain that the text and any chosen photo are sent to OpenAI for automated safety checks. Without it you can still browse the community but not post.</li>
            <li>Notifications and microphone: only with the permission given on the phone, which you can withdraw at any time in the device settings.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Sharing and providers</h2>
          <p className="text-slate-600 leading-relaxed">
            We share only the data needed to operate the platform with processors bound by data protection terms. The main providers are Supabase (authentication, database and files), Railway (hosting and API), Resend (transactional email), Reduniq (external payment checkout), RevenueCat (validation of App Store and Google Play purchases; it receives the account identifier and subscription data) and Expo, Apple and Google (notification delivery).
          </p>
          <p className="text-slate-600 leading-relaxed">
            In the optional Bible and Catechism assistants, Google receives the question and recent messages to find relevant passages. Google or OpenAI receives the question, those messages and selected extracts to produce the answer. The app does not send the examination of conscience or confession preparation to these providers.
          </p>
          <p className="text-slate-600 leading-relaxed">
            When you post, comment or change your profile photo and bio, after giving permission, the text and any photo are sent to OpenAI to identify inappropriate content before they appear. Text published in the community may also be sent to OpenAI to translate it for people using the app in another language. OpenAI does not receive your name or account identifier in those requests, although the content itself may identify people. Our team can review posts and reports to decide on hiding, restoring or other safety measures.
          </p>
          <p className="text-slate-600 leading-relaxed">
            The Videos section uses YouTube API Services and the official YouTube player, which may collect data and use cookies under the{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900">Google Privacy Policy</a>
            . We do not send YouTube your account identity. Readings, images, maps and streams obtained from other services mean those services receive the IP address of the device, as with any web page.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Where needed for a pilgrimage, strictly necessary data may be shared with transport, accommodation, insurance or local support providers. The mobile app has no advertising of its own and does not collect card details. We do not sell personal data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. International transfers</h2>
          <p className="text-slate-600 leading-relaxed">
            Where processing takes place outside the European Economic Area, we use the safeguards
            required by the GDPR, such as standard contractual clauses and supplementary measures.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Retention</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Account: while active; after deletion, access is revoked and the profile is erased or anonymised.</li>
            <li>Prayer activity and progress on the server: deleted with the account, except backups subject to their technical rotation cycle.</li>
            <li>Transaction, accounting and tax records: ten years, or longer if a legal obligation or dispute requires it.</li>
            <li>Community: posts and photos remain until removed by the author, the team or account deletion, except report and decision records needed for safety and legal duties.</li>
            <li>Usage metrics: those linked to the account are deleted with it; those made without an account do not directly identify the person and are kept while useful to improve the app. Records of videos watched are deleted after 180 days.</li>
            <li>Notifications: device data is removed on sign-out or account deletion; technical delivery records are deleted after 30 days.</li>
            <li>Consent-based data: until consent is withdrawn or the purpose ends.</li>
            <li>AI permission: the active record is deleted when permission is withdrawn or the account is deleted. Answers you reported may remain while needed to review the report.</li>
            <li>Preferences and progress stored only on the device: until removed by the user, the app or uninstalling, depending on the mechanism used.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Your rights</h2>
          <p className="text-slate-600 leading-relaxed">
            You may request access, correction, erasure, restriction, objection and portability where
            applicable, and withdraw consent. You may complain to the Portuguese data protection
            authority, the <a href="https://www.cnpd.pt/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900">CNPD</a>.
            Use the contact above. In the app you can download a copy of your account data under Profile,
            Settings. Account deletion is available in the app profile or on the{' '}
            <Link href="/eliminar-conta" className="underline hover:text-slate-900">account deletion page</Link>.
            Some records must be retained for legal, accounting or fraud prevention purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Mobile app and tracking</h2>
          <p className="text-slate-600 leading-relaxed">
            The app securely stores the session and keeps some preferences and prayer progress on
            the device. The examination of conscience, last confession date and pending penance stay
            in secure device storage and are cleared on sign-out or account deletion. Uninstalling on
            iOS may not automatically erase Keychain data. The app does not use advertising IDs or
            track people across apps and websites, and does not request access to contacts, location or
            the camera. The system photo picker opens only when you choose an image, and the app receives
            only that image. The microphone and speech recognition are requested only for the
            conversational rosary, and the sound never leaves the device. The app is not directed at children.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">9. Security</h2>
          <p className="text-slate-600 leading-relaxed">
            We use appropriate access controls, permission separation, audit records and infrastructure
            protections. No digital system can guarantee absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">10. Cookies</h2>
          <p className="text-slate-600 leading-relaxed">
            Read the <Link href="/en/cookies" className="underline hover:text-slate-900">Cookie Policy</Link>
            {' '}for details of cookies and similar technologies and how to change your preferences.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">11. Changes</h2>
          <p className="text-slate-600 leading-relaxed">
            We may update this policy to reflect legal, technical or operational changes. The version
            published here is the current one.
          </p>
        </section>
      </div>
    </main>
  );
}
