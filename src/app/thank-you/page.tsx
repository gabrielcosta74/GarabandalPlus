"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Download, Home, ArrowRight, Loader2, CreditCard, ShoppingBag, ShieldCheck, Heart, Mail, ScrollText } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import { captureStoreEvent } from '../../lib/analytics';

export default function ThankYouPage() {
  const { refreshMemberData } = useAuth();
  const { locale } = useLocale();
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
  const [memberNumber, setMemberNumber] = useState<number | null>(null);
  const [memberEmail, setMemberEmail] = useState<string | null>(null);
  const isEn = locale === 'en';
  const homePath = isEn ? '/en' : '/';
  const loginPath = isEn ? '/en/login' : '/login';
  const libraryPath = isEn ? '/en/library' : '/biblioteca';
  const ordersPath = isEn ? '/en/orders' : '/encomendas';
  const memberPath = isEn ? '/en/member' : '/member';
  const rightsPath = isEn ? '/en/member/rights-duties' : '/member/direitos-deveres';
  const membershipRetryPath = isEn ? '/en/become-member?join=1' : '/tornar-membro?join=1';
  const donationsPath = isEn ? '/en/donations' : '/donations';

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
    if (!ready || type !== 'store') return;
    const key = `analytics:store:return:${provider || ''}:${sessionIdParam || orderRefParam || statusParam || ''}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    captureStoreEvent('store_payment_returned', {
      provider: provider || null,
      status: statusParam || null,
      canceled: canceledParam === 'true',
      amount: amount ? Number(amount) : null,
      locale,
    });
  }, [amount, canceledParam, locale, orderRefParam, provider, ready, sessionIdParam, statusParam, type]);

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
    if (!ready || type !== 'store' || provider !== 'stripe') return;
    if (confirmStatus !== 'done' && confirmStatus !== 'failed') return;
    const key = `analytics:store:stripe:${confirmStatus}:${sessionIdParam || ''}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    captureStoreEvent(confirmStatus === 'done' ? 'store_purchase_completed' : 'store_purchase_failed', {
      provider: 'stripe',
      amount: amount ? Number(amount) : null,
      has_digital: hasDigital,
      has_physical: hasPhysical,
      locale,
    });
  }, [amount, confirmStatus, hasDigital, hasPhysical, locale, provider, ready, sessionIdParam, type]);

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
        if (Array.isArray(data?.digitalDownloadLinks)) setDigitalLinks(data.digitalDownloadLinks);
        if (typeof data?.buyerEmail === 'string' && data.buyerEmail) setConfirmedEmail(data.buyerEmail);
        if (typeof data?.accountExists === 'boolean') setAccountExists(data.accountExists);
        if (typeof data?.hasDigital === 'boolean') setHasDigital(data.hasDigital);
        if (typeof data?.hasPhysical === 'boolean') setHasPhysical(data.hasPhysical);
        setReduniqConfirm(data);
        setReduniqConfirmStatus('done');
      } catch (err) {
        console.warn('Nao foi possivel confirmar pagamento Reduniq:', err);
        setReduniqConfirmStatus('failed');
      }
    };

    confirmReduniq();
  }, [orderRefParam, provider, ready, reduniqConfirmStatus, tokenParam]);

  useEffect(() => {
    if (!ready || type !== 'store' || provider !== 'reduniq') return;
    if (reduniqConfirmStatus !== 'done' && reduniqConfirmStatus !== 'failed') return;
    const transactionStatus = reduniqConfirm?.transactionStatus ? String(reduniqConfirm.transactionStatus) : null;
    const isSuccess = reduniqConfirmStatus === 'done' && transactionStatus === '4';
    const key = `analytics:store:reduniq:${reduniqConfirmStatus}:${transactionStatus || ''}:${orderRefParam || tokenParam || ''}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    captureStoreEvent(isSuccess ? 'store_purchase_completed' : 'store_purchase_failed', {
      provider: 'reduniq',
      amount: amount ? Number(amount) : null,
      transaction_status: transactionStatus,
      has_digital: hasDigital,
      has_physical: hasPhysical,
      locale,
    });
  }, [amount, hasDigital, hasPhysical, locale, orderRefParam, provider, ready, reduniqConfirm, reduniqConfirmStatus, tokenParam, type]);

  useEffect(() => {
    if (!ready || type !== 'membership') return;
    if (provider === 'reduniq' && reduniqConfirmStatus !== 'done') return;
    const loadMemberContext = async () => {
      try {
        if (!supabaseBrowser) return;
        const { data: userData } = await supabaseBrowser.auth.getUser();
        const user = userData?.user;
        if (!user?.id) return;

        if (user.email) setMemberEmail(user.email);

        const { data: member } = await supabaseBrowser
          .from('membros')
          .select('numero_socio, nome, email')
          .eq('id', user.id)
          .maybeSingle();

        if (member?.numero_socio) setMemberNumber(Number(member.numero_socio));
        if (member?.email) setMemberEmail(String(member.email));

        // Refresh AuthContext so navbar updates immediately
        await refreshMemberData();
      } catch (err) {
        // Non-blocking for confirmation screen.
      }
    };
    loadMemberContext();
  }, [provider, ready, reduniqConfirmStatus, type, refreshMemberData]);

  // --- UI Helpers ---

  const amountText = useMemo(() => {
    if (!amount) return null;
    const num = Number(amount);
    if (!Number.isFinite(num)) return null;
    return new Intl.NumberFormat(isEn ? 'en-GB' : 'pt-PT', { style: 'currency', currency: 'EUR' }).format(num);
  }, [amount, isEn]);

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
    if (headerFailed) return isEn ? 'Payment Not Completed' : 'Pagamento Não Concluído';
    if (type === 'membership') return isEn ? 'Welcome to the Family' : 'Bem-vindo à Família';
    if (type === 'store') return isEn ? 'Order Confirmed' : 'Compra Confirmada';
    return isEn ? 'Thank You for Your Support' : 'Obrigado pelo Apoio';
  }, [headerFailed, isEn, type]);

  const description = useMemo(() => {
    if (headerFailed) {
      if (type === 'membership') return isEn ? 'Your annual fee was not completed. You can safely try again.' : 'A quota não foi concluída. Podes tentar novamente em segurança.';
      if (type === 'store') return isEn ? 'Your order was not completed. Check the payment details and try again.' : 'A compra não foi concluída. Verifica os dados de pagamento e tenta de novo.';
      return isEn ? 'Your donation was not completed. You can try again whenever you want.' : 'A doação não foi concluída. Podes voltar a tentar quando quiseres.';
    }
    if (type === 'membership') return isEn ? 'Your annual fee is active. You can review your status and benefits in your member area.' : 'A tua quota está ativa. Podes consultar o estado e benefícios na tua área de membro.';
    if (type === 'store') {
      if (accountExists) return isEn ? 'We sent you an email with your order details. You can track it in your personal area.' : 'Enviámos um email com os detalhes da tua encomenda. Podes acompanhar o estado na tua área pessoal.';
      return isEn ? 'Order confirmed. We sent you an email with a link to create an account or sign in and attach this order.' : 'Compra confirmada. Enviámos um email com um link para criar conta ou entrar e associar esta encomenda.';
    }
    return isEn ? 'Your donation helps keep the message of Garabandal alive. Our Lady of Garabandal, pray for us.' : 'O teu donativo ajuda a manter viva a mensagem de Garabandal. Nossa Senhora de Garabandal rogai por nós.';
  }, [accountExists, headerFailed, isEn, type]);

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
              {isEn ? 'Confirmation' : 'Confirmação'}
            </span>
            <h1 className="text-3xl md:text-4xl font-serif text-white mb-4">{title}</h1>
            <p className="text-white/60 text-lg max-w-lg mx-auto leading-relaxed">{description}</p>

            {amountText && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className="text-2xl font-bold text-white">{amountText}</div>
                <div className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/60 uppercase tracking-widest font-bold">{isEn ? 'Total' : 'Total'}</div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Details / Next Steps */}
        <div className="p-8 md:p-10 bg-[#111]">
          {type === 'store' && !headerFailed && !accountExists && (
            <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
              <div className="font-bold text-amber-200 mb-2">{isEn ? 'Next step to attach your order' : 'Próximo passo para associar a encomenda'}</div>
              <div className="text-sm text-amber-100/90 leading-relaxed space-y-1">
                <p>{isEn ? <>1. Open the confirmation email sent to <strong>{confirmedEmail || 'the purchase email'}</strong>.</> : <>1. Abra o email de confirmação enviado para <strong>{confirmedEmail || 'o email da compra'}</strong>.</>}</p>
                <p>{isEn ? <>2. Click <strong>Attach Order to Account</strong>.</> : <>2. Clique em <strong>Associar Encomenda à Conta</strong>.</>}</p>
                <p>{isEn ? '3. On that page, create your account (or sign in if you already have one) to save this order.' : '3. Na página do link, crie a conta (ou entre, se já existir) para guardar esta compra.'}</p>
              </div>
              <p className="text-xs text-amber-100/70 mt-3">
                {isEn ? "If you can't find the email, check Spam/Promotions." : 'Se não encontrar o email, verifique Spam/Promoções.'}
              </p>
            </div>
          )}

          {isReduniq && (
            <div className={`mb-8 rounded-2xl border p-6 ${isReduniqFailed
                ? 'border-red-500/30 bg-red-500/10'
                : isReduniqPending || reduniqConfirmStatus === 'confirming'
                  ? 'border-blue-500/30 bg-blue-500/10'
                  : isReduniqSuccess
                    ? 'border-green-500/30 bg-green-500/10'
                    : 'border-white/10 bg-white/5'
              }`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${isReduniqFailed ? 'text-red-400' : isReduniqPending || reduniqConfirmStatus === 'confirming' ? 'text-blue-300' : 'text-green-400'
                  }`}>
                  {reduniqConfirmStatus === 'confirming' ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">
                    {reduniqConfirmStatus === 'confirming'
                      ? (isEn ? 'Confirming with Reduniq...' : 'A confirmar com a Reduniq...')
                      : isReduniqSuccess
                        ? (isEn ? 'Payment confirmed' : 'Pagamento confirmado')
                        : isReduniqPending
                          ? (isEn ? 'Payment processing' : 'Pagamento em processamento')
                          : isReduniqFailed
                            ? (isEn ? 'Payment not confirmed' : 'Pagamento não confirmado')
                            : (isEn ? 'Payment status' : 'Estado do pagamento')}
                  </div>
                  <div className="text-sm text-white/60 mt-1 leading-relaxed">
                    {reduniqConfirmStatus === 'confirming'
                      ? (isEn ? 'We are validating the real transaction status (via getResult).' : 'Estamos a validar o estado real da transação (via getResult).')
                      : isReduniqSuccess
                        ? (isEn ? 'The transaction was confirmed by Reduniq.' : 'A transação foi confirmada pela Reduniq.')
                        : isReduniqPending
                          ? (isEn ? 'The transaction is still in progress. If it is a service payment/MB, it may take a few minutes.' : 'A transação ainda está em curso. Se for Pagamento de Serviços/MB, pode demorar alguns minutos.')
                          : isReduniqFailed
                            ? (isEn ? 'The transaction was declined, canceled, or ended with an error.' : 'A transação foi recusada, cancelada ou terminou com erro.')
                            : (isEn ? 'Could not determine the transaction status.' : 'Não foi possível determinar o estado da transação.')}
                  </div>

                  {(orderRefParam || reduniqConfirm?.transactionId) && (
                    <div className="mt-3 text-xs text-white/50 flex flex-wrap gap-3">
                      {orderRefParam && <span>Ref: {orderRefParam}</span>}
                      {reduniqConfirm?.transactionId && <span>{isEn ? 'Transaction' : 'Transação'}: {reduniqConfirm.transactionId}</span>}
                      {reduniqConfirm?.resultCode && <span>{isEn ? 'Code' : 'Código'}: {reduniqConfirm.resultCode}</span>}
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

          {type === 'donation' && isReduniqSuccess && (
            <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <div className="font-bold text-white">
                    {isEn ? 'Official invoice by email' : 'Fatura oficial por email'}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">
                    {isEn
                      ? 'Your invoice is being prepared and will be sent automatically to the email used for this donation.'
                      : 'A tua fatura está a ser preparada e será enviada automaticamente para o email usado neste donativo.'}
                  </p>
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
                    <h3 className="font-bold text-white">{isEn ? 'Digital Products' : 'Produtos Digitais'}</h3>
                  </div>
                  {confirmedEmail && (
                    <p className="text-white font-medium mb-4">
                      {isEn ? <>We sent the access email to <span className="text-orange-400">{confirmedEmail}</span>.</> : <>Enviámos o email de acesso para <span className="text-orange-400">{confirmedEmail}</span>.</>}
                    </p>
                  )}
                  <p className="text-sm text-white/40 leading-relaxed mb-4">
                    {isEn ? <>You can download your files now or access them later in your <strong className="text-white/70">Digital Library</strong> from your personal area.<strong className="block mt-1 text-white/60">These links expire in 7 days.</strong></> : <>Pode descarregar os seus ficheiros agora ou aceder mais tarde na <strong className="text-white/70">Biblioteca Digital</strong> da sua área pessoal.<strong className="block mt-1 text-white/60">Estes links expiram em 7 dias.</strong></>}
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Link href={libraryPath} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors">
                      {isEn ? 'Go to Digital Library' : 'Ir para Biblioteca Digital'}
                    </Link>
                    <Link href={ordersPath} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors">
                      {isEn ? 'View My Orders' : 'Ver Minhas Encomendas'}
                    </Link>
                  </div>

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
                          {isEn ? 'Download' : 'Descarregar'} {link.name}
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
                    <h3 className="font-bold text-white">{isEn ? 'Physical Products' : 'Produtos Físicos'}</h3>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed">{isEn ? 'You will receive an email with tracking details as soon as the order is shipped by our team.' : 'Receberá um email com o tracking assim que a encomenda for expedida pelos nossos serviços.'}</p>
                </div>
              )}
            </div>
          )}

          {type === 'membership' && !headerFailed && (
            <div className="mb-8 space-y-4">
              <div className="bg-yellow-500/10 p-6 rounded-2xl border border-yellow-500/30">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-yellow-500/20 rounded-xl text-yellow-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-lg mb-1">{isEn ? 'Official Member Activated' : 'Membro Oficial Ativado'}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {isEn ? 'Your annual fee was confirmed. Enter your member area now to access content, calendar, and account management.' : 'A sua quota foi confirmada. Entre agora na sua área de membro para ver conteúdos, agenda e gestão da sua conta.'}
                    </p>
                    {memberNumber ? (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm font-bold text-yellow-300">
                        {isEn ? 'Member No.' : 'Nº de Membro'}: #{memberNumber}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-300 mt-0.5" />
                  <div>
                    <p className="font-semibold text-white">{isEn ? 'Email sent' : 'Email enviado'}</p>
                    <p className="text-sm text-white/70 mt-1">
                      {isEn ? <>Check the email <strong>{memberEmail || 'from your account'}</strong>. We sent the fee confirmation and your digital member diploma.</> : <>Verifique o email <strong>{memberEmail || 'da sua conta'}</strong>. Enviámos a confirmação da quota e o diploma digital de membro.</>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <Link
              href={homePath}
              className="w-full md:w-auto px-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              {isEn ? 'Home Page' : 'Página Inicial'}
            </Link>

            {type === 'store' ? (
              <>
                {!accountExists ? (
                  <Link
                    href={loginPath}
                    className="w-full md:w-auto px-8 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2"
                  >
                    {isEn ? 'Sign In / Create Account' : 'Entrar / Criar Conta'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : null}
                {showDigital && accountExists ? (
                  <Link
                    href={libraryPath}
                    className="w-full md:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
                  >
                    {isEn ? 'Open Library' : 'Abrir Biblioteca'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : null}
                {showPhysical ? (
                  <Link
                    href={ordersPath}
                    className="w-full md:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                  >
                    {isEn ? 'View Orders' : 'Ver Encomendas'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : null}
              </>
            ) : type === 'membership' ? (
              headerFailed ? (
                <Link
                  href={membershipRetryPath}
                  className="w-full md:w-auto px-8 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-bold transition-all shadow-lg shadow-yellow-900/20 flex items-center justify-center gap-2"
                >
                  {isEn ? 'Try Again' : 'Tentar Novamente'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href={memberPath}
                    className="w-full md:w-auto px-8 py-4 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold transition-all shadow-[0_0_35px_rgba(234,179,8,0.35)] flex items-center justify-center gap-2 text-base"
                  >
                    {isEn ? 'Go to My Member Area' : 'Ir para Minha Área de Membro'}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href={rightsPath}
                    className="w-full md:w-auto px-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {isEn ? 'Rights and Duties' : 'Direitos e Deveres'}
                    <ScrollText className="w-4 h-4" />
                  </Link>
                </>
              )
            ) : (
              <Link
                href={donationsPath}
                className="w-full md:w-auto px-8 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-all shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2"
              >
                {isEn ? 'View Campaign' : 'Ver Campanha'}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

        </div>

      </motion.div>
    </main>
  );
}
