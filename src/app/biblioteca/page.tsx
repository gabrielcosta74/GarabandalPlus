"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardShell from '../../components/dashboard/DashboardShell';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { Search, Filter, BookOpen, Download, PackageOpen, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type LibraryItem = {
  id: string;
  orderRef: string;
  productId: string;
  status: string;
  qty: number;
  fileUrl: string | null;
  createdAt: string;
  lastAccessAt?: string | null;
  downloadCount: number;
  product: {
    name: string;
    image: string;
    format: string;
  };
};

export default function BibliotecaPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormat, setFilterFormat] = useState<'all' | 'pdf' | 'epub'>('all');
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!supabaseBrowser) {
        setError('Sessão indisponível.');
        setLoading(false);
        return;
      }

      // Retry mechanism for session
      let token = (await supabaseBrowser.auth.getSession()).data.session?.access_token;
      if (!token) {
        await new Promise(r => setTimeout(r, 500));
        token = (await supabaseBrowser.auth.getSession()).data.session?.access_token;
      }

      if (!token) {
        if (mounted) {
          setLoggedIn(false);
          setLoading(false);
          // router.replace('/login?next=/biblioteca');
        }
        return;
      }

      if (mounted) setLoggedIn(true);
      if (mounted) setLoading(true);

      try {
        const res = await fetch('/api/store/library', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || 'Não foi possível carregar a biblioteca.');
        }
        const payload = await res.json();
        if (mounted) {
          setItems(payload.items || []);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Erro ao carregar biblioteca.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [router]);

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
      title="Biblioteca Digital"
      subtitle="Acede aos teus livros e documentos digitais a qualquer momento."
    >
      {!loggedIn ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-garabandal-dark mb-2">Entra para ver os teus PDFs</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">Usa o mesmo email da compra para desbloquear automaticamente os teus conteúdos digitais.</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/login?next=/biblioteca" className="px-6 py-2.5 bg-garabandal-gold text-garabandal-dark font-bold rounded-xl hover:bg-yellow-400 transition-colors">
              Entrar
            </Link>
            <Link href="/register" className="px-6 py-2.5 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              Criar conta
            </Link>
          </div>
        </div>
      ) : loading ? (
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
          <h2 className="font-serif text-2xl font-bold text-garabandal-dark mb-2">A tua estante está vazia</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">Quando comprares um PDF ou livro digital na nossa loja, ele aparecerá aqui automaticamente.</p>
          <Link href="/loja-online" className="px-6 py-3 bg-garabandal-gold text-garabandal-dark font-bold rounded-xl hover:bg-yellow-400 transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Explorar Loja Online
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
                placeholder="Pesquisar por título..."
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
                Todos
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
              <p className="text-gray-400">Nenhum item encontrado.</p>
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
                    <div className="text-xs text-gray-400 font-mono mb-1">Ref. {item.orderRef}</div>
                    <h3 className="font-serif text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">{item.product.name}</h3>
                    <div className="mt-auto pt-4">
                      {item.fileUrl ? (
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-garabandal-mist text-garabandal-dark font-bold rounded-xl hover:bg-garabandal-gold hover:text-white transition-all group/btn"
                        >
                          <Download className="w-4 h-4 group-hover/btn:-translate-y-0.5 transition-transform" />
                          Baixar PDF
                        </a>
                      ) : (
                        <button disabled className="w-full py-2.5 bg-gray-50 text-gray-400 font-bold rounded-xl cursor-not-allowed">
                          Indisponível
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
