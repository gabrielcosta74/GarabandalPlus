"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Download, Home, ArrowRight, Loader2, CreditCard, ShoppingBag, ShieldCheck, Heart } from 'lucide-react';

export default function ThankYouPage() {
  const [ready, setReady] = useState(false);
  const [type, setType] = useState('donation');
  const [amount, setAmount] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [statusParam, setStatusParam] = useState<string | null>(null);
  const [tokenParam, setTokenParam] = useState<string | null>(null);
  const [sessionIdParam, setSessionIdParam] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<'idle' | 'confirming' | 'done' | 'failed'>('idle');
  const [reduniqStatus, setReduniqStatus] = useState<'idle' | 'checking' | 'success' | 'pending' | 'failed' | 'unknown'>('idle');

  // --- Logic Preserved from Original ---
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const nextType = (search.get('type') || 'donation').toLowerCase();
    setType(nextType);
    setAmount(search.get('amount'));
    setProvider(search.get('provider'));
    setStatusParam(search.get('status'));
    setTokenParam(search.get('token'));
    setSessionIdParam(search.get('session_id'));
    setReady(true);
  }, []);

  useEffect(() => {
    if (provider !== 'reduniq') return;
    const stored = typeof window !== 'undefined' ? localStorage.getItem('reduniq:lastPayment') : null;
    let storedToken: string | null = null;
    if (stored) {
      try {
        storedToken = JSON.parse(stored)?.token || null;
      } catch {
        storedToken = null;
      }
    }
    const token = tokenParam || storedToken;
    if (!token) {
      setReduniqStatus(statusParam === 'error' ? 'failed' : 'unknown');
      return;
    }
    const checkResult = async () => {
      setReduniqStatus('checking');
      try {
        const res = await fetch('/api/reduniq/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error('Falha ao confirmar pagamento.');
        const data = await res.json();
        const status = (data?.status as 'success' | 'pending' | 'failed' | 'unknown') || 'unknown';
        setReduniqStatus(status === 'unknown' ? 'pending' : status);
      } catch (err) {
        console.warn('Não foi possível confirmar pagamento Reduniq:', err);
        setReduniqStatus(statusParam === 'error' ? 'failed' : 'pending');
      }
    };
    checkResult();
  }, [provider, statusParam, tokenParam]);

  useEffect(() => {
    if (type !== 'store') return;
    if (provider === 'reduniq' && reduniqStatus !== 'success') return;
    try {
      localStorage.removeItem('store:cart');
      localStorage.removeItem('store:checkout');
    } catch (err) {
      console.warn('Nao foi possivel limpar carrinho.', err);
    }
  }, [provider, reduniqStatus, type]);

  useEffect(() => {
    if (!ready) return;
    if (type !== 'store' || provider !== 'stripe') return;
    if (!sessionIdParam || confirmStatus !== 'idle') return;
    const confirmPayment = async () => {
      setConfirmStatus('confirming');
      try {
        const res = await fetch('/api/store/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionIdParam }),
        });
        if (!res.ok) throw new Error('Falha ao confirmar compra.');
        setConfirmStatus('done');
      } catch (err) {
        console.warn('Nao foi possivel confirmar pagamento da loja:', err);
        setConfirmStatus('failed');
      }
    };
    confirmPayment();
  }, [confirmStatus, provider, ready, sessionIdParam, type]);

  // --- UI Helpers ---

  const title = useMemo(() => {
    if (provider === 'reduniq') {
      if (reduniqStatus === 'failed') return 'Pagamento Incompleto';
      if (reduniqStatus === 'pending' || reduniqStatus === 'checking') return 'Processando Pagamento...';
      if (reduniqStatus === 'unknown') return 'Verifique o Estado';
      if (type === 'membership') return 'Quota Regularizada';
      if (type === 'store') return 'Compra Efetuada';
      return 'Donativo Recebido';
    }
    if (type === 'membership') return 'Bem-vindo à Família';
    if (type === 'store') return 'Compra Confirmada';
    return 'Obrigado pelo Apoio';
  }, [provider, reduniqStatus, type]);

  const description = useMemo(() => {
    if (provider === 'reduniq') {
      if (reduniqStatus === 'failed') return 'Houve um problema com a transação. Por favor, tente novamente ou contacte o suporte.';
      if (reduniqStatus === 'pending' || reduniqStatus === 'checking') return 'Estamos a aguardar confirmação do banco. Se usou MB Way, verifique o seu telemóvel.';
      if (reduniqStatus === 'unknown') return 'Pagamento registado. Aguarde o email de confirmação.';
    }
    if (type === 'membership') return 'A tua quota está ativa. Podes consultar o estado e benefícios na tua área de membro.';
    if (type === 'store') return 'Enviámos um email com os detalhes da tua encomenda. Podes acompanhar o estado na tua área pessoal.';
    return 'O teu donativo ajuda a manter viva a mensagem de Garabandal. Nossa Senhora de Garabandal rogai por nós.';
  }, [provider, reduniqStatus, type]);

  const amountText = useMemo(() => {
    if (!amount) return null;
    const num = Number(amount);
    if (!Number.isFinite(num)) return null;
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(num);
  }, [amount]);

  const AccentIcon = useMemo(() => {
    if (type === 'store') return ShoppingBag;
    if (type === 'membership') return ShieldCheck;
    return Heart;
  }, [type]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden text-slate-200">

      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-900/20 rounded-full blur-[120px] opacity-50" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] opacity-30" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl bg-[#111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header Status */}
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#111] p-10 text-center border-b border-white/5 relative">

          {/* Success Icon Animation */}
          <div className="mb-6 relative inline-block">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className={`w-24 h-24 rounded-full flex items-center justify-center ${reduniqStatus === 'failed' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'} mb-4 relative z-10`}
            >
              {reduniqStatus === 'checking' || confirmStatus === 'confirming' ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : reduniqStatus === 'failed' ? (
                <div className="w-10 h-10 font-bold text-3xl">!</div>
              ) : (
                <Check className="w-10 h-10" />
              )}
            </motion.div>

            {/* Pulsing ring behind */}
            {!(reduniqStatus === 'failed') && (
              <motion.div
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-green-500/20 rounded-full z-0"
              />
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-white/50 mb-4">
              Confirmação
            </span>
            <h1 className="text-3xl md:text-4xl font-serif text-white mb-4">{title}</h1>
            <p className="text-white/60 text-lg max-w-lg mx-auto leading-relaxed">{description}</p>

            {amountText && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className="text-2xl font-bold text-white">{amountText}</div>
                <div className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/60 uppercase tracking-widest font-bold">Total</div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Details / Next Steps */}
        <div className="p-8 md:p-10 bg-[#111]">

          {type === 'store' && (
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3 mb-4 text-orange-400">
                  <Download className="w-5 h-5" />
                  <h3 className="font-bold text-white">Produtos Digitais</h3>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">Verifique o seu email para os links de descarga ou aceda diretamente à sua Biblioteca na app.</p>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3 mb-4 text-blue-400">
                  <ShoppingBag className="w-5 h-5" />
                  <h3 className="font-bold text-white">Produtos Físicos</h3>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">Receberá um email com o tracking assim que a encomenda for expedida pelos nossos serviços.</p>
              </div>
            </div>
          )}

          {type === 'membership' && (
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 mb-8 flex items-start gap-4">
              <div className="p-3 bg-yellow-500/20 rounded-xl text-yellow-500">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Membro Oficial</h3>
                <p className="text-sm text-white/40 leading-relaxed max-w-md">O seu estado de sócio foi atualizado. Agora tem acesso a todos os conteúdos exclusivos e benefícios.</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="w-full md:w-auto px-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Página Inicial
            </Link>

            {type === 'store' ? (
              <Link
                href="/biblioteca"
                className="w-full md:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
              >
                Abrir Biblioteca
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : type === 'membership' ? (
              <Link
                href="/member"
                className="w-full md:w-auto px-8 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-bold transition-all shadow-lg shadow-yellow-900/20 flex items-center justify-center gap-2"
              >
                Área de Membro
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/donations"
                className="w-full md:w-auto px-8 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-all shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2"
              >
                Ver Campanha
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

        </div>

      </motion.div>
    </main>
  );
}
