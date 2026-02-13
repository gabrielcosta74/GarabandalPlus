"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ShoppingBag, ArrowLeft, Truck, Package, Info, AlertCircle, ShoppingCart, Check, Download, Globe } from 'lucide-react';
import { Product, loadCart, saveCart, CartItem } from '../../loja-online/data';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import AddToCartModal from '../../../components/store/AddToCartModal';
import { inferIsDigitalProduct } from '../../../lib/product-kind';
import { listCountryOptions } from '../../../lib/country-utils';

export default function ProductDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<any>(null);
    const [adding, setAdding] = useState(false);
    const [qty, setQty] = useState(1);
    const [showAddModal, setShowAddModal] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

    useEffect(() => {
        if (id) fetchProduct(id);
    }, [id]);

    const fetchProduct = async (productId: string) => {
        try {
            const res = await fetch(`/api/store/products/${productId}?t=${Date.now()}`, {
                cache: 'no-store'
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            // Assuming data.product contains the product details and needs mapping
            const productData = {
                ...data.product, // Keep existing properties from data.product
                categoryId: data.product.category_id,
                is_physical: data.product.is_physical ?? data.product.isPhysical,
                isPhysical: data.product.isPhysical ?? data.product.is_physical,
                type_id: data.product.type_id,
                metadata: data.product.metadata || {},
                stock: data.product.stock,
                allowedCountries: data.product.allowed_countries || data.product.allowedCountries || [],
                variants: data.product.variants || data.product.product_variants || [],
            };
            const isDigital = inferIsDigitalProduct({
                isPhysical: productData.isPhysical,
                typeId: productData.type_id,
                category: productData.category,
                name: productData.name,
                digitalUrl: (productData as any).digitalUrl,
            });
            productData.type = isDigital ? 'digital' : 'fisico';
            setProduct(productData);

            // Auto-select first variant if exists
            if (productData.variants && productData.variants.length > 0) {
                // Find first in-stock variant
                const firstInStock = productData.variants.find((v: any) => v.stock > 0);
                setSelectedVariant(firstInStock || productData.variants[0]);
            }
        } catch (err) {
            console.error(err);
            setError(true);
            toast.error("Produto não encontrado");
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = async () => {
        if (!product) return;

        // Check variant selection
        if (product.variants && product.variants.length > 0 && !selectedVariant) {
            toast.warning("Por favor selecione uma opção.");
            return;
        }

        setAdding(true);

        const prev = loadCart();
        const variantId = selectedVariant ? selectedVariant.sku : undefined;

        // Find existing item
        const existingIndex = prev.findIndex(item => item.id === product.id && (item as any).variantId === variantId);

        let next;
        if (existingIndex >= 0) {
            next = [...prev];
            next[existingIndex] = { ...next[existingIndex], qty: next[existingIndex].qty + qty };
        } else {
            const newItem: CartItem & { variantId?: string; variantName?: string } = {
                id: product.id,
                qty: qty,
                variantId: variantId,
                variantName: selectedVariant?.name
            };
            next = [...prev, newItem];
        }

        saveCart(next);

        // Fetch related products for upsell (simple random logic for now)
        try {
            const res = await fetch(`/api/store/products?includeVariants=0&t=${Date.now()}`, {
                cache: 'no-store'
            });
            const data = await res.json();
            const others = (data.products || []).filter((p: any) => p.id !== product.id).sort(() => 0.5 - Math.random()).slice(0, 2);
            setRelatedProducts(others);
        } catch (e) { console.error(e) }

        setTimeout(() => {
            setAdding(false);
            setShowAddModal(true);
            // toast.success("Adicionado ao carrinho"); // Replaced by Modal
        }, 500);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white pb-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                        <div className="aspect-[4/5] bg-slate-100 rounded-3xl animate-pulse" />
                        <div className="space-y-8 py-4">
                            <div className="space-y-4">
                                <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                                <div className="h-10 w-3/4 bg-slate-100 rounded animate-pulse" />
                                <div className="h-8 w-32 bg-slate-100 rounded animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                                <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                                <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <Package className="w-8 h-8 text-slate-300" />
                </div>
                <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">Produto não encontrado</h1>
                <p className="text-slate-500 mb-8 max-w-md">
                    O produto que procura pode ter sido removido ou o link está incorreto.
                </p>
                <button
                    onClick={() => router.push('/loja')}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                    Voltar à Loja
                </button>
            </div>
        );
    }

    // Robust type detection to avoid mixed messaging (digital vs physical vs clothing)
    const normalizeText = (value: unknown) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    const normalizedTypeId = normalizeText(product.type_id);
    const normalizedCategory = normalizeText(product.category);
    const isClothing =
        normalizedTypeId === 'clothing' ||
        normalizedTypeId.includes('apparel') ||
        normalizedCategory.includes('vestu') ||
        normalizedCategory.includes('roupa');
    const isDigital = inferIsDigitalProduct({
        isPhysical: product.isPhysical ?? product.is_physical,
        typeId: product.type_id,
        category: product.category,
        name: product.name,
        digitalUrl: (product as any).digitalUrl,
    });
    const productMode: 'digital' | 'clothing' | 'physical' =
        isDigital ? 'digital' : isClothing ? 'clothing' : 'physical';

    // Fallback for stock check
    const currentStock = selectedVariant ? selectedVariant.stock : product.stock;
    const totalVariantStock = product.variants?.reduce((acc: number, v: any) => acc + (v.stock || 0), 0) || 0;
    const hasStock = product.variants && product.variants.length > 0
        ? totalVariantStock > 0
        : (product.stock ?? 0) > 0;

    const isOutOfStock = productMode !== 'digital' && !hasStock;
    const isBook = product.type_id?.includes('book') || product.category?.includes('Livro');
    const countryOptions = listCountryOptions();
    const allowedCountryLabels = (product.allowedCountries || [])
        .map((code) => {
            const country = countryOptions.find((c) => c.code === code);
            return { code, label: country?.label || code };
        });

    return (
        <div className="min-h-screen bg-white pb-20">
            {/* Nav Back */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <button onClick={() => router.push('/loja')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium text-sm group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Voltar à loja
                </button>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">

                    {/* Image Gallery */}
                    <div className="space-y-4 -mx-4 sm:mx-0">
                        {/* Mobile: Edge to edge image */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="aspect-square md:aspect-[4/5] bg-slate-50 md:rounded-3xl overflow-hidden border-b md:border border-slate-100 flex items-center justify-center p-8 relative"
                        >
                            {product.image ? (
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="(min-width: 1024px) 50vw, 100vw"
                                    className="object-contain drop-shadow-xl mix-blend-multiply"
                                />
                            ) : (
                                <ShoppingBag className="w-20 h-20 text-slate-200" />
                            )}
                            {isDigital && (
                                <div className="absolute top-6 left-6 flex flex-col gap-2">
                                    <div className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm w-fit">
                                        Download Imediato
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Product Info */}
                    <div className="space-y-8 py-4">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-amber-600 font-bold uppercase tracking-wider text-xs">
                                    {product.category || 'Geral'}
                                </span>
                                {product.tag && (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">
                                        {product.tag}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 leading-tight mb-4">
                                {product.name}
                            </h1>
                            <div className="flex items-baseline gap-4">
                                <p className="text-3xl font-light text-slate-900">
                                    {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: product.currency }).format(product.price)}
                                </p>
                                {product.taxRate && product.taxRate > 0 && <span className="text-xs text-slate-400 font-medium">IVA incluído</span>}
                            </div>
                        </div>

                        {/* TECHNICAL DETAILS (Dynamic Metadata) */}
                        {product.metadata && Object.keys(product.metadata).length > 0 && (
                            <div className="flex flex-wrap gap-y-3 gap-x-8 text-sm text-slate-600 mb-8 border-y border-slate-200 py-6">
                                {Object.entries(product.metadata).map(([key, value]) => {
                                    if (!value) return null;
                                    let label = key;
                                    // Map common keys to nicer labels
                                    switch (key) {
                                        case 'author': label = 'Autor'; break;
                                        case 'publisher': label = 'Editora'; break;
                                        case 'isbn': label = 'ISBN'; break;
                                        case 'pages': label = 'Páginas'; break;
                                        case 'material': label = 'Material'; break;
                                        case 'gender': label = 'Género'; break;
                                        case 'dimensions': label = 'Dimensões'; break;
                                        case 'weight_g': label = 'Peso'; break;
                                        case 'format': label = 'Formato'; break;
                                        case 'care_instructions': label = 'Cuidados'; break;
                                    }
                                    return (
                                        <div key={key} className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900 capitalize">{label}:</span>
                                            <span className={key === 'isbn' ? 'font-mono' : ''}>
                                                {value as React.ReactNode}
                                                {key === 'weight_g' ? 'g' : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="prose prose-slate prose-lg text-slate-500 leading-relaxed max-w-none">
                            <p>{product.description}</p>
                        </div>

                        {/* Variants Selector */}
                        {product.variants && product.variants.length > 0 ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <label className="block text-xs font-bold uppercase text-slate-500">
                                        {isClothing ? 'Tamanho' : 'Opção'}
                                    </label>
                                    {!isDigital && selectedVariant && (
                                        <motion.span
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                            className={`text-xs font-bold ${selectedVariant.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}
                                        >
                                            {selectedVariant.stock > 0 ? (selectedVariant.stock < 10 ? `Restam ${selectedVariant.stock}` : 'Em Stock') : 'Esgotado'}
                                        </motion.span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {product.variants.map((v: any) => (
                                        <button
                                            key={v.sku}
                                            onClick={() => setSelectedVariant(v)}
                                            disabled={!isDigital && v.stock === 0}
                                            className={`h-12 min-w-[3.5rem] px-4 rounded-xl border-2 text-sm font-bold transition-all relative overflow-hidden flex items-center justify-center
                                                ${selectedVariant?.sku === v.sku
                                                    ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10 scale-105'
                                                    : (!isDigital && v.stock === 0)
                                                        ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed decoration-slate-300'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                                                }
                                            `}
                                        >
                                            {v.name}
                                            {!isDigital && v.stock === 0 && <div className="absolute inset-0 bg-white/40 rotate-45 transform translate-y-1/2" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : isClothing ? (
                            // Fallback for clothing without variants: Explicit "Single Size" selector
                            <div className="space-y-4">
                                <label className="block text-xs font-bold uppercase text-slate-500">Tamanho</label>
                                <button
                                    onClick={() => setSelectedVariant({ name: 'Único', stock: product.stock, sku: product.id })}
                                    className={`h-12 px-6 rounded-xl border-2 text-sm font-bold transition-all relative overflow-hidden flex items-center justify-center
                                        ${selectedVariant?.sku === product.id
                                            ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                                        }`}
                                >
                                    Tamanho Único
                                </button>
                            </div>

                        ) : null}
                        <div className="pt-6 border-t border-slate-100 space-y-4">
                            {isOutOfStock ? (
                                <div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl border border-red-100 flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <div>
                                        <p className="font-bold text-sm uppercase tracking-wide">Esgotado</p>
                                        <p className="text-sm opacity-80">Este artigo não está disponível de momento.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop Add to Cart */}
                                    {!isOutOfStock && (
                                        <div className="hidden lg:flex gap-4">
                                            {/* Quantity Qty */}
                                            {(!product.variants || product.variants.length === 0) && (
                                                <div className="flex items-center border border-slate-200 rounded-xl px-2">
                                                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-2 text-slate-400 hover:text-slate-900">-</button>
                                                    <span className="w-8 text-center font-bold text-slate-900">{qty}</span>
                                                    <button onClick={() => setQty(qty + 1)} className="p-2 text-slate-400 hover:text-slate-900">+</button>
                                                </div>
                                            )}

                                            <button
                                                onClick={handleAddToCart}
                                                disabled={adding}
                                                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all hover:shadow-xl hover:shadow-slate-900/10 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {adding ? (
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <ShoppingCart className="w-5 h-5" />
                                                        Adicionar ao Carrinho
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                </>
                            )}

                            {/* Features / Assurance */}
                            <div className="grid grid-cols-2 gap-4 mt-8">
                                {productMode === 'digital' ? (
                                    <>
                                        <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                                            <Download className="w-5 h-5 text-purple-500" />
                                            <span className="text-xs font-bold text-purple-800">Acesso Digital Imediato</span>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <Check className="w-5 h-5 text-slate-400" />
                                            <span className="text-xs font-bold text-slate-600">Disponível na tua Biblioteca</span>
                                        </div>
                                    </>
                                ) : productMode === 'clothing' ? (
                                    <>
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <Package className="w-5 h-5 text-slate-400" />
                                            <span className="text-xs font-bold text-slate-600">Seleção de Tamanho/Variante</span>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <Truck className="w-5 h-5 text-slate-400" />
                                            <span className="text-xs font-bold text-slate-600">
                                                {product.allowedCountries && product.allowedCountries.length > 0
                                                    ? 'Envio para países selecionados'
                                                    : 'Envio protegido'}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <Package className="w-5 h-5 text-slate-400" />
                                            <span className="text-xs font-bold text-slate-600">Embalamento Seguro</span>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <Truck className="w-5 h-5 text-slate-400" />
                                            <span className="text-xs font-bold text-slate-600">
                                                {product.allowedCountries && product.allowedCountries.length > 0
                                                    ? 'Envio para países selecionados'
                                                    : 'Envio para todo o Mundo'}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {productMode !== 'digital' && (
                                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                                    <div className="flex items-start gap-3">
                                        <Globe className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-900">Disponibilidade de Stock por País</p>
                                            {allowedCountryLabels.length > 0 ? (
                                                <>
                                                    <p className="text-sm text-slate-700 mt-1">
                                                        Stock disponível para envio apenas nos seguintes países:
                                                    </p>
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {allowedCountryLabels.map((country) => (
                                                            <span
                                                                key={country.code}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-blue-100 text-xs font-medium text-slate-700"
                                                            >
                                                                <span className="font-mono text-slate-400">{country.code}</span>
                                                                <span>{country.label}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-sm text-slate-700 mt-1">
                                                    Stock disponível para envio internacional (todos os países).
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Specs Table */}
                        {product.specifications && Object.keys(product.specifications).length > 0 && (
                            <div className="pt-8 border-t border-slate-100">
                                <h3 className="font-serif font-bold text-lg mb-4">
                                    {isBook ? 'Detalhes da Obra' : 'Detalhes Técnicos'}
                                </h3>
                                <div className="space-y-3">
                                    {Object.entries(product.specifications).map(([key, val]: [string, any]) => (
                                        <div key={key} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
                                            <span className="text-sm font-medium text-slate-500 capitalize">
                                                {key === 'author' ? 'Autor' :
                                                    key === 'pages' ? 'Páginas' :
                                                        key === 'publisher' ? 'Editora' :
                                                            key === 'isbn' ? 'ISBN' :
                                                                key.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
            {product && (
                <>
                    {/* Mobile Sticky Footer */}
                    {!isOutOfStock && (
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 lg:hidden z-[100] shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.1)] safe-area-bottom">
                            <div className="flex gap-3">
                                <button
                                    onClick={handleAddToCart}
                                    disabled={adding}
                                    className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                                >
                                    {adding ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Adicionar ao Carrinho'}
                                </button>
                            </div>
                        </div>
                    )}

                    <AddToCartModal
                        isOpen={showAddModal}
                        onClose={() => setShowAddModal(false)}
                        product={product}
                        variantName={selectedVariant?.name}
                        relatedProducts={relatedProducts}
                    />
                </>
            )}
        </div>
    );
}
