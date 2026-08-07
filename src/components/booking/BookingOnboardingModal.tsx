"use client";

import { Dialog } from '@headlessui/react';
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    CreditCard,
    Landmark,
    Mail,
    Menu,
    PlayCircle,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocale } from '../../contexts/LocaleContext';
import {
    daysBetweenUtc,
    getRegistrationFeeDueDate,
} from '../../lib/pilgrimage-payment-deadlines';

interface BookingOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onShowPayment: () => void;
    bookingCreatedAt?: string | null;
    isRegistrationFeePaid?: boolean;
    isReceiptUnderReview?: boolean;
    isNewAccount?: boolean;
}

const DATE_FORMATTERS = {
    pt: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }),
    en: new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }),
};

const SHORT_DATE_FORMATTERS = {
    pt: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
    }),
    en: new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
    }),
};

export default function BookingOnboardingModal({
    isOpen,
    onClose,
    onShowPayment,
    bookingCreatedAt,
    isRegistrationFeePaid = false,
    isReceiptUnderReview = false,
    isNewAccount = false,
}: BookingOnboardingModalProps) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    const formatterKey = isEn ? 'en' : 'pt';
    const dueDateValue = getRegistrationFeeDueDate(bookingCreatedAt);
    const dueDate = dueDateValue ? new Date(dueDateValue) : null;
    const daysLeft = dueDate ? daysBetweenUtc(new Date(), dueDate) : 5;
    const formattedDueDate = dueDate
        ? DATE_FORMATTERS[formatterKey].format(dueDate)
        : null;
    const shortDueDate = dueDate
        ? SHORT_DATE_FORMATTERS[formatterKey].format(dueDate)
        : null;

    const deadlineTitle = daysLeft < 0
        ? (isEn ? 'The 5-day deadline has passed' : 'O prazo de 5 dias terminou')
        : daysLeft === 0
            ? (isEn ? 'Today is the last day to secure your place' : 'Hoje é o último dia para garantir sua vaga')
            : daysLeft === 1
                ? (isEn ? '1 day left to secure your place' : 'Falta 1 dia para garantir sua vaga')
                : (isEn
                    ? `${daysLeft} days left to secure your place`
                    : `Faltam ${daysLeft} dias para garantir sua vaga`);

    const videoSrc = isEn
        ? '/videos/tutorial-payments-en.mp4'
        : '/videos/tutorial-pagamentos-pt.mp4';
    const videoPoster = isEn
        ? '/videos/tutorial-payments-en.jpg'
        : '/videos/tutorial-pagamentos-pt.jpg';

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-[210]">
            <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-end justify-center md:items-center md:p-6">
                <Dialog.Panel className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:rounded-[30px]">
                    <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 md:px-7 md:py-5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                            <CreditCard className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <Dialog.Title className="text-xl font-black leading-tight text-slate-950 md:text-2xl">
                                {isRegistrationFeePaid
                                    ? (isEn ? 'How to manage your payments' : 'Como gerenciar seus pagamentos')
                                    : (isEn ? 'Your registration was received' : 'Sua inscrição foi recebida')}
                            </Dialog.Title>
                            <p className="mt-1 text-sm leading-relaxed text-slate-500">
                                {isRegistrationFeePaid
                                    ? (isEn ? 'See how to return here and pay future installments.' : 'Veja como voltar aqui e pagar as próximas parcelas.')
                                    : (isEn ? 'Pay the registration fee to secure your place.' : 'Pague a taxa de inscrição para garantir sua vaga.')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={isEn ? 'Close payment tutorial' : 'Fechar tutorial de pagamentos'}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </header>

                    <div className="overflow-y-auto overscroll-contain px-5 py-5 md:px-7 md:py-6">
                        {isNewAccount && (
                            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                                <p className="text-sm leading-relaxed">
                                    {isEn
                                        ? 'Your account was created automatically. Use the same email address whenever you return to the website.'
                                        : 'Sua conta foi criada automaticamente. Sempre use o mesmo e-mail da inscrição para entrar no site.'}
                                </p>
                            </div>
                        )}

                        <div className="grid items-start gap-6 md:grid-cols-[250px_minmax(0,1fr)] md:gap-7">
                            <section aria-labelledby="payment-video-title">
                                <div className="mb-3 flex items-center gap-2">
                                    <PlayCircle className="h-5 w-5 text-amber-700" aria-hidden="true" />
                                    <h3 id="payment-video-title" className="font-extrabold text-slate-950">
                                        {isEn ? 'Watch the 25-second video' : 'Veja o vídeo de 25 segundos'}
                                    </h3>
                                </div>
                                <video
                                    key={videoSrc}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    poster={videoPoster}
                                    className="mx-auto max-h-[330px] w-auto max-w-full rounded-2xl bg-slate-950 shadow-lg ring-1 ring-slate-900/10 md:max-h-[440px]"
                                >
                                    <source src={videoSrc} type="video/mp4" />
                                    {isEn
                                        ? 'Your browser cannot play this tutorial video.'
                                        : 'Seu navegador não consegue reproduzir este vídeo.'}
                                </video>
                            </section>

                            <div className="space-y-4">
                                {isReceiptUnderReview ? (
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                                        <p className="flex items-center gap-2 font-black">
                                            <CheckCircle2 className="h-5 w-5 text-blue-700" aria-hidden="true" />
                                            {isEn ? 'Receipt under review' : 'Comprovante em análise'}
                                        </p>
                                        <p className="mt-2 text-sm leading-relaxed text-blue-900/80">
                                            {isEn
                                                ? 'We received your receipt. Do not make or submit the same payment again while it is being reviewed.'
                                                : 'Recebemos seu comprovante. Não faça nem envie o mesmo pagamento novamente enquanto ele estiver em análise.'}
                                        </p>
                                    </div>
                                ) : isRegistrationFeePaid ? (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                                        <p className="flex items-center gap-2 font-black">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                                            {isEn ? 'Registration fee paid' : 'Taxa de inscrição paga'}
                                        </p>
                                        <p className="mt-2 text-sm leading-relaxed text-emerald-900/80">
                                            {isEn
                                                ? 'Your registration fee is settled. Remember that future installments are still paid manually.'
                                                : 'Sua taxa de inscrição está paga. Lembre-se de que as próximas parcelas continuam sendo pagas manualmente.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className={`rounded-2xl border p-4 ${
                                        daysLeft < 0
                                            ? 'border-red-200 bg-red-50 text-red-950'
                                            : 'border-amber-300 bg-amber-50 text-amber-950'
                                    }`}>
                                        <p className="flex items-start gap-2 font-black leading-snug">
                                            {daysLeft < 0
                                                ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
                                                : <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />}
                                            {deadlineTitle}
                                        </p>
                                        <p className="mt-2 text-sm font-semibold leading-relaxed opacity-80">
                                            {isEn
                                                ? <>The fee must be paid within 5 days of registration. Until then, your place is <strong>not yet secured</strong>.</>
                                                : <>A taxa deve ser paga até 5 dias após a inscrição. Até lá, sua vaga <strong>ainda não está garantida</strong>.</>}
                                        </p>
                                        {formattedDueDate && (
                                            <p className="mt-2 text-sm font-black">
                                                {isEn ? `Pay by ${formattedDueDate}.` : `Pague até ${formattedDueDate}.`}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <section aria-labelledby="payment-steps-title">
                                    <h3 id="payment-steps-title" className="text-base font-black text-slate-950">
                                        {isEn ? 'It works in 3 simple steps' : 'Funciona em 3 passos simples'}
                                    </h3>
                                    <ol className="mt-3 space-y-3">
                                        <li className="flex gap-3">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">1</span>
                                            <p className="text-sm leading-relaxed text-slate-600">
                                                {isEn
                                                    ? <><strong className="text-slate-950">Check the amount.</strong> The large amount on the payment page is what you need to pay now.</>
                                                    : <><strong className="text-slate-950">Confira o valor.</strong> O valor grande na área de pagamento é o que você precisa pagar agora.</>}
                                            </p>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">2</span>
                                            <p className="text-sm leading-relaxed text-slate-600">
                                                {isEn
                                                    ? <><strong className="text-slate-950">Choose how to pay.</strong> Pay online, or use bank transfer and upload the receipt.</>
                                                    : <><strong className="text-slate-950">Escolha como pagar.</strong> Pague online ou faça uma transferência e envie o comprovante.</>}
                                            </p>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">3</span>
                                            <p className="text-sm leading-relaxed text-slate-600">
                                                {isEn
                                                    ? <><strong className="text-slate-950">Return for each installment.</strong> There are no automatic charges. Every future payment must be made manually.</>
                                                    : <><strong className="text-slate-950">Volte para cada parcela.</strong> Não existe débito automático. Todos os pagamentos futuros devem ser feitos manualmente.</>}
                                            </p>
                                        </li>
                                    </ol>
                                </section>

                                <section aria-labelledby="return-title">
                                    <h3 id="return-title" className="font-black text-slate-950">
                                        {isEn ? '2 easy ways to return and pay' : '2 formas fáceis de voltar e pagar'}
                                    </h3>
                                    <div className="mt-3 space-y-3">
                                        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                                            <div className="flex items-start gap-3">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
                                                    <Mail className="h-5 w-5" aria-hidden="true" />
                                                </span>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-black text-slate-950">
                                                            {isEn ? '1. Use the email link' : '1. Use o link do e-mail'}
                                                        </p>
                                                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950">
                                                            {isEn ? 'Fastest' : 'Mais rápido'}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-600">
                                                        {isEn
                                                            ? <>We sent you an email from the Garabandal Apostolate with a secure direct link. Tap the yellow button in that email to open your registration directly in the payment area.</>
                                                            : <>Enviamos um e-mail do Apostolado de Garabandal com um link direto e seguro. Toque no botão amarelo desse e-mail para abrir sua inscrição diretamente na área de pagamento.</>}
                                                    </p>
                                                    <p className="mt-2 text-sm font-black leading-relaxed text-amber-900">
                                                        {isEn
                                                            ? 'Cannot find it? Check Spam, Junk or Promotions.'
                                                            : 'Não encontrou? Confira Spam, Lixo eletrônico ou Promoções.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex items-start gap-3">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                                                    <Menu className="h-5 w-5" aria-hidden="true" />
                                                </span>
                                                <div>
                                                    <p className="font-black text-slate-950">
                                                        {isEn ? '2. Return through the website' : '2. Volte pelo site'}
                                                    </p>
                                                    <p className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-600">
                                                        {isEn
                                                            ? <>Sign in with the same email → tap <strong>Menu</strong> in the bottom-right corner → <strong>My Registrations</strong> → choose the pilgrimage → <strong>Pay Now</strong>.</>
                                                            : <>Entre com o mesmo e-mail → toque em <strong>Menu</strong>, no canto inferior direito → <strong>Minhas Inscrições</strong> → escolha a peregrinação → <strong>Pagar Agora</strong>.</>}
                                                    </p>
                                                    <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                                                        {isEn
                                                            ? 'On a computer, open your account menu and choose “My Registrations”.'
                                                            : 'No computador, abra o menu da sua conta e escolha “Minhas Inscrições”.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <div className="flex items-start gap-3 rounded-2xl bg-slate-950 p-4 text-white">
                                    <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
                                    <p className="text-sm leading-relaxed text-white/75">
                                        {isEn
                                            ? <><strong className="text-white">Bank transfer:</strong> making the transfer is not enough. You must return and upload the receipt so the team can review it.</>
                                            : <><strong className="text-white">Transferência:</strong> fazer a transferência não é suficiente. Você precisa voltar e enviar o comprovante para a equipe validar.</>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <footer className="grid shrink-0 gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:grid-cols-2 md:px-7">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-12 rounded-xl border border-slate-200 px-4 text-sm font-extrabold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                        >
                            {!isRegistrationFeePaid && shortDueDate
                                ? (isEn ? `Pay later · by ${shortDueDate}` : `Pagar depois · até ${shortDueDate}`)
                                : (isEn ? 'Close tutorial' : 'Fechar tutorial')}
                        </button>
                        <button
                            type="button"
                            onClick={onShowPayment}
                            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-slate-950 shadow-md transition-colors hover:bg-amber-300"
                        >
                            <CreditCard className="h-5 w-5" aria-hidden="true" />
                            {isReceiptUnderReview
                                ? (isEn ? 'Understood' : 'Entendi')
                                : isRegistrationFeePaid
                                    ? (isEn ? 'View my payments' : 'Ver meus pagamentos')
                                    : (isEn ? 'Pay the registration fee now' : 'Pagar a taxa agora')}
                        </button>
                    </footer>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
