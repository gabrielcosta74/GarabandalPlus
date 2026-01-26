"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { formatCurrency, loadCart } from '../../app/loja-online/data';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShoppingBag,
  Menu,
  X,
  User,
  ChevronDown,
  Package,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Heart,
  Store,
  Home,
  MapPin
} from 'lucide-react';

type CartPreviewItem = {
  id: string;
  qty: number;
  name: string;
  price: number;
  currency: string;
  image: string;
};

/* -------------------------------------------------------------------------- */
/*                                Component                                   */
/* -------------------------------------------------------------------------- */

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  // -- State --
  const { user, isMember, memberData, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartPreview, setCartPreview] = useState<CartPreviewItem[]>([]);
  const [cartPreviewVisible, setCartPreviewVisible] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // -- Refs --
  const productsCache = useRef<CartPreviewItem[]>([]);
  const previewTimer = useRef<number | null>(null);

  // -- Computed --
  const hasMembership = !!memberData?.is_membro;
  const membershipHref = hasMembership ? '/member' : '/tornar-membro';

  /* ------------------------------- Data Logic ------------------------------- */

  // 2. Cart Logic (Sync & Preview)
  useEffect(() => {
    const refreshCartCount = () => {
      const items = loadCart();
      const count = items.reduce((sum, item) => sum + item.qty, 0);
      try { setCartCount(count); } catch { }
    };

    const ensureProducts = async () => {
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
            qty: 0,
          }));
        }
      } catch (err) {
        console.error('Cart products error:', err);
      }
    };

    const buildPreview = async () => {
      await ensureProducts();
      const items = loadCart();
      const preview = items.map(item => {
        const found = productsCache.current.find(p => p.id === item.id);
        if (!found) return null;
        return { ...found, qty: item.qty };
      }).filter(Boolean) as CartPreviewItem[];
      setCartPreview(preview.slice(0, 3));
    };

    const showPreview = async () => {
      await buildPreview();
      setCartPreviewVisible(true);
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = window.setTimeout(() => setCartPreviewVisible(false), 2400);
    };

    // Initial load
    refreshCartCount();
    void buildPreview();

    // Event Listeners
    const handleCartUpdate = () => {
      refreshCartCount();
      void showPreview();
    };
    const handleStorage = () => refreshCartCount();

    window.addEventListener('cart:updated', handleCartUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('cart:updated', handleCartUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  // Logout Handler
  const handleLogout = async () => {
    await signOut();
    setMobileOpen(false);
    setUserMenuOpen(false);
    router.replace('/');
    router.refresh();
  };

  // 3. Scroll Lock for Mobile Menu
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  /* ------------------------------- Renderers -------------------------------- */

  const NavLink = ({ href, icon: Icon, label, onClick }: { href: string; icon?: any; label: string; onClick?: () => void }) => {
    const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));

    return (
      <Link
        href={href}
        onClick={onClick}
        className={`
          group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
          ${isActive
            ? 'bg-yellow-50 text-yellow-700 font-semibold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
          }
        `}
      >
        {Icon && <Icon className={`w-5 h-5 ${isActive ? 'text-yellow-600' : 'text-slate-400 group-hover:text-slate-600'}`} />}
        <span>{label}</span>
        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-600 lg:hidden" />}
      </Link>
    );
  };

  return (
    <>
      {/* 
        MAIN HEADER
        - Always fixed
        - Always white
        - Shadow for depth
      */}
      <header className="fixed top-0 left-0 right-0 z-[100] h-20 bg-white shadow-sm border-b border-slate-100 flex items-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">

          {/* 1. Logo Area */}
          <Link href="/" className="flex items-center gap-2 group z-50 focus:outline-none">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 text-yellow-500 flex items-center justify-center rounded-lg font-serif font-bold text-lg md:text-xl shadow-md group-hover:bg-slate-800 transition-colors">
              G
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg md:text-xl font-bold tracking-tight text-slate-900 leading-tight group-hover:text-yellow-600 transition-colors">
                Garabandal
              </span>
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400">
                Apostolado
              </span>
            </div>
          </Link>

          {/* 2. Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-50 p-1.5 rounded-full border border-slate-100">
            {[
              { href: '/', label: 'Início' },
              { href: '/peregrinacoes', label: 'Peregrinações' },
              { href: '/donations', label: 'Doações' },
              { href: '/loja-online', label: 'Loja' },
              { href: membershipHref, label: hasMembership ? 'Membro' : 'Ser Membro' }
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200
                  ${(pathname === link.href)
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}

            {/* NEW: My Bookings Shortcurt (Desktop) */}
            {user && (
              <Link
                href="/peregrinacoes/minhas-inscricoes"
                className="px-5 py-2 rounded-full text-sm font-bold bg-yellow-50 text-yellow-800 hover:bg-yellow-100 transition-all duration-200 border border-yellow-200/50 flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Minhas Inscrições
              </Link>
            )}
          </div>

          {/* 3. Actions Area (Cart, User, Mobile Toggle) */}
          <div className="flex items-center gap-2 sm:gap-4">

            {/* Cart Button (Always Visible) */}
            <div className="relative group">
              <Link
                href="/loja-online/checkout"
                className="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
                aria-label="Ver Carrinho"
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-yellow-600 text-white text-[10px] font-bold rounded-full shadow-sm ring-2 ring-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* Cart Preview (Desktop Hover) */}
              <div className="absolute top-full right-0 pt-4 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 z-50 lg:block hidden">
                {cartCount > 0 && (
                  <div className="w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Seu Carrinho</span>
                      <span className="text-xs font-bold text-slate-900">{cartCount} items</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {cartPreview.map(item => (
                        <div key={item.id} className="flex gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                          <img src={item.image} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-200/50" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.qty}x {formatCurrency(item.price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-slate-100">
                      <Link href="/loja-online/checkout" className="flex w-full items-center justify-center py-2.5 px-4 bg-yellow-600 text-white text-sm font-bold rounded-xl hover:bg-yellow-700 transition-colors shadow-lg shadow-yellow-900/10">
                        Finalizar Compra
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User Menu (Desktop) */}
            <div className="hidden lg:block min-w-[140px]">
              {mounted && (
                <>
                  {user ? (
                    <div className="relative">
                      <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="flex items-center gap-2 pl-1 pr-3 py-1 bg-white border border-slate-200 rounded-full hover:border-slate-300 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs">
                          {user.email?.[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-700 max-w-[100px] truncate">
                          {user.email?.split('@')[0]}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>

                      <AnimatePresence>
                        {userMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
                            >
                              <div className="p-4 bg-slate-50 border-b border-slate-100">
                                <p className="font-bold text-slate-900 truncate">{user.email}</p>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isMember ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-200 text-slate-600'}`}>
                                  {isMember ? 'Membro Ativo' : 'Visitante'}
                                </span>
                              </div>
                              <div className="p-2 space-y-1">
                                <Link href="/peregrinacoes/minhas-inscricoes" className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-yellow-800 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors mb-2">
                                  <Package className="w-4 h-4" /> Minhas Inscrições
                                </Link>

                                <Link href="/account/profile" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors">
                                  <User className="w-4 h-4" /> Perfil
                                </Link>
                                <Link href="/encomendas" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors">
                                  <ShoppingBag className="w-4 h-4" /> Minhas Compras (Loja)
                                </Link>
                                {isMember && (
                                  <Link href="/member" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-yellow-600 bg-yellow-50/50 hover:bg-yellow-50 rounded-lg transition-colors">
                                    <LayoutDashboard className="w-4 h-4" /> Área de Membro
                                  </Link>
                                )}

                                {/* ADMIN LINK */}
                                {(user.email?.toLowerCase() === 'geral@apostoladodegarabandal.com' || user.email === 'Gabrielcosta2908@gmail.com') && (
                                  <Link href="/admin" className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors mt-1">
                                    <LayoutDashboard className="w-4 h-4" /> Painel Admin
                                  </Link>
                                )}
                                <div className="h-px bg-slate-100 my-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLogout();
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                                >
                                  <LogOut className="w-4 h-4" /> Sair da conta
                                </button>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : !loading && (
                    <div className="flex items-center gap-3">
                      <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-slate-900">
                        Entrar
                      </Link>
                      <Link
                        href="/register"
                        className="px-5 py-2.5 text-white text-sm font-bold rounded-full shadow-lg shadow-yellow-900/20 transition-all hover:scale-105"
                        style={{ backgroundColor: '#ca8a04' }}
                      >
                        Criar Conta
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
              aria-label="Abrir Menu"
            >
              <Menu className="w-7 h-7" />
            </button>
          </div>
        </div>
      </header>

      {/* 
        MOBILE MENU DRAWER 
        - Full screen overlay with z-index manipulation
        - Slide-in from right
      */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm lg:hidden"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[160] w-[85vw] max-w-[340px] bg-white shadow-2xl lg:hidden flex flex-col"
            >
              {/* Drawer Header */}
              <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                <span className="font-serif text-xl font-bold text-slate-900">Menu</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 -mr-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
                {/* Public Links */}
                <div className="space-y-1 mb-8">
                  <NavLink href="/" icon={Home} label="Início" onClick={() => setMobileOpen(false)} />
                  <NavLink href="/peregrinacoes" icon={MapPin} label="Peregrinações" onClick={() => setMobileOpen(false)} />
                  <NavLink href="/donations" icon={Heart} label="Doações" onClick={() => setMobileOpen(false)} />
                  <NavLink href="/loja-online" icon={Store} label="Loja" onClick={() => setMobileOpen(false)} />
                </div>

                {user && (
                  <div className="space-y-1 mb-6 bg-yellow-50/50 p-2 rounded-xl border border-yellow-100">
                    <p className="text-xs font-bold text-yellow-800 uppercase tracking-widest px-4 mb-2">A Minha Área</p>
                    <NavLink href="/peregrinacoes/minhas-inscricoes" icon={Package} label="Minhas Inscrições" onClick={() => setMobileOpen(false)} />
                    <NavLink href="/encomendas" icon={ShoppingBag} label="Compras da Loja" onClick={() => setMobileOpen(false)} />
                  </div>
                )}

                {/* Member Area */}
                <div className="space-y-1 mb-8">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-3">Membros & Orações</p>
                  {hasMembership ? (
                    <>
                      <NavLink href="/member" icon={LayoutDashboard} label="Painel de Membro" onClick={() => setMobileOpen(false)} />
                      <NavLink href="/member/prayers" icon={CreditCard} label="Orações e Novenas" onClick={() => setMobileOpen(false)} />
                    </>
                  ) : (
                    <Link
                      href="/tornar-membro"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-50 text-yellow-700 font-bold hover:bg-yellow-100 transition-colors"
                    >
                      <CreditCard className="w-5 h-5" />
                      Tornar-se Membro
                    </Link>
                  )}
                </div>

                {/* User Section */}
                <div className="pt-6 border-t border-slate-100">
                  {user ? (
                    <div className="bg-slate-50 rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold">
                          {user.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-bold text-slate-900 truncate">{user.email}</p>
                          <p className="text-xs text-slate-500">{isMember ? 'Membro' : 'Visitante'}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Link href="/account/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg">
                          <User className="w-4 h-4" /> Meu Perfil
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Terminar Sessão
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href="/login"
                        onClick={() => setMobileOpen(false)}
                        className="flex justify-center py-3 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Entrar
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setMobileOpen(false)}
                        className="flex justify-center py-3 rounded-xl font-bold text-white shadow-sm"
                        style={{ backgroundColor: '#ca8a04' }}
                      >
                        Criar Conta
                      </Link>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence >
    </>
  );
}
