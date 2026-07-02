"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { ShoppingBag, Search, X } from 'lucide-react';
import ProductCard from '../../components/store/ProductCard';
import MobileCartConfirmation from '../../components/store/MobileCartConfirmation';
import { StoreBookPromoBanner, StoreBookPromoPopup } from '../../components/store/StoreBookPromoCampaign';
import { Product, loadCart, saveCart } from '../loja-online/data';
import { buildProductPath } from '../../lib/slug';
import { inferIsDigitalProduct } from '../../lib/product-kind';
import { useLocale } from '../../contexts/LocaleContext';
import { type AppLocale } from '../../lib/locale-routing';
import { captureStoreEvent } from '../../lib/analytics';
import { getStoreCheckoutPath } from '../../lib/store-i18n';

const getCategories = (isEn: boolean) => [
    { id: 'all', label: isEn ? 'All' : 'Todos' },
    { id: 'Livro Físico', label: isEn ? 'Books' : 'Livros' },
    { id: 'Artigo Religioso', label: isEn ? 'Religious Articles' : 'Artigos Religiosos' },
    { id: 'Vestuário', label: isEn ? 'Clothing' : 'Vestuário' },
    { id: 'Livro Digital', label: isEn ? 'Digital' : 'Digitais' },
];

type StorePageClientProps = {
    initialProducts?: Product[];
    initialLocale?: AppLocale;
};

export default function StorePageClient({ initialProducts = [], initialLocale }: StorePageClientProps) {
    const router = useRouter();
    const { locale: contextLocale } = useLocale();
    const locale = initialLocale ?? contextLocale;
    const isEn = locale === 'en';
    const CATEGORIES = useMemo(() => getCategories(isEn), [isEn]);
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [loading, setLoading] = useState(initialProducts.length === 0);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [addedProduct, setAddedProduct] = useState<Product | null>(null);
    const [cartCount, setCartCount] = useState(0);
    const [showCartConfirmation, setShowCartConfirmation] = useState(false);

    const isDigitalProduct = (product: Product) => {
        return inferIsDigitalProduct({
            isPhysical: (product as any).isPhysical,
            typeId: (product as any).type_id,
            category: (product as any).category,
            name: product.name,
            digitalUrl: (product as any).digitalUrl,
        });
    };

    useEffect(() => {
        fetchProducts();
    }, [locale]);

    useEffect(() => {
        const refreshCartCount = () => {
            setCartCount(loadCart().reduce((sum, item) => sum + item.qty, 0));
        };

        refreshCartCount();
        window.addEventListener('cart:updated', refreshCartCount as EventListener);
        window.addEventListener('storage', refreshCartCount);

        return () => {
            window.removeEventListener('cart:updated', refreshCartCount as EventListener);
            window.removeEventListener('storage', refreshCartCount);
        };
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await fetch(`/api/store/products?includeVariants=0&locale=${locale}&t=${Date.now()}`, {
                cache: 'no-store'
            });
            const data = await res.json();
            setProducts(data.products || []);
        } catch (error) {
            console.error('Failed to load products:', error);
        } finally {
            setLoading(false);
        }
    };

    // Curated ordering: physical book first, then Diário de Conchita, rest keep API order.
    const productRank = (product: Product) => {
        if (product.is_physical || product.type_id === 'book_physical') return 0;
        if (product.name.toLowerCase().includes('diário de conchita') ||
            product.name.toLowerCase().includes('diario de conchita')) return 1;
        return 2;
    };

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const normalizedSearch = searchTerm.toLowerCase();
            const matchesSearch =
                product.name.toLowerCase().includes(normalizedSearch) ||
                product.description.toLowerCase().includes(normalizedSearch);

            let matchesCategory = false;
            if (selectedCategory === 'all') {
                matchesCategory = true;
            } else if (selectedCategory === 'Livro Físico' || selectedCategory === 'Livros') {
                matchesCategory = product.category === 'Livro Físico' ||
                    product.category === 'Books' ||
                    product.category === 'Digital Books' ||
                    (product.category ? product.category.includes('Livro') : false) ||
                    (product.category ? product.category.includes('Book') : false) ||
                    (product.type_id ? product.type_id.includes('book') : false);
            } else if (selectedCategory === 'Livro Digital' || selectedCategory === 'Digitais') {
                matchesCategory = isDigitalProduct(product);
            } else if (selectedCategory === 'Vestuário') {
                matchesCategory = product.category === 'Vestuário' ||
                    product.category === 'Clothing' ||
                    product.type_id === 'clothing';
            } else if (selectedCategory === 'Artigo Religioso') {
                matchesCategory = product.category === 'Artigo Religioso' ||
                    product.category === 'Religious Articles' ||
                    product.type_id === 'religious_article';
            } else {
                matchesCategory = product.category === selectedCategory;
            }

            return matchesSearch && matchesCategory;
        }).sort((a, b) => productRank(a) - productRank(b));
    }, [products, searchTerm, selectedCategory]);

    const handleAddToCart = (product: Product) => {
        const prev = loadCart();
        const existing = prev.find((item) => item.id === product.id);
        const next = existing
            ? prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item))
            : [...prev, { id: product.id, qty: 1 }];

        saveCart(next);
        setAddedProduct(product);
        setCartCount(next.reduce((sum, item) => sum + item.qty, 0));
        setShowCartConfirmation(true);

        captureStoreEvent('store_add_to_cart', {
            product_id: product.id,
            product_name: product.name,
            category: product.category || null,
            price: product.price,
            quantity: 1,
            locale,
            source: 'product_card',
        });
    };

    return (
        <div className="min-h-screen bg-[#FDFDFC] pb-24">
            {/* Header Area - Clean & Sleek */}
            <div className="bg-white border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 md:pt-32 pb-6 md:pb-8 text-center">
                    <div className="flex flex-col items-center justify-center gap-6">
                        
                        {/* Premium Trust Bar for Payments */}
                        <div className="bg-slate-50/80 border border-slate-200/60 p-4 md:p-6 rounded-3xl flex flex-col items-center gap-4 w-full max-w-3xl mx-auto shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                                    {isEn ? '100% Secure Payments' : 'Pagamentos Seguros'}
                                </p>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5">
                                {[
                                    { src: '/payment-icons/multibanco.svg', name: 'Multibanco' },
                                    { src: '/payment-icons/mbway.svg', name: 'MB Way' },
                                    { src: '/payment-icons/visa.svg', name: 'Visa', h: 'h-3 md:h-4' },
                                    { src: '/payment-icons/mastercard.svg', name: 'Mastercard', h: 'h-5 md:h-6' }
                                ].map((payment) => (
                                    <div key={payment.name} className="bg-white border border-slate-100 h-10 w-16 md:h-12 md:w-20 rounded-xl flex items-center justify-center shadow-sm hover:shadow-md transition-shadow" title={payment.name}>
                                        <img src={payment.src} alt={payment.name} className={`${payment.h || 'h-4 md:h-5'} w-auto`} />
                                    </div>
                                ))}
                                
                                <div className="bg-slate-900 h-10 md:h-12 px-5 rounded-xl flex items-center gap-2.5 shadow-md hover:shadow-lg transition-shadow">
                                    <img src="/payment-icons/pix-original.png" alt="PIX" className="h-4 md:h-5 w-auto opacity-90" />
                                    <span className="text-xs md:text-sm font-black text-white">{isEn ? 'Brazil' : 'Brasil'}</span>
                                </div>
                            </div>

                            <Link
                                href={isEn ? '/en/store/return-policy' : '/loja/politica-devolucao'}
                                className="text-xs font-semibold text-slate-500 underline underline-offset-4 transition-colors hover:text-slate-900"
                            >
                                {isEn ? 'Return policy' : 'Política de devolução'}
                            </Link>
                        </div>

                    </div>
                </div>
            </div>

            <StoreBookPromoBanner
                onViewBooks={() => {
                    setSelectedCategory('Livro Físico');
                    setSearchTerm('');
                    window.setTimeout(() => {
                        document.getElementById('store-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                }}
            />

            {/* Filters & Categories Area */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 mb-10 relative z-10">
                <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-white p-2 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                    
                    {/* Pills Navigation */}
                    <div className="flex flex-nowrap lg:flex-wrap gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-hide px-2 pt-2 lg:p-0">
                        {CATEGORIES.map(cat => {
                            const isActive = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setSelectedCategory(cat.id);
                                        captureStoreEvent('store_category_selected', {
                                            category: cat.id,
                                            locale,
                                        });
                                    }}
                                    className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive
                                        ? 'bg-amber-400 text-amber-950 shadow-sm'
                                        : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full lg:w-80 px-2 pb-2 lg:p-0">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={isEn ? 'Search items...' : 'Pesquisar artigos...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:bg-white focus:border-amber-300 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none placeholder:text-slate-400"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div id="store-products" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 scroll-mt-28">
                {loading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="h-[250px] md:h-[400px] bg-white rounded-xl md:rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-8">
                        <AnimatePresence mode='popLayout'>
                            {filteredProducts.map((product) => {
                                const productPath = buildProductPath(product.id, product.name, locale);
                                return (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        href={productPath}
                                        onClick={() => {
                                            captureStoreEvent('store_product_clicked', {
                                                product_id: product.id,
                                                product_name: product.name,
                                                category: product.category || null,
                                                price: product.price,
                                                locale,
                                            });
                                            router.push(productPath);
                                        }}
                                        onAddToCart={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleAddToCart(product);
                                        }}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="text-center py-32">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShoppingBag className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-serif font-bold text-slate-900 mb-2">{isEn ? 'No products found' : 'Sem produtos encontrados'}</h3>
                        <p className="text-slate-500">{isEn ? 'Try adjusting your search or filters.' : 'Tente ajustar a pesquisa ou os filtros.'}</p>
                    </div>
                )}
            </div>

            <MobileCartConfirmation
                isOpen={showCartConfirmation}
                product={addedProduct}
                cartCount={cartCount}
                checkoutHref={getStoreCheckoutPath(locale)}
                onClose={() => setShowCartConfirmation(false)}
            />
            <StoreBookPromoPopup
                onViewBooks={() => {
                    setSelectedCategory('Livro Físico');
                    setSearchTerm('');
                    window.setTimeout(() => {
                        document.getElementById('store-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                }}
            />
        </div>
    );
}
