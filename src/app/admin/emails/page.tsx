"use client";

import { useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import {
    renderMembershipEmail,
    renderMemberReceiptEmail,
    renderMemberDiplomaEmail,
    renderQuotaReminderEmail,
    renderQuotaWarningEmail,
    renderQuotaOverdueEmail,
    renderMembershipRevokedEmail,
    renderStoreBuyerEmail,
    renderStoreOwnerEmail,
    renderStoreShippingEmail,
    renderStorePreparingEmail,
    renderDonationReceiptEmail,
    renderDonationNotification,
    renderGeneralLeadEmail,
    renderBrochureEmail,
    renderAbandonmentRecoveryEmail,
    renderBookingConfirmationEmail,
    renderPilgrimagePaymentReminderEmail,
    renderWelcomeEmail,
    renderAuctionAnnouncementEmail,
    renderAuctionOutbidEmail,
    renderAuctionWinnerEmail,
    renderAuctionAdminNotificationEmail,
    renderAuctionPaymentConfirmedEmail,
    renderBookingAdminNotification,
    renderAuthMagicLinkEmail,
    renderAuthRecoveryEmail,
    renderBookingAccessLinkEmail,
    renderAdminBankTransferAlertEmail,
    renderVolunteerApplicationEmail,
    MARKETING_EMAIL_TEMPLATES,
    renderMarketingTemplateEmail,
} from '../../../lib/email-renderer';
import Link from 'next/link';
import { Mail, Smartphone, Monitor, ChevronRight, Info, CheckCircle, Languages } from 'lucide-react';

const MOCK_MEMBER = {
    kind: 'new' as const,
    memberName: 'Maria Silva',
    memberEmail: 'maria@exemplo.com',
    memberNumber: 1234,
    amount: 2500,
    paymentMethod: 'Stripe',
    nextQuotaDate: '2026-01-31',
};

const MOCK_MEMBER_RECEIPT = {
    ...MOCK_MEMBER,
    toEmail: 'maria@exemplo.com',
    kind: 'new' as const,
    hasDiploma: true,
};

const MOCK_MEMBER_DIPLOMA = {
    toEmail: 'maria@exemplo.com',
    memberName: 'Maria Silva',
    memberNumber: 1234,
    issuedAt: new Date().toISOString(),
    attachments: [],
};

const MOCK_STORE = {
    orderRef: 'ORD-2025-001',
    buyerName: 'Joao Santos',
    buyerEmail: 'joao@exemplo.com',
    buyerPhone: '+351 912 345 678',
    buyerNif: '234567890',
    subtotal: '45.00',
    vat: '10.35',
    shippingCost: '3.50',
    total: '58.85',
    items: [
        { name: 'Livro O Aviso', qty: 1, unit_price: 15.00 },
        { name: 'Terco Oficial', qty: 2, unit_price: 15.00 },
    ],
    shipping: {
        address1: 'Rua das Flores, 123',
        address2: '2o Esquerdo',
        city: 'Lisboa',
        postalCode: '1000-001',
        country: 'Portugal',
    },
    billing: {
        address1: 'Rua do Comercio, 12',
        city: 'Porto',
        postalCode: '4000-001',
        country: 'Portugal',
    },
};

const MOCK_DONATION = {
    toEmail: 'donor@test.com',
    donorName: 'Ana Benfeitora',
    amount: 50.0,
    method: 'Stripe',
    paidAt: new Date().toISOString(),
};

const MOCK_DONATION_NOTIFICATION = {
    donorName: 'Ana Benfeitora',
    donorEmail: 'ana@exemplo.com',
    amount: 50.0,
    paymentMethod: 'Transferencia',
    paymentReference: 'DN-2025-001',
    description: 'Doacao manual',
    paidAt: new Date().toISOString(),
    status: 'paid',
};

const MOCK_QUOTA_LINK = 'https://apostoladodegarabandal.com/tornar-membro';
const MOCK_PILGRIMAGE_BOOKING_URL =
    'https://apostoladodegarabandal.com/peregrinacoes/inscricao/BOOK-2025-001?viewToken=mock&token=mock';

const MOCK_MEMBER_AREA_URL = 'https://apostoladodegarabandal.com/member';
const MOCK_ADMIN_URL = 'https://apostoladodegarabandal.com/admin';
const MOCK_AUCTION_URL = 'https://apostoladodegarabandal.com/leilao/peca-solidaria';
const MOCK_PRODUCT_URL = 'https://apostoladodegarabandal.com/loja';
const MOCK_PILGRIMAGE_URL = 'https://apostoladodegarabandal.com/peregrinacoes/garabandal-outubro-2026';
const MOCK_PILGRIMAGE_IMAGE_URL =
    'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/site-content/pilgrimages/covers/1768917805305_l2ho16.png';

const MOCK_MARKETING_PRODUCTS = [
    {
        title: 'Garabandal — Mensagem de Esperança',
        price: '15,00 €',
        imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/store-products/products/200000048/1766876268448.webp',
        url: 'https://apostoladodegarabandal.com/loja/produto/200000048',
        label: 'Livro oficial',
    },
    {
        title: 'Diário de Conchita',
        price: '12,00 €',
        imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/store-products/products/978-989-33-8094--9/1766876383807.webp',
        url: 'https://apostoladodegarabandal.com/loja/produto/978-989-33-8094--9',
        label: 'Produto oficial',
    },
    {
        title: 'Guia do Peregrino',
        price: '8,00 €',
        imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/store-products/products/200000057/1766876326970.webp',
        url: 'https://apostoladodegarabandal.com/loja/produto/200000057',
        label: 'Guia digital',
    },
];

const renderMarketingPreview = (templateKey: string, language: 'pt' | 'en') =>
    renderMarketingTemplateEmail({
        templateKey,
        language,
        name: language === 'en' ? 'John Smith' : 'Clara Almeida',
        email: 'preview@example.com',
        pilgrimageName: language === 'en'
            ? 'Garabandal Pilgrimage — Marian Way — October 2026'
            : 'Peregrinação a Garabandal — Caminho Mariano — Outubro 2026',
        pilgrimageUrl: MOCK_PILGRIMAGE_URL,
        pilgrimageImageUrl: MOCK_PILGRIMAGE_IMAGE_URL,
        bookingResumeUrl: `${MOCK_PILGRIMAGE_URL}?resume=preview`,
        donationUrl: 'https://apostoladodegarabandal.com/donativos',
        memberUrl: 'https://apostoladodegarabandal.com/tornar-membro',
        referralUrl: `${MOCK_MEMBER_AREA_URL}?tab=convites`,
        productTitle: MOCK_MARKETING_PRODUCTS[0].title,
        productPrice: MOCK_MARKETING_PRODUCTS[0].price,
        productImageUrl: MOCK_MARKETING_PRODUCTS[0].imageUrl,
        productUrl: MOCK_PRODUCT_URL,
        products: MOCK_MARKETING_PRODUCTS,
        unsubscribeUrl: 'https://apostoladodegarabandal.com/cancelar-subscricao?preview=1',
    });

const BASE_PILGRIMAGE_REMINDER_PREVIEW: Parameters<typeof renderPilgrimagePaymentReminderEmail>[0] = {
    toEmail: 'peregrino@test.com',
    recipientName: 'Peregrino',
    pilgrimageName: 'Peregrinacao a Garabandal',
    obligationLabel: 'Prestação 1',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    amountDue: 350,
    totalRemaining: 1050,
    bookingUrl: MOCK_PILGRIMAGE_BOOKING_URL,
    stage: 'upcoming_7d',
};

const buildPilgrimageReminderPreview = (
    overrides: Partial<Parameters<typeof renderPilgrimagePaymentReminderEmail>[0]>,
) =>
    renderPilgrimagePaymentReminderEmail({
        ...BASE_PILGRIMAGE_REMINDER_PREVIEW,
        ...overrides,
    });

type EmailTemplate = {
    label: string;
    title: string;
    category: string;
    recipient: string;
    when: string;
    why: string;
    technical: string;
    supportsLocale?: boolean;
    render: (language?: 'pt' | 'en') => { html: string; subject?: string };
};

const SYSTEM_EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
    'member-welcome': {
        label: '👋 Pagamento de Quota (Admin)',
        title: 'Notificação de Pagamento de Quota',
        category: 'Membros & Quotas',
        recipient: 'Admin',
        when: 'Enviado após confirmação de pagamento de quota.',
        why: 'Notificar o admin de nova adesão ou renovação.',
        technical: 'Webhook: /api/webhook -> sendMembershipNotification',
        render: () => renderMembershipEmail(MOCK_MEMBER),
    },
    'member-receipt': {
        label: '🧾 Recibo de Quota',
        title: 'Recibo para Membro',
        category: 'Membros & Quotas',
        recipient: 'Membro',
        when: 'Enviado quando o pagamento da quota é confirmado.',
        why: 'Confirmar pagamento e partilhar detalhes da quota.',
        technical: 'Webhook: /api/webhook -> sendMemberReceiptEmail',
        render: () => renderMemberReceiptEmail(MOCK_MEMBER_RECEIPT),
    },
    'member-diploma': {
        label: '🎓 Diploma de Membro',
        title: 'Envio de Diploma',
        category: 'Membros & Quotas',
        recipient: 'Membro',
        when: 'Usado quando existe geração explícita de diploma (fluxo manual/teste).',
        why: 'Entregar diploma digital ao membro.',
        technical: 'API: /api/test/diploma -> sendMemberDiplomaEmail (teste)',
        render: () => renderMemberDiplomaEmail(MOCK_MEMBER_DIPLOMA),
    },
    'member-reminder': {
        label: '⏰ Lembrete de Quota',
        title: 'Lembrete de Renovação',
        category: 'Membros & Quotas',
        recipient: 'Membro',
        when: 'Enviado por rotina diária conforme proximidade de vencimento.',
        why: 'Lembrar a renovação da quota atempadamente.',
        technical: 'Cron: /api/cron/membership-rules -> sendQuotaReminderEmail',
        render: () =>
            renderQuotaReminderEmail({
                toEmail: 'test@test.com',
                memberName: 'Maria Silva',
                memberNumber: 1234,
                daysUntilDue: 30,
                nextQuotaDate: '2026-01-31',
                membershipUrl: MOCK_QUOTA_LINK,
            }),
    },
    'quota-warning': {
        label: '⚠️ Aviso de Quota',
        title: 'Aviso de Vencimento Próximo',
        category: 'Membros & Quotas',
        recipient: 'Membro',
        when: 'Enviado quando a quota está próxima do vencimento.',
        why: 'Alertar antes da expiração da quota.',
        technical: 'Cron: /api/cron/membership-rules -> sendQuotaWarningEmail',
        render: () =>
            renderQuotaWarningEmail({
                name: 'Maria Silva',
                email: 'maria@exemplo.com',
                daysRemaining: 7,
                payLink: MOCK_QUOTA_LINK,
            }),
    },
    'quota-overdue': {
        label: '⌛ Quota em Atraso',
        title: 'Notificação de Atraso',
        category: 'Membros & Quotas',
        recipient: 'Membro',
        when: 'Enviado após o vencimento da quota.',
        why: 'Informar que a quota está em atraso.',
        technical: 'Cron: /api/cron/membership-rules -> sendQuotaOverdueEmail',
        render: () =>
            renderQuotaOverdueEmail({
                name: 'Maria Silva',
                email: 'maria@exemplo.com',
                payLink: MOCK_QUOTA_LINK,
            }),
    },
    'quota-revoked': {
        label: '⛔ Membro Suspenso',
        title: 'Suspensão de Estado de Membro',
        category: 'Membros & Quotas',
        recipient: 'Membro',
        when: 'Enviado após período de tolerância sem regularização.',
        why: 'Informar suspensão de acesso e como reativar.',
        technical: 'Cron: /api/cron/membership-rules -> sendMembershipRevokedEmail',
        render: () =>
            renderMembershipRevokedEmail({
                name: 'Maria Silva',
                payLink: MOCK_QUOTA_LINK,
            }),
    },
    'account-welcome': {
        label: '✨ Boas-vindas de Conta',
        title: 'Email de Boas-vindas',
        category: 'Membros & Quotas',
        recipient: 'Membro',
        when: 'Enviado na criação manual de membro no admin.',
        why: 'Dar boas-vindas e orientar para login.',
        technical: 'API: /api/admin/members -> sendWelcomeEmail',
        render: () => renderWelcomeEmail({ name: 'Maria Silva', email: 'maria@exemplo.com' }),
    },
    'donation-receipt': {
        label: '❤️ Recibo de Doação',
        title: 'Confirmação de Doação',
        category: 'Doações',
        recipient: 'Doador',
        when: 'Enviado após doação confirmada com sucesso.',
        why: 'Agradecer e confirmar o registo da doação.',
        technical: 'Webhook: /api/webhook -> sendDonationReceiptEmail',
        render: () => renderDonationReceiptEmail(MOCK_DONATION),
    },
    'donation-notification': {
        label: '📣 Notificação de Doação (Admin)',
        title: 'Notificação de Doação',
        category: 'Doações',
        recipient: 'Admin',
        when: 'Enviado quando uma doação manual é registada.',
        why: 'Permitir seguimento administrativo/contabilístico.',
        technical: 'API: /api/donations/manual -> sendDonationNotification',
        render: () => renderDonationNotification(MOCK_DONATION_NOTIFICATION),
    },
    'store-owner': {
        label: '🛍️ Nova Encomenda (Admin)',
        title: 'Notificação de Encomenda (Admin)',
        category: 'Loja Online',
        recipient: 'Admin da Loja',
        when: 'Enviado após checkout com pagamento confirmado.',
        why: 'Notificar nova encomenda para processamento.',
        technical: 'Store flow -> sendStoreOwnerEmail',
        render: () => renderStoreOwnerEmail(MOCK_STORE),
    },
    'store-confirm': {
        label: '🧾 Confirmação de Encomenda',
        title: 'Confirmação para Cliente',
        category: 'Loja Online',
        recipient: 'Cliente',
        when: 'Enviado logo após compra bem-sucedida.',
        why: 'Confirmar encomenda e partilhar detalhes de acesso/entrega.',
        technical: 'Store flow -> sendStoreBuyerEmail',
        render: () =>
            renderStoreBuyerEmail({
                ...MOCK_STORE,
                hasDigital: true,
                downloadLinks: [
                    { name: 'Livro O Aviso (PDF)', url: 'https://files.example.com/aviso.pdf' },
                ],
                claimUrl: 'https://apostoladodegarabandal.com/loja-online/claim?order=ORD-2025-001',
                accountExists: false,
            }),
    },
    'store-preparing': {
        label: '📦 Encomenda em Preparação',
        title: 'Atualização de Preparação',
        category: 'Loja Online',
        recipient: 'Cliente',
        when: 'Enviado para encomendas físicas após confirmação de pagamento.',
        why: 'Informar que a encomenda está em preparação.',
        technical: 'Store flow -> sendStorePreparingEmail',
        render: () =>
            renderStorePreparingEmail({
                orderRef: 'ORD-2025-001',
                buyerEmail: 'joao@exemplo.com',
                buyerName: 'Joao Santos',
            }),
    },
    'store-shipped': {
        label: '🚚 Encomenda Enviada',
        title: 'Atualização de Envio',
        category: 'Loja Online',
        recipient: 'Cliente',
        when: 'Enviado quando o admin marca a encomenda como enviada.',
        why: 'Partilhar tracking e confirmar despacho.',
        technical: 'Admin: /api/admin/orders/[ref]/ship -> sendStoreShippingEmail',
        render: () =>
            renderStoreShippingEmail({
                orderRef: 'ORD-2025-001',
                buyerName: 'Joao Santos',
                tracking: 'CTT-123456789PT',
                shippedAt: new Date().toISOString(),
            }),
    },
    'lead-waitlist': {
        label: '📋 Confirmação de Lista de Espera',
        title: 'Confirmação de Interesse',
        category: 'Leads & Peregrinações',
        recipient: 'Interessado',
        when: 'Enviado quando o lead é captado sem data específica.',
        why: 'Confirmar registo na lista de espera geral.',
        technical: 'API: /api/leads/capture -> sendGeneralLeadEmail',
        render: () =>
            renderGeneralLeadEmail({
                email: 'waitlist@test.com',
                name: 'Peregrino Interessado',
            }),
    },
    'lead-brochure': {
        label: '🧭 Envio de Roteiro',
        title: 'Roteiro da Peregrinação',
        category: 'Leads & Peregrinações',
        recipient: 'Interessado',
        when: 'Enviado quando o lead pede o roteiro em PDF.',
        why: 'Entregar o material solicitado.',
        technical: 'API: /api/leads/capture -> sendBrochureEmail',
        render: () =>
            renderBrochureEmail({
                email: 'peregrino@test.com',
                name: 'Peregrino',
                pilgrimageName: 'Garabandal - Maio 2025',
                pdfUrl: 'https://files.example.com/garabandal-roteiro.pdf',
            }),
    },
    'lead-abandonment': {
        label: '↩️ Recuperação de Inscrição',
        title: 'Retoma de Inscrição',
        category: 'Leads & Peregrinações',
        recipient: 'Interessado',
        when: 'Envio manual pelo admin para um lead específico (a recuperação automática é feita pelo funil de marketing).',
        why: 'Incentivar conclusão do processo de inscrição.',
        technical: 'Manual: /api/leads/notify -> sendAbandonmentRecoveryEmail',
        render: () =>
            renderAbandonmentRecoveryEmail({
                email: 'recovery@test.com',
                name: 'Peregrino',
                pilgrimageName: 'Garabandal - Maio 2025',
                recoveryLink: 'https://apostoladodegarabandal.com/peregrinacoes/garabandal-maio/inscrever?resume=123',
            }),
    },
    'booking-confirmation': {
        label: '✅ Confirmação de Inscrição',
        title: 'Confirmação de Inscrição',
        category: 'Leads & Peregrinações',
        recipient: 'Peregrino',
        when: 'Enviado após criação da inscrição na peregrinação.',
        why: 'Confirmar inscrição e partilhar link seguro de gestão.',
        technical: 'API: /api/booking/create -> sendBookingConfirmationEmail',
        render: () =>
            renderBookingConfirmationEmail({
                bookingId: 'BOOK-2025-001',
                email: 'peregrino@test.com',
                pilgrimageName: 'Peregrinacao a Garabandal',
                amount: 150,
                totalAmount: 450,
                paymentMethod: 'bank_transfer',
                magicLink: 'https://apostoladodegarabandal.com/auth/verify?token=mock',
            }),
    },
    'pilgrimage-payment-reminder': {
        label: '💳 Lembrete de Pagamento da Peregrinação',
        title: 'Lembrete de Pagamento',
        category: 'Leads & Peregrinações',
        recipient: 'Peregrino',
        when: 'Enviado automaticamente antes do vencimento e após atraso do sinal ou das prestações.',
        why: 'Reduzir esquecimentos e incentivar a regularização dos pagamentos em falta.',
        technical: 'Cron: /api/cron/pilgrimage-payment-reminders -> sendPilgrimagePaymentReminderEmail',
        render: () =>
            buildPilgrimageReminderPreview({
                obligationLabel: 'Prestação 1',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                amountDue: 350,
                totalRemaining: 1050,
                stage: 'upcoming_7d',
            }),
    },
    'pilgrimage-deposit-reminder': {
        label: '🕊️ Aviso do Sinal da Peregrinação',
        title: 'Lembrete do Sinal de Inscrição',
        category: 'Leads & Peregrinações',
        recipient: 'Peregrino',
        when: 'Enviado para lembrar o prazo curto de 5 dias do sinal de inscrição.',
        why: 'Dar visibilidade aos avisos iniciais do sinal antes do vencimento.',
        technical: 'Cron: /api/cron/pilgrimage-payment-reminders -> sendPilgrimagePaymentReminderEmail',
        render: () =>
            buildPilgrimageReminderPreview({
                obligationLabel: 'Sinal de Inscrição',
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                amountDue: 500,
                totalRemaining: 1700,
                stage: 'upcoming_1d',
            }),
    },
    'pilgrimage-deposit-overdue': {
        label: '🔔 Sinal em Atraso',
        title: 'Aviso de Sinal em Atraso',
        category: 'Leads & Peregrinações',
        recipient: 'Peregrino',
        when: 'Enviado quando o sinal continua em falta após o prazo de inscrição.',
        why: 'Permitir rever o tom e o conteúdo dos avisos de atraso do sinal.',
        technical: 'Cron: /api/cron/pilgrimage-payment-reminders -> sendPilgrimagePaymentReminderEmail',
        render: () =>
            buildPilgrimageReminderPreview({
                obligationLabel: 'Sinal de Inscrição',
                dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                amountDue: 500,
                totalRemaining: 1700,
                stage: 'overdue_5d',
            }),
    },
    'pilgrimage-installment-overdue': {
        label: '📆 Prestação em Atraso',
        title: 'Aviso de Prestação em Atraso',
        category: 'Leads & Peregrinações',
        recipient: 'Peregrino',
        when: 'Enviado quando uma prestação continua por liquidar após a data de vencimento.',
        why: 'Permitir validar o email mais firme usado para prestações vencidas.',
        technical: 'Cron: /api/cron/pilgrimage-payment-reminders -> sendPilgrimagePaymentReminderEmail',
        render: () =>
            buildPilgrimageReminderPreview({
                obligationLabel: 'Prestação 2',
                dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                amountDue: 350,
                totalRemaining: 700,
                stage: 'overdue_10d',
            }),
    },
};

const EXTRA_EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
    'auth-magic-link': {
        label: 'Acesso por link mágico',
        title: 'Link de acesso à conta',
        category: 'Conta & Acesso',
        recipient: 'Utilizador',
        when: 'Enviado quando alguém pede acesso por email, incluindo mobile.',
        why: 'Permitir entrada segura sem password.',
        technical: 'API: /api/auth/send-magic-link e /api/mobile/auth/send-magic-link -> sendAuthMagicLinkEmail',
        supportsLocale: true,
        render: (language = 'pt') =>
            renderAuthMagicLinkEmail({
                magicLink: `${MOCK_MEMBER_AREA_URL}?token=preview`,
                locale: language,
            }),
    },
    'auth-recovery': {
        label: 'Recuperação de password',
        title: 'Recuperação de password',
        category: 'Conta & Acesso',
        recipient: 'Utilizador',
        when: 'Enviado quando alguém pede recuperação de password.',
        why: 'Permitir definir nova password com link e código alternativo.',
        technical: 'API: /api/auth/send-recovery-link -> sendAuthRecoveryEmail',
        supportsLocale: true,
        render: (language = 'pt') =>
            renderAuthRecoveryEmail({
                recoveryLink: `${MOCK_MEMBER_AREA_URL}/recuperar?token=preview`,
                otpCode: '123456',
                locale: language,
            }),
    },
    'booking-access-link': {
        label: 'Acesso à inscrição',
        title: 'Link seguro da inscrição',
        category: 'Leads & Peregrinações',
        recipient: 'Peregrino',
        when: 'Enviado quando o peregrino pede novo link para gerir a inscrição.',
        why: 'Dar acesso seguro à inscrição existente.',
        technical: 'API: /api/booking/send-access-link -> sendBookingAccessLinkEmail',
        supportsLocale: true,
        render: (language = 'pt') =>
            renderBookingAccessLinkEmail({
                accessLink: MOCK_PILGRIMAGE_BOOKING_URL,
                pilgrimageName: language === 'en' ? 'Garabandal Pilgrimage' : 'Peregrinação a Garabandal',
                locale: language,
            }),
    },
    'booking-admin-notification': {
        label: 'Nova inscrição (Admin)',
        title: 'Notificação de inscrição para admin',
        category: 'Admin & Operações',
        recipient: 'Admin',
        when: 'Enviado quando uma inscrição de peregrinação é criada.',
        why: 'Avisar a equipa de nova inscrição para acompanhamento operacional.',
        technical: 'API: /api/booking/create -> sendBookingAdminNotification',
        render: () =>
            renderBookingAdminNotification({
                bookingId: 'BOOK-2025-001',
                pilgrimageName: 'Peregrinação a Garabandal',
                customerName: 'Maria Peregrina',
                customerEmail: 'maria@exemplo.com',
                numberOfPilgrims: 2,
                totalAmount: 900,
                paymentMethod: 'bank_transfer',
            }),
    },
    'admin-bank-transfer-alert': {
        label: 'Transferência bancária (Admin)',
        title: 'Alerta de transferência bancária',
        category: 'Admin & Operações',
        recipient: 'Admin',
        when: 'Enviado quando uma inscrição é criada por transferência bancária.',
        why: 'Pedir validação manual da entrada de dinheiro.',
        technical: 'Booking flow -> sendAdminBankTransferAlert',
        render: () =>
            renderAdminBankTransferAlertEmail({
                customerName: 'Maria Peregrina',
                customerEmail: 'maria@exemplo.com',
                pilgrimageName: 'Peregrinação a Garabandal',
                totalAmount: 900,
                numberOfPilgrims: 2,
                adminUrl: `${MOCK_ADMIN_URL}/peregrinacoes`,
            }),
    },
    'volunteer-application': {
        label: 'Candidatura voluntariado (Admin)',
        title: 'Candidatura de voluntariado',
        category: 'Admin & Operações',
        recipient: 'Admin',
        when: 'Enviado quando um membro submete candidatura para voluntariado em Garabandal.',
        why: 'Permitir análise da candidatura pela equipa.',
        technical: 'API: /api/member/voluntariado -> sendVolunteerApplicationEmail',
        render: () =>
            renderVolunteerApplicationEmail({
                memberName: 'Clara Almeida',
                memberEmail: 'clara@exemplo.com',
                memberPhone: '+351 915 206 815',
                numeroSocio: 124,
                linguas: ['Português', 'Inglês', 'Espanhol'],
                disponibilidade: 'Julho e Agosto, em blocos de uma semana.',
                esteveGarabandal: 'Sim, em 2024.',
                condicaoFisica: 'Boa mobilidade para caminhadas moderadas.',
                motivacao: 'Desejo ajudar os peregrinos e servir Nossa Senhora com disponibilidade e discrição.',
                adminUrl: `${MOCK_ADMIN_URL}/membros/voluntariado`,
            }),
    },
    'auction-announcement': {
        label: 'Anúncio de leilão',
        title: 'Leilão solidário anunciado',
        category: 'Leilões',
        recipient: 'Contactos elegíveis',
        when: 'Enviado pelo admin ao anunciar uma peça em leilão.',
        why: 'Trazer licitações para apoiar a missão.',
        technical: 'Admin: /api/admin/auction/[id]/announce -> sendAuctionAnnouncementEmail',
        supportsLocale: true,
        render: (language = 'pt') =>
            renderAuctionAnnouncementEmail({
                recipientName: language === 'en' ? 'John' : 'Clara',
                itemTitle: 'Imagem de Nossa Senhora de Garabandal',
                itemDescription: 'Peça solidária oferecida ao Apostolado.',
                imageUrl: 'https://apostoladodegarabandal.com/logo.png',
                startingPrice: 2500,
                currentBid: 4500,
                endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                itemUrl: MOCK_AUCTION_URL,
                locale: language,
            }),
    },
    'auction-outbid': {
        label: 'Lance ultrapassado',
        title: 'Aviso de lance ultrapassado',
        category: 'Leilões',
        recipient: 'Licitador',
        when: 'Enviado quando outro utilizador ultrapassa o lance.',
        why: 'Permitir voltar a licitar antes do fim.',
        technical: 'API: /api/auction/bid -> sendAuctionOutbidEmail',
        supportsLocale: true,
        render: (language = 'pt') =>
            renderAuctionOutbidEmail({
                email: 'licitador@exemplo.com',
                itemTitle: 'Imagem de Nossa Senhora de Garabandal',
                yourBid: 45,
                newBid: 55,
                minIncrement: 5,
                itemUrl: MOCK_AUCTION_URL,
                locale: language,
            }),
    },
    'auction-winner': {
        label: 'Vencedor do leilão',
        title: 'Confirmação de vencedor',
        category: 'Leilões',
        recipient: 'Vencedor',
        when: 'Enviado quando o leilão termina e há vencedor.',
        why: 'Pedir pagamento dentro do prazo.',
        technical: 'Cron/Admin auction close -> sendAuctionWinnerEmail',
        render: () =>
            renderAuctionWinnerEmail({
                email: 'vencedor@exemplo.com',
                winnerName: 'Clara Almeida',
                itemTitle: 'Imagem de Nossa Senhora de Garabandal',
                winningBid: 7500,
                paymentDeadlineHours: 48,
                itemUrl: MOCK_AUCTION_URL,
            }),
    },
    'auction-admin-notification': {
        label: 'Leilão terminado (Admin)',
        title: 'Notificação de leilão terminado',
        category: 'Leilões',
        recipient: 'Admin',
        when: 'Enviado quando o leilão termina com vencedor.',
        why: 'Dar contexto administrativo sobre vencedor e lances.',
        technical: 'Cron/Admin auction close -> sendAuctionAdminNotification',
        render: () =>
            renderAuctionAdminNotificationEmail({
                itemTitle: 'Imagem de Nossa Senhora de Garabandal',
                winnerEmail: 'vencedor@exemplo.com',
                winningBid: 75,
                totalBids: 12,
            }),
    },
    'auction-payment-confirmed': {
        label: 'Pagamento de leilão confirmado',
        title: 'Pagamento confirmado',
        category: 'Leilões',
        recipient: 'Vencedor',
        when: 'Enviado quando o pagamento do leilão é confirmado.',
        why: 'Confirmar pagamento e preparar envio.',
        technical: 'Payment handler -> sendAuctionPaymentConfirmedEmail',
        render: () =>
            renderAuctionPaymentConfirmedEmail({
                itemTitle: 'Imagem de Nossa Senhora de Garabandal',
                winnerName: 'Clara Almeida',
                winningBid: 7500,
                paymentMethod: 'Cartão',
                paymentReference: 'AUC-2026-001',
                paidAt: new Date().toISOString(),
            }),
    },
};

const MARKETING_EMAIL_TEMPLATE_PREVIEWS = Object.fromEntries(
    Object.values(MARKETING_EMAIL_TEMPLATES).map((template) => [
        `marketing-${template.key}`,
        {
            label: template.name,
            title: template.name,
            category: `Marketing — ${template.category}`,
            recipient: 'Contacto de marketing',
            when: 'Enviado por funil, campanha manual ou automação de marketing quando as condições forem cumpridas.',
            why: template.goal,
            technical: `Marketing renderer -> renderMarketingTemplateEmail(${template.key})`,
            supportsLocale: true,
            render: (language: 'pt' | 'en' = 'pt') => renderMarketingPreview(template.key, language),
        } satisfies EmailTemplate,
    ]),
) as Record<string, EmailTemplate>;

const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
    ...SYSTEM_EMAIL_TEMPLATES,
    ...EXTRA_EMAIL_TEMPLATES,
    ...MARKETING_EMAIL_TEMPLATE_PREVIEWS,
};

type TemplateKey = keyof typeof EMAIL_TEMPLATES;

type TemplateEntry = EmailTemplate & { id: TemplateKey };

type ViewKey = TemplateKey | 'overview';

const TEMPLATE_LIST: TemplateEntry[] = Object.entries(EMAIL_TEMPLATES).map(([id, template]) => ({
    id: id as TemplateKey,
    ...template,
}));

const TEMPLATE_GROUPS = TEMPLATE_LIST.reduce((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
}, {} as Record<string, TemplateEntry[]>);

export default function EmailPreviewPage() {
    const [activeView, setActiveView] = useState<ViewKey>('member-welcome');
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [previewLanguage, setPreviewLanguage] = useState<'pt' | 'en'>('pt');

    const isOverview = activeView === 'overview';
    const activeTemplate = isOverview ? null : EMAIL_TEMPLATES[activeView];

    const { htmlContent, subject, errorMessage } = useMemo(() => {
        if (!activeTemplate) {
            return { htmlContent: '', subject: '', errorMessage: '' };
        }

        try {
            const rendered = activeTemplate.render(previewLanguage);
            return { htmlContent: rendered.html, subject: rendered.subject || '', errorMessage: '' };
        } catch (error: any) {
            return {
                htmlContent: '<div style="padding:20px;color:red;">Erro ao renderizar template.</div>',
                subject: '',
                errorMessage: error?.message || 'Erro desconhecido',
            };
        }
    }, [activeTemplate, previewLanguage]);

    return (
        <AdminLayout title="Previews de Emails do Sistema">
            <div className="flex h-[calc(100vh-140px)] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">

                {/* Sidebar */}
                <aside className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 border-b border-slate-100">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sistema de Emails</h2>
                        <p className="text-[10px] text-slate-400 mt-1">{TEMPLATE_LIST.length} previews disponíveis</p>
                        <Link
                            href="/admin/marketing/flow"
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                        >
                            Ver fluxo de marketing
                        </Link>
                    </div>
                    <nav className="flex-1 p-2 space-y-4">
                        <button
                            onClick={() => setActiveView('overview')}
                            className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group ${
                                activeView === 'overview'
                                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <span>📋 Todos os Emails</span>
                            {activeView === 'overview' && <ChevronRight className="w-4 h-4 text-indigo-500" />}
                        </button>

                        {Object.entries(TEMPLATE_GROUPS).map(([category, templates]) => (
                            <div key={category}>
                                <div className="px-3 mb-2 text-[10px] font-bold uppercase text-slate-400">{category}</div>
                                {templates.map((template) => (
                                    <TemplateBtn
                                        key={template.id}
                                        id={template.id}
                                        label={template.label}
                                        active={activeView}
                                        onClick={(id) => setActiveView(id)}
                                    />
                                ))}
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Main Preview */}
                <main className="flex-1 flex flex-col bg-slate-100">

                    {/* Trigger Info Box */}
                    <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-indigo-500" />
                                    {isOverview ? 'Todos os Emails do Sistema' : activeTemplate?.title}
                                </h2>
                                {isOverview ? (
                                    <p className="text-sm text-slate-500 mt-2">
                                        {TEMPLATE_LIST.length} templates disponíveis. Clique num email para abrir o preview.
                                    </p>
                                ) : (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <Info className="w-4 h-4 text-slate-400 mt-0.5" />
                                            <span><strong>Destinatário:</strong> {activeTemplate?.recipient}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <Info className="w-4 h-4 text-slate-400 mt-0.5" />
                                            <span><strong>Quando:</strong> {activeTemplate?.when}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <Info className="w-4 h-4 text-slate-400 mt-0.5" />
                                            <span><strong>Objetivo:</strong> {activeTemplate?.why}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">
                                            <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5" />
                                            <span>{activeTemplate?.technical}</span>
                                        </div>
                                        {subject ? (
                                            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                                                <span className="font-bold">Assunto:</span> {subject}
                                            </div>
                                        ) : null}
                                        {errorMessage ? (
                                            <div className="text-xs text-red-500">Erro: {errorMessage}</div>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            {/* View Controls */}
                            {!isOverview && (
                                <div className="flex flex-wrap items-center gap-2 self-start">
                                    {activeTemplate?.supportsLocale && (
                                        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                            <Languages className="ml-2 h-4 w-4 text-slate-400" />
                                            <button
                                                onClick={() => setPreviewLanguage('pt')}
                                                className={`rounded-md px-3 py-2 text-xs font-bold transition-colors ${previewLanguage === 'pt' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                PT
                                            </button>
                                            <button
                                                onClick={() => setPreviewLanguage('en')}
                                                className={`rounded-md px-3 py-2 text-xs font-bold transition-colors ${previewLanguage === 'en' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                EN
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex rounded-lg bg-slate-100 p-1">
                                        <button
                                            onClick={() => setViewMode('desktop')}
                                            className={`p-2 rounded-md transition-colors ${viewMode === 'desktop' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Monitor className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('mobile')}
                                            className={`p-2 rounded-md transition-colors ${viewMode === 'mobile' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Smartphone className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 overflow-hidden flex items-center justify-center p-8 bg-slate-200/50">
                        {isOverview ? (
                            <div className="w-full max-w-5xl space-y-6 overflow-y-auto max-h-full pr-2">
                                {Object.entries(TEMPLATE_GROUPS).map(([category, templates]) => (
                                    <div key={category} className="space-y-2">
                                        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">{category}</h3>
                                        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                                            {templates.map((template) => (
                                                <button
                                                    key={template.id}
                                                    onClick={() => setActiveView(template.id)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-800">{template.label}</div>
                                                            <div className="text-xs text-slate-500">{template.recipient}</div>
                                                        </div>
                                                        <div className="text-xs text-slate-600 space-y-1">
                                                            <div><span className="font-semibold text-slate-500">Quando:</span> {template.when}</div>
                                                            <div><span className="font-semibold text-slate-500">Objetivo:</span> {template.why}</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div
                                className={`bg-white shadow-2xl transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${
                                    viewMode === 'mobile'
                                        ? 'w-[375px] h-[667px] rounded-[30px] border-[8px] border-slate-800'
                                        : 'w-full max-w-4xl h-full rounded-lg border border-slate-300'
                                }`}
                            >
                                <iframe
                                    srcDoc={htmlContent}
                                    className="w-full h-full border-none bg-white"
                                    title="Pré-visualização de Email"
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </AdminLayout>
    );
}

function TemplateBtn({
    id,
    label,
    active,
    onClick,
}: {
    id: TemplateKey;
    label: string;
    active: ViewKey;
    onClick: (id: TemplateKey) => void;
}) {
    return (
        <button
            onClick={() => onClick(id)}
            className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group ${
                active === id
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
        >
            <span>{label}</span>
            {active === id && <ChevronRight className="w-4 h-4 text-indigo-500" />}
        </button>
    );
}
