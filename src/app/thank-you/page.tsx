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
  const [sessionIdParam, setSessionIdParam] = useState<string | null>(null);
  const [orderRefParam, setOrderRefParam] = useState<string | null>(null);
  const [tokenParam, setTokenParam] = useState<string | null>(null);
  const [statusParam, setStatusParam] = useState<string | null>(null);
  const [canceledParam, setCanceledParam] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<'idle' | 'confirming' | 'done' | 'failed'>('idle');
  const [digitalLinks, setDigitalLinks] = useState<Array<{ name: string; url: string }>>([]);
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState<boolean>(false);
  const [hasDigital, setHasDigital] = useState<boolean | null>(null);
  const [hasPhysical, setHasPhysical] = useState<boolean | null>(null);
  const [reduniqConfirmStatus, setReduniqConfirmStatus] = useState<'idle' | 'confirming' | 'done' | 'failed'>('idle');
  const [reduniqConfirm, setReduniqConfirm] = useState<any | null>(null);

  // --- Logic Preserved from Original ---
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const nextType = (search.get('type') || 'donation').toLowerCase();
    setType(nextType);
    setAmount(search.get('amount'));
    setProvider(search.get('provider'));
    setSessionIdParam(search.get('session_id'));
    setOrderRefParam(search.get('orderRef'));
    setTokenParam(search.get('token'));
    setStatusParam(search.get('status'));
    setCanceledParam(search.get('canceled'));
    setReady(true);
  }, []);

  useEffect(() => {
    if (type !== 'store') return;
    try {
      localStorage.removeItem('store:cart');
      localStorage.removeItem('store:checkout');
    } catch (err) {
      console.warn('Nao foi possivel limpar carrinho.', err);
    }
  }, [type]);

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
        const data = await res.json();
        if (data.digitalDownloadLinks) setDigitalLinks(data.digitalDownloadLinks);
        if (data.buyerEmail) setConfirmedEmail(data.buyerEmail);
        if (typeof data.accountExists === 'boolean') setAccountExists(data.accountExists);
        if (typeof data.hasDigital === 'boolean') setHasDigital(data.hasDigital);
        if (typeof data.hasPhysical === 'boolean') setHasPhysical(data.hasPhysical);
        setConfirmStatus('done');
      } catch (err) {
        console.warn('Nao foi possivel confirmar pagamento da loja:', err);
        setConfirmStatus('failed');
      }
    };
    confirmPayment();
  }, [confirmStatus, provider, ready, sessionIdParam, type]);

  useEffect(() => {
    if (!ready) return;
    if (provider !== 'reduniq') return;
    if (!orderRefParam && !tokenParam) return;
    if (reduniqConfirmStatus !== 'idle') return;

    const confirmReduniq = async () => {
      setReduniqConfirmStatus('confirming');
      try {
        const res = await fetch('/api/reduniq/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(orderRefParam ? { orderRef: orderRefParam } : {}),
            ...(tokenParam ? { token: tokenParam } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || 'Falha ao confirmar pagamento Reduniq.');
        }
        setReduniqConfirm(data);
        setReduniqConfirmStatus('done');
      } catch (err) {
        console.warn('Nao foi possivel confirmar pagamento Reduniq:', err);
        setReduniqConfirmStatus('failed');
      }
    };

    confirmReduniq();
  }, [orderRefParam, provider, ready, reduniqConfirmStatus, tokenParam]);

  // --- UI Helpers ---

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

  const showDigital = type === 'store' && (hasDigital ?? digitalLinks.length > 0);
  const showPhysical = type === 'store' && (hasPhysical ?? false);
  const isStoreConfirming = type === 'store' && confirmStatus === 'confirming';
  const isStoreFailed = type === 'store' && confirmStatus === 'failed';
  const isReduniq = provider === 'reduniq';
  const reduniqTxStatus = reduniqConfirm?.transactionStatus ? String(reduniqConfirm.transactionStatus) : null;
  const hasFailedReturnStatus = statusParam === 'failed' || statusParam === 'error' || statusParam === 'canceled' || canceledParam === 'true';
  const isGenericFailed = hasFailedReturnStatus && provider !== 'reduniq' && type !== 'store';
  const isReduniqPending = isReduniq && reduniqConfirmStatus === 'done' && (reduniqTxStatus === '0' || reduniqTxStatus === '1' || reduniqTxStatus === '2');
  const isReduniqFailed = isReduniq && (reduniqConfirmStatus === 'failed' || (reduniqConfirmStatus === 'done' && reduniqTxStatus === '3') || (reduniqConfirmStatus === 'idle' && hasFailedReturnStatus));
  const isReduniqSuccess = isReduniq && reduniqConfirmStatus === 'done' && reduniqTxStatus === '4';
  const headerFailed = isStoreFailed || isReduniqFailed || isGenericFailed;

  const title = useMemo(() => {
    if (headerFailed) return 'Pagamento Não Concluído';
    if (type === 'membership') return 'Bem-vindo à Família';
    if (type === 'store') return 'Compra Confirmada';
    return 'Obrigado pelo Apoio';
  }, [type, headerFailed]);

  const description = useMemo(() => {
    if (headerFailed) {
      if (type === 'membership') return 'A quota não foi concluída. Podes tentar novamente em segurança.';
      if (type === 'store') return 'A compra não foi concluída. Verifica os dados de pagamento e tenta de novo.';
      return 'A doação não foi concluída. Podes voltar a tentar quando quiseres.';
    }
    if (type === 'membership') return 'A tua quota está ativa. Podes consultar o estado e benefícios na tua área de membro.';
    if (type === 'store') return 'Enviámos um email com os detalhes da tua encomenda. Podes acompanhar o estado na tua área pessoal.';
    return 'O teu donativo ajuda a manter viva a mensagem de Garabandal. Nossa Senhora de Garabandal rogai por nós.';
  }, [type, headerFailed]);

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
              className={`w-24 h-24 rounded-full flex items-center justify-center ${headerFailed ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'} mb-4 relative z-10`}
            >
              {isStoreConfirming || (isReduniq && reduniqConfirmStatus === 'confirming') ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : headerFailed ? (
                <div className="w-10 h-10 font-bold text-3xl">!</div>
              ) : (
                <Check className="w-10 h-10" />
              )}
            </motion.div>

            {/* Pulsing ring behind */}
            {!headerFailed && (
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
          {isReduniq && (
            <div className={`mb-8 rounded-2xl border p-6 ${
              isReduniqFailed
                ? 'border-red-500/30 bg-red-500/10'
                : isReduniqPending || reduniqConfirmStatus === 'confirming'
                  ? 'border-blue-500/30 bg-blue-500/10'
                  : isReduniqSuccess
                    ? 'border-green-500/30 bg-green-500/10'
                    : 'border-white/10 bg-white/5'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${
                  isReduniqFailed ? 'text-red-400' : isReduniqPending || reduniqConfirmStatus === 'confirming' ? 'text-blue-300' : 'text-green-400'
                }`}>
                  {reduniqConfirmStatus === 'confirming' ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">
                    {reduniqConfirmStatus === 'confirming'
                      ? 'A confirmar com a Reduniq...'
                      : isReduniqSuccess
                        ? 'Pagamento confirmado'
                        : isReduniqPending
                          ? 'Pagamento em processamento'
                          : isReduniqFailed
                            ? 'Pagamento não confirmado'
                            : 'Estado do pagamento'}
                  </div>
                  <div className="text-sm text-white/60 mt-1 leading-relaxed">
                    {reduniqConfirmStatus === 'confirming'
                      ? 'Estamos a validar o estado real da transação (via getResult).'
                      : isReduniqSuccess
                        ? 'A transação foi confirmada pela Reduniq.'
                        : isReduniqPending
                          ? 'A transação ainda está em curso. Se for Pagamento de Serviços/MB, pode demorar alguns minutos.'
                          : isReduniqFailed
                            ? 'A transação foi recusada, cancelada ou terminou com erro.'
                            : 'Não foi possível determinar o estado da transação.'}
                  </div>

                  {(orderRefParam || reduniqConfirm?.transactionId) && (
                    <div className="mt-3 text-xs text-white/50 flex flex-wrap gap-3">
                      {orderRefParam && <span>Ref: {orderRefParam}</span>}
                      {reduniqConfirm?.transactionId && <span>Transação: {reduniqConfirm.transactionId}</span>}
                      {reduniqConfirm?.resultCode && <span>Código: {reduniqConfirm.resultCode}</span>}
                    </div>
                  )}

                  {Array.isArray(reduniqConfirm?.extraData) && reduniqConfirm.extraData.length > 0 && (
                    <div className="mt-4 grid md:grid-cols-2 gap-3">
                      {reduniqConfirm.extraData
                        .filter((x: any) => x?.name && x?.value)
                        .slice(0, 6)
                        .map((item: any, idx: number) => (
                          <div key={idx} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{String(item.name)}</div>
                            <div className="text-sm text-white">{String(item.value)}</div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {type === 'store' && (showDigital || showPhysical) && (
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {showDigital && (
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4 text-orange-400">
                    <Download className="w-5 h-5" />
                    <h3 className="font-bold text-white">Produtos Digitais</h3>
                  </div>
                  {confirmedEmail && (
                    <p className="text-white font-medium mb-4">
                      Enviámos o email de acesso para <span className="text-orange-400">{confirmedEmail}</span>.
                    </p>
                  )}
                  <p className="text-sm text-white/40 leading-relaxed mb-4">
                    Pode descarregar os seus ficheiros agora ou aceder mais tarde através do link enviado por email.
                    <strong className="block mt-1 text-white/60">Estes links expiram em 7 dias.</strong>
                  </p>

                  {digitalLinks.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {digitalLinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-full text-center px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Descarregar {link.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {showPhysical && (
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4 text-blue-400">
                    <ShoppingBag className="w-5 h-5" />
                    <h3 className="font-bold text-white">Produtos Físicos</h3>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed">Receberá um email com o tracking assim que a encomenda for expedida pelos nossos serviços.</p>
                </div>
              )}
            </div>
          )}

          {type === 'membership' && !headerFailed && (
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
              <>
                {showDigital && accountExists ? (
                  <Link
                    href="/biblioteca"
                    className="w-full md:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
                  >
                    Abrir Biblioteca
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : null}
                {showPhysical ? (
                  <Link
                    href="/encomendas"
                    className="w-full md:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                  >
                    Ver Encomendas
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : null}
              </>
            ) : type === 'membership' ? (
              headerFailed ? (
                <Link
                  href="/tornar-membro?join=1"
                  className="w-full md:w-auto px-8 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-bold transition-all shadow-lg shadow-yellow-900/20 flex items-center justify-center gap-2"
                >
                  Tentar Novamente
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  href="/member"
                  className="w-full md:w-auto px-8 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-bold transition-all shadow-lg shadow-yellow-900/20 flex items-center justify-center gap-2"
                >
                  Área de Membro
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )
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
