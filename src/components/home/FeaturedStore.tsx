import Link from 'next/link';
import Image from 'next/image';
import { buildProductPath } from '../../lib/slug';
import { getTranslations } from '../../i18n';
import { Section, SectionHeader } from './ui';

type FeaturedProduct = {
    id: string;
    name: string;
    price: number;
    currency: string;
    image: string;
    category?: string | null;
    isPhysical: boolean;
};

export default function FeaturedStore({
    products,
    locale,
}: {
    products: FeaturedProduct[];
    locale: 'pt' | 'en';
}) {
    if (!products || products.length === 0) return null;
    const t = getTranslations(locale);
    const isEn = locale === 'en';

    const formatPrice = (val: number) =>
        new Intl.NumberFormat(isEn ? 'en-IE' : 'pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

    return (
        <Section tone="white" labelledBy="home-store-heading">
            <SectionHeader
                id="home-store-heading"
                eyebrow={isEn ? 'Online store' : 'Loja online'}
                title={isEn ? 'Apostolate articles' : 'Artigos do Apostolado'}
                description={isEn
                    ? 'Each purchase strengthens the mission of bringing the message of Garabandal to more hearts.'
                    : 'Cada compra sustenta a nossa missão de levar a mensagem de Garabandal a mais corações.'}
                action={{ href: t.urls.store, label: isEn ? 'View full store' : 'Ver loja completa' }}
            />

            <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4 lg:gap-x-8">
                {products.slice(0, 4).map((product) => (
                    <Link
                        key={product.id}
                        href={buildProductPath(product.id, product.name)}
                        className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-paper">
                            <Image
                                src={product.image}
                                alt=""
                                fill
                                sizes="(min-width: 1024px) 280px, 50vw"
                                className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
                            />
                        </div>
                        <div className="mt-4">
                            <p className="line-clamp-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                                {product.category || (product.isPhysical ? (isEn ? 'Devotion' : 'Devoção') : 'Digital')}
                            </p>
                            <h3 className="mt-1.5 line-clamp-2 text-base font-semibold leading-snug tracking-[-0.01em] text-ink underline-offset-4 decoration-1 group-hover:underline">
                                {product.name}
                            </h3>
                            <p className="mt-2 text-base font-semibold text-ink">{formatPrice(product.price)}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </Section>
    );
}
