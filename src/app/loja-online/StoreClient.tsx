"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Product, loadCart, saveCart } from "./data";
import StoreLayoutWrapper from "../../components/store/StoreLayoutWrapper";
import StoreHero from "../../components/store/StoreHero";
import FilterBar from "../../components/store/FilterBar";
import ProductCard from "../../components/store/ProductCard";
import MobileCartConfirmation from "../../components/store/MobileCartConfirmation";
import { StoreBookPromoBanner, StoreBookPromoPopup } from "../../components/store/StoreBookPromoCampaign";
import { motion, AnimatePresence } from "framer-motion";
import { buildProductPath } from "../../lib/slug";
import { useLocale } from "../../contexts/LocaleContext";
import { getStoreCheckoutPath } from "../../lib/store-i18n";
import { captureStoreEvent } from "../../lib/analytics";

export default function StoreClient() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [category, setCategory] = useState("all");
    const [type, setType] = useState<"all" | "physical" | "digital">("all");
    const [addedProduct, setAddedProduct] = useState<Product | null>(null);
    const [cartCount, setCartCount] = useState(0);
    const [showCartConfirmation, setShowCartConfirmation] = useState(false);
    // const [isMemberActive, setIsMemberActive] = useState(false); // Unused variable
    const router = useRouter();
    const { locale } = useLocale();

    useEffect(() => {
        const loadProducts = async () => {
            setLoadingProducts(true);
            try {
                const res = await fetch("/api/store/products?includeVariants=0");
                if (!res.ok) return;
                const data = await res.json();
                setProducts(data.products || []);
            } catch (err) {
                console.warn("Produtos indisponiveis.", err);
            } finally {
                setLoadingProducts(false);
            }
        };
        loadProducts();
    }, []);

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

    // Removed unused loadMember effect if not used in render

    const addToCart = (id: string) => {
        const prev = loadCart();
        const existing = prev.find((item) => item.id === id);
        const next = existing
            ? prev.map((item) => (item.id === id ? { ...item, qty: item.qty + 1 } : item))
            : [...prev, { id, qty: 1 }];
        saveCart(next);
        const product = products.find((item) => item.id === id) || null;
        setAddedProduct(product);
        setCartCount(next.reduce((sum, item) => sum + item.qty, 0));
        setShowCartConfirmation(!!product);

        if (product) {
            captureStoreEvent('store_add_to_cart', {
                product_id: product.id,
                product_name: product.name,
                category: product.category || null,
                price: product.price,
                quantity: 1,
                locale,
                source: 'product_card',
            });
        }
    };

    const categories = useMemo(() => {
        const set = new Set<string>();
        products.forEach((item) => {
            if (item.category) set.add(item.category);
        });
        return ["all", ...Array.from(set)];
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            if (category !== "all" && product.category !== category) return false;
            if (type === "physical" && !product.isPhysical) return false;
            if (type === "digital" && product.isPhysical) return false;
            return true;
        });
    }, [products, category, type]);

    return (
        <StoreLayoutWrapper>
            <StoreHero />
            <StoreBookPromoBanner />

            <main className="container mx-auto max-w-6xl px-6 pb-24 min-h-screen">

                <FilterBar
                    categories={categories}
                    activeCategory={category}
                    onSetCategory={setCategory}
                    activeType={type}
                    onSetType={setType}
                />

                {loadingProducts ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-96 rounded-3xl bg-gray-100 animate-pulse" />
                        ))}
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-24 border border-gray-200 rounded-3xl bg-gray-50/50 dashed">
                        <p className="text-gray-500 mb-2">Sem produtos disponíveis com estes filtros.</p>
                        <button
                            onClick={() => { setCategory('all'); setType('all'); }}
                            className="text-garabandal-dark font-bold hover:text-garabandal-gold underline text-sm tracking-wide uppercase"
                        >
                            Limpar filtros
                        </button>
                    </div>
                ) : (
                    <motion.div layout className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        <AnimatePresence>
                            {filteredProducts.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onClick={() => router.push(buildProductPath(product.id, product.name))}
                                    onAddToCart={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        addToCart(product.id);
                                    }}
                                />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}

            </main>

            <MobileCartConfirmation
                isOpen={showCartConfirmation}
                product={addedProduct}
                cartCount={cartCount}
                checkoutHref={getStoreCheckoutPath(locale)}
                onClose={() => setShowCartConfirmation(false)}
            />
            <StoreBookPromoPopup />
        </StoreLayoutWrapper>
    );
}
