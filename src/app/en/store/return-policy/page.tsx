import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_URL } from '../../../../lib/config';

const title = 'Return Policy | Garabandal Apostolate Store';
const description =
  'Return, withdrawal and refund policy for items sold through the Garabandal Apostolate online store.';
const url = `${APP_URL}/en/store/return-policy`;

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: url,
    languages: {
      en: url,
      'pt-BR': `${APP_URL}/loja/politica-devolucao`,
      'pt-PT': `${APP_URL}/loja/politica-devolucao`,
    },
  },
  openGraph: {
    url,
    title,
    description,
    type: 'article',
    locale: 'en_GB',
    siteName: 'Garabandal Apostolate',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [`${APP_URL}/opengraph-image`],
  },
};

export default function ReturnPolicyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <Link href="/en/store" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
            Back to store
          </Link>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
            Return Policy
          </h1>
          <p className="text-sm text-slate-500">
            Last updated: 15 June 2026
          </p>
          <p className="text-slate-600 leading-relaxed">
            This policy applies to items bought from the Garabandal Apostolate online store,
            including books, religious articles, clothing and digital content.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Right of withdrawal</h2>
          <p className="text-slate-600 leading-relaxed">
            For distance purchases, consumers may withdraw from the purchase within 14 calendar days
            without giving a reason. For physical goods, this period starts on the day the consumer,
            or a third party appointed by the consumer, receives the item. If an order is delivered
            in multiple shipments, the period starts when the final item is received.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. How to request a return</h2>
          <p className="text-slate-600 leading-relaxed">
            To exercise the right of withdrawal or request a return, send a clear statement to{' '}
            <a href="mailto:geral@apostoladodegarabandal.com" className="underline hover:text-slate-900">
              geral@apostoladodegarabandal.com
            </a>
            , including the order number, name, purchase email and items to be returned.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Condition of returned items</h2>
          <ul className="list-disc pl-6 text-slate-600 leading-relaxed space-y-2">
            <li>Items should be returned complete, clean and, where possible, in their original packaging.</li>
            <li>Books should not show use beyond normal inspection.</li>
            <li>Clothing should be returned unused, unwashed and free from odours, stains or damage.</li>
            <li>The consumer may be responsible for loss in value caused by handling beyond what is necessary to inspect the item.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Return shipping</h2>
          <p className="text-slate-600 leading-relaxed">
            After notifying us of the return, the consumer should send the items back within 14 days.
            Unless the item is defective, damaged, incorrect or our error caused the return, direct
            return shipping costs are borne by the consumer.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Refunds</h2>
          <p className="text-slate-600 leading-relaxed">
            Refunds are made within 14 days of the withdrawal notice, using the same payment method
            used for the purchase unless otherwise agreed. We may withhold the refund until we
            receive the returned items or proof that they were sent.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Digital content</h2>
          <p className="text-slate-600 leading-relaxed">
            For digital content supplied by download, immediate access or digital library, the right
            of withdrawal may cease to apply once the consumer has consented to immediate supply and
            acknowledged that this causes the loss of the withdrawal right.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Defective, damaged or incorrect items</h2>
          <p className="text-slate-600 leading-relaxed">
            If an item arrives damaged, defective or different from what was ordered, contact us as
            soon as possible at{' '}
            <a href="mailto:geral@apostoladodegarabandal.com" className="underline hover:text-slate-900">
              geral@apostoladodegarabandal.com
            </a>
            , including the order number and photos of the item and packaging. This does not limit
            statutory consumer guarantee rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Exceptions</h2>
          <p className="text-slate-600 leading-relaxed">
            In addition to legal exceptions, returns may not be accepted for personalised items,
            sealed items that are unsuitable for return for health or hygiene reasons after opening,
            or digital content whose supply has already begun as described above.
          </p>
        </section>
      </div>
    </main>
  );
}
