"use client";

import Link from "next/link";
import { useRouter } from "next/navigation"; // Removed useParams as we get product via props
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Product, loadCart, saveCart } from "../../data";
import StoreLayoutWrapper from "../../../../components/store/StoreLayoutWrapper";
import ProductCard from "../../../../components/store/ProductCard";
import { ShoppingCart, ArrowLeft, Check, Truck, ShieldCheck, CreditCard, Globe } from "lucide-react";
import { useCurrency } from "../../../../components/providers/CurrencyProvider";
import { listCountryOptions } from "../../../../lib/country-utils";

const getVatRate = (product: Product) => (product.isPhysical ? 0.06 : 0.23);

const getVatBreakdown = (value: number, rate: number) => {
    const base = value / (1 + rate);
    const vat = value - base;
    return { base, vat };
};

interface ProductClientProps {
    product: Product | null;
    relatedProducts: Product[];
}

export default function ProductClient({ product, relatedProducts }: ProductClientProps) {
    const { formatPrice } = useCurrency();
    const router = useRouter();
    const [justAdded, setJustAdded] = useState(false);

    const addToCart = (id: string, qty = 1) => {
        const current = loadCart();
        const existing = current.find((item) => item.id === id);
        const next = existing
            ? current.map((item) => (item.id === id ? { ...item, qty: item.qty + qty } : item))
            : [...current, { id, qty }];
        saveCart(next);
    };

    const handleAddToCart = () => {
        if (!product) return;
        addToCart(product.id);
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1200);
    };

    const handleBuyNow = () => {
        if (!product) return;
        addToCart(product.id);
        router.push("/loja-online/checkout");
    };

    // 1. Not Found State
    if (!product) {
        return (
            <StoreLayoutWrapper>
                <div className="container mx-auto px-6 py-32 text-center">
                    <h2 className="font-serif text-3xl text-garabandal-dark mb-4">Produto não encontrado</h2>
                    <p className="text-gray-500 mb-8">O produto que procuras não está disponível.</p>
                    <Link className="inline-flex items-center gap-2 text-garabandal-gold font-bold hover:underline" href="/loja-online">
                        <ArrowLeft size={16} />
                        Voltar à loja
                    </Link>
                </div>
            </StoreLayoutWrapper>
        );
    }

    // 2. Main Render
    const rate = getVatRate(product);
    const breakdown = getVatBreakdown(product.price, rate);
    const isSoldOut = product.stock === 0;

    return (
        <StoreLayoutWrapper>
            <div className="container mx-auto px-6 py-8 md:py-12 max-w-7xl">
                <Link href="/loja-online" className="inline-flex items-center text-gray-400 hover:text-garabandal-gold transition-colors mb-8 text-xs font-bold uppercase tracking-widest">
                    <ArrowLeft size={14} className="mr-2" />
                    Voltar à loja
                </Link>

                {/* Product Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-20 mb-24 items-start">

                    {/* Image Column */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white border border-gray-100 rounded-[2rem] p-8 flex items-center justify-center relative overflow-hidden shadow-lg shadow-gray-100/50"
                    >
                        {product.tag && (
                            <div className="absolute top-4 left-4 bg-garabandal-gold text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                                {product.tag}
                            </div>
                        )}
                        <img
                            src={product.image || "/images/produto-placeholder.jpg"}
                            alt={product.name}
                            className="w-full h-auto max-h-[400px] object-contain drop-shadow-xl"
                        />
                    </motion.div>

                    {/* Details Column */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col"
                    >
                        <div className="mb-2 text-garabandal-gold text-[10px] font-bold uppercase tracking-[0.2em]">Loja Oficial</div>
                        <h1 className="font-serif text-3xl md:text-4xl text-garabandal-dark mb-4 leading-tight">
                            {product.name}
                        </h1>
                        <p className="text-gray-500 text-base leading-relaxed mb-6 font-light">
                            {product.description || "Uma peça especial do Apostolado de Garabandal, preparada para levar a mensagem a mais pessoas."}
                        </p>

                        {/* Meta info */}
                        <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-100">
                            <div className="text-sm font-bold uppercase tracking-widest text-gray-400">
                                {product.format}
                            </div>
                            {typeof product.stock === "number" && (
                                <div className={`text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full ${isSoldOut ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                    {isSoldOut ? "Esgotado" : `Stock: ${product.stock}`}
                                </div>
                            )}
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-4 mb-8">
                            <span className="text-4xl font-serif text-garabandal-dark">
                                {formatPrice(product.price)}
                            </span>
                            <span className="text-gray-400 text-xs uppercase tracking-wider">
                                {formatPrice(breakdown.base)} + {formatPrice(breakdown.vat)} IVA
                            </span>
                        </div>

                        {/* Member Discount Banner */}
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 mb-8">
                            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                                <CreditCard size={18} />
                            </div>
                            <div>
                                <p className="text-blue-900 font-bold text-xs">Membro do Apostolado?</p>
                                <p className="text-blue-600/70 text-[10px]">Tens 5% de desconto em todos os produtos.</p>
                            </div>
                            <Link href="/tornar-membro" className="ml-auto text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:underline">
                                Saber mais
                            </Link>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-10">
                            <button
                                onClick={handleAddToCart}
                                disabled={isSoldOut}
                                className={`flex-1 py-4 rounded-xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 transform
                            ${isSoldOut
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : justAdded
                                            ? 'bg-green-600 text-white shadow-lg shadow-green-600/20 scale-[1.02]'
                                            : 'bg-garabandal-dark text-white hover:bg-black hover:scale-[1.02] shadow-lg shadow-garabandal-dark/20 hover:shadow-2xl'
                                    }
                        `}
                            >
                                {isSoldOut ? (
                                    "Indisponível"
                                ) : justAdded ? (
                                    <>
                                        <Check size={18} />
                                        Adicionado
                                    </>
                                ) : (
                                    <>
                                        <ShoppingCart size={18} />
                                        Adicionar ao Carrinho
                                    </>
                                )}
                            </button>
                            {!isSoldOut && (
                                <button
                                    onClick={handleBuyNow}
                                    className="flex-1 py-4 rounded-xl border-2 border-gray-100 text-garabandal-dark text-sm font-bold uppercase tracking-widest hover:border-garabandal-gold hover:text-white hover:bg-garabandal-gold transition-all duration-300"
                                >
                                    Comprar Agora
                                </button>
                            )}
                        </div>

                        {/* Trust Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-400 mb-8">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <Truck size={16} className="text-garabandal-gold" />
                                <span>Envio seguro para todo o mundo</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <ShieldCheck size={16} className="text-garabandal-gold" />
                                <span>Pagamento 100% Seguro</span>
                            </div>
                        </div>

                        {/* Availability Info */}
                        {product.isPhysical && (
                            <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm text-blue-600">
                                        <Globe size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-sm mb-1">Disponibilidade de Envio</h3>
                                        {product.allowedCountries && product.allowedCountries.length > 0 ? (
                                            <div className="text-sm text-gray-600">
                                                <p className="mb-2">Este produto só pode ser enviado para:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {product.allowedCountries.map(code => {
                                                        const country = listCountryOptions().find(c => c.code === code);
                                                        return (
                                                            <span key={code} className="inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-medium text-gray-700 shadow-sm">
                                                                <span className="mr-1.5 text-xs font-mono text-gray-400">{code}</span>
                                                                {country?.label || code}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-600">
                                                Este produto pode ser enviado para <span className="font-bold text-green-600">todo o mundo</span>.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                    </motion.div>
                </div>

                {/* Suggestions */}
                {relatedProducts.length > 0 && (
                    <section>
                        <div className="flex items-end justify-between mb-10 border-b border-gray-100 pb-6">
                            <h2 className="font-serif text-3xl text-garabandal-dark">Também pode gostar</h2>
                            <Link href="/loja-online" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-garabandal-gold transition-colors">Ver todos</Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                            {relatedProducts.map((item) => (
                                <ProductCard
                                    key={item.id}
                                    product={item}
                                    onClick={() => router.push(`/loja-online/produto/${item.id}`)}
                                    onAddToCart={(e) => {
                                        e.stopPropagation();
                                        addToCart(item.id);
                                    }}
                                />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </StoreLayoutWrapper>
    );
}
