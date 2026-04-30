"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import DashboardShell from '../../components/dashboard/DashboardShell';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { Search, BookOpen, Download, PackageOpen, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

type LibraryItem = {
  id: string;
  orderRef: string;
  productId: string;
  status: string;
  qty: number;
  purchaseCount: number;
  orderCount: number;
  fileUrl: string | null;
  downloadUrl?: string | null;
  createdAt: string;
  firstPurchasedAt?: string;
  lastPurchasedAt?: string;
  lastAccessAt?: string | null;
  downloadCount: number;
  product: {
    name: string;
    image: string;
    format: string;
  };
};

import useSWR from 'swr';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';

const fetchLibrary = async (url: string) => {
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  if (!session) throw new Error("No session");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Erro ao carregar');
  }
  return res.json();
};

export default function BibliotecaPage() {
  const { user, loading: authLoading } = useAuth();
  const { locale } = useLocale();
  const isEn = locale === 'en';
  const formatShortDate = (value?: string | null) => {
    if (!value) return '-';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '-';
    return new Intl.DateTimeFormat(isEn ? 'en-GB' : 'pt-PT', { dateStyle: 'short' }).format(dt);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormat, setFilterFormat] = useState<'all' | 'pdf' | 'epub'>('all');

  // Use SWR for data - conditional fetching
  const { data: payload, error: swrError, isLoading: swrLoading } = useSWR(
    user ? '/api/store/library' : null,
    fetchLibrary,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      shouldRetryOnError: false
    }
  );

  // ... data loaded via SWR ...

  const items: LibraryItem[] = payload?.items || [];
  const loading = authLoading || (!!user && swrLoading);
  const error = swrError?.message;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.orderRef.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFormat = filterFormat === 'all' || item.product.format.toLowerCase() === filterFormat;
      return matchesSearch && matchesFormat;
    });
  }, [items, searchQuery, filterFormat]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <DashboardShell
      title={isEn ? 'Digital Library' : 'Biblioteca Digital'}
      subtitle={isEn ? 'Access your digital books and documents at any time.' : 'Acede aos teus livros e documentos digitais a qualquer momento.'}
    >
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-garabandal-gold border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-center font-bold">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <PackageOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-garabandal-dark mb-2">{isEn ? 'Your shelf is empty' : 'A tua estante está vazia'}</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">{isEn ? 'When you buy a PDF or digital book in our store, it will appear here automatically.' : 'Quando comprares um PDF ou livro digital na nossa loja, ele aparecerá aqui automaticamente.'}</p>
          <Link href={isEn ? '/en/store' : '/loja'} className="px-6 py-3 bg-garabandal-gold text-garabandal-dark font-bold rounded-xl hover:bg-yellow-400 transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {isEn ? 'Explore Online Store' : 'Explorar Loja Online'}
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Search & Stats */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={isEn ? 'Search by title...' : 'Pesquisar por título...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-garabandal-gold focus:ring-garabandal-gold/20 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              <button
                onClick={() => setFilterFormat('all')}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${filterFormat === 'all' ? 'bg-garabandal-dark text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {isEn ? 'All' : 'Todos'}
              </button>
              <button
                onClick={() => setFilterFormat('pdf')}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${filterFormat === 'pdf' ? 'bg-garabandal-dark text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                PDFs
              </button>
            </div>
          </div>

          {/* Grid */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">{isEn ? 'No items found.' : 'Nenhum item encontrado.'}</p>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredItems.map((item) => (
                <motion.article
                  key={item.id}
                  variants={itemVariants}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col h-full"
                >
                  <div className="aspect-[3/4] bg-gray-100 rounded-xl mb-4 overflow-hidden relative">
                    {item.product.image ? (
                      <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <FileText className="w-12 h-12" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-md uppercase">
                      {item.product.format}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="text-xs text-gray-400 font-mono mb-1">{isEn ? 'Last order ref.' : 'Ref. última compra'}: {item.orderRef}</div>
                    <h3 className="font-serif text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">{item.product.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] mb-2">
                      <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-bold">
                        {isEn ? `Purchased ${item.purchaseCount}x` : `Comprado ${item.purchaseCount}x`}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">
                        {item.orderCount} {isEn ? `order${item.orderCount > 1 ? 's' : ''}` : `encomenda${item.orderCount > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {isEn ? 'First purchase' : 'Primeira compra'}: {formatShortDate(item.firstPurchasedAt || item.createdAt)} · {isEn ? 'Last purchase' : 'Última compra'}: {formatShortDate(item.lastPurchasedAt || item.createdAt)}
                    </p>
                    <div className="mt-auto pt-4">
                      {(item.downloadUrl || item.fileUrl) ? (
                        <a
                          href={item.downloadUrl || item.fileUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-garabandal-mist text-garabandal-dark font-bold rounded-xl hover:bg-garabandal-gold hover:text-white transition-all group/btn"
                        >
                          <Download className="w-4 h-4 group-hover/btn:-translate-y-0.5 transition-transform" />
                          {isEn ? 'Download PDF' : 'Baixar PDF'}
                        </a>
                      ) : (
                        <button disabled className="w-full py-2.5 bg-gray-50 text-gray-400 font-bold rounded-xl cursor-not-allowed">
                          {isEn ? 'Unavailable' : 'Indisponível'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
