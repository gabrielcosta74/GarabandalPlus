"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { loadCart } from '../app/loja-online/data';

type CartItem = {
    id: string;
    qty: number;
};

type Product = {
    id: string;
    name: string;
    price: number;
    currency: string;
    image: string;
};

type CartContextType = {
    cartCount: number;
    cartItems: CartItem[];
    products: Product[];
    refreshCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [cartCount, setCartCount] = useState(0);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const productsCache = useRef<Product[]>([]);

    const refreshCart = useCallback(() => {
        const items = loadCart();
        setCartItems(items);
        const count = items.reduce((sum, item) => sum + item.qty, 0);
        setCartCount(count);
    }, []);

    const loadProducts = useCallback(async () => {
        if (productsCache.current.length > 0) return;

        try {
            const res = await fetch('/api/store/products');
            if (res.ok) {
                const data = await res.json();
                productsCache.current = (data.products || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    currency: p.currency,
                    image: p.image,
                }));
            }
        } catch (err) {
            console.error('Failed to load products:', err);
        }
    }, []);

    useEffect(() => {
        refreshCart();
        loadProducts();

        // Listen for cart updates
        const handleCartUpdate = () => refreshCart();
        const handleStorage = () => refreshCart();

        window.addEventListener('cart:updated', handleCartUpdate as EventListener);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('cart:updated', handleCartUpdate as EventListener);
            window.removeEventListener('storage', handleStorage);
        };
    }, [refreshCart, loadProducts]);

    return (
        <CartContext.Provider value={{
            cartCount,
            cartItems,
            products: productsCache.current,
            refreshCart
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
