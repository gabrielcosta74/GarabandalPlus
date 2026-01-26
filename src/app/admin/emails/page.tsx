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
    renderWelcomeEmail,
    renderFactPtClientEmail,
    renderFactPtAdminEmail,
} from '../../../lib/email-renderer';
import { Mail, Smartphone, Monitor, ChevronRight, Info, CheckCircle } from 'lucide-react';

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

const MOCK_FACTPT = {
    recipientName: 'Joao Santos',
    documentId: 'FT 2025/0001',
    documentUrl: 'https://fact.pt/documents/FT2025-0001',
    sourceType: 'store' as const,
    sourceRef: 'ORD-2025-001',
};

const MOCK_QUOTA_LINK = 'https://apostoladodegarabandal.com/tornar-membro';

type EmailTemplate = {
    label: string;
    title: string;
    category: string;
    recipient: string;
    when: string;
    why: string;
    technical: string;
    render: () => { html: string; subject?: string };
};

const EMAIL_TEMPLATES = {
    'member-welcome': {
        label: '👋 Membership Payment (Admin)',
        title: 'Membership Welcome',
        category: 'Membership & Quotas',
        recipient: 'Admin',
        when: 'Sent after a membership payment is confirmed.',
        why: 'Notify admins about new or renewed memberships.',
        technical: 'Webhook: /api/webhook or /api/reduniq/result -> sendMembershipNotification',
        render: () => renderMembershipEmail(MOCK_MEMBER),
    },
    'member-receipt': {
        label: '🧾 Member Receipt',
        title: 'Member Receipt',
        category: 'Membership & Quotas',
        recipient: 'Member',
        when: 'Sent when a membership payment succeeds.',
        why: 'Provide payment confirmation and membership details.',
        technical: 'Webhook: /api/webhook or /api/reduniq/result -> sendMemberReceiptEmail',
        render: () => renderMemberReceiptEmail(MOCK_MEMBER_RECEIPT),
    },
    'member-diploma': {
        label: '🎓 Member Diploma',
        title: 'Member Diploma',
        category: 'Membership & Quotas',
        recipient: 'Member',
        when: 'Sent after a new member payment when a diploma is generated.',
        why: 'Deliver the membership diploma to the new member.',
        technical: 'Webhook: /api/webhook -> sendMemberDiplomaEmail',
        render: () => renderMemberDiplomaEmail(MOCK_MEMBER_DIPLOMA),
    },
    'member-reminder': {
        label: '⏰ Quota Reminder',
        title: 'Quota Reminder',
        category: 'Membership & Quotas',
        recipient: 'Member',
        when: 'Daily cron checks upcoming and overdue quotas.',
        why: 'Remind members to renew their quota on time.',
        technical: 'Cron: /api/cron/quota-reminders -> sendQuotaReminderEmail',
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
        label: '⚠️ Quota Warning',
        title: 'Quota Warning',
        category: 'Membership & Quotas',
        recipient: 'Member',
        when: 'Sent when a quota is close to expiring.',
        why: 'Warn members before their quota expires.',
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
        label: '⌛ Quota Overdue',
        title: 'Quota Overdue',
        category: 'Membership & Quotas',
        recipient: 'Member',
        when: 'Sent after the quota date has passed (grace period).',
        why: 'Notify members that their quota is overdue.',
        technical: 'Cron: /api/cron/membership-rules -> sendQuotaOverdueEmail',
        render: () =>
            renderQuotaOverdueEmail({
                name: 'Maria Silva',
                email: 'maria@exemplo.com',
                payLink: MOCK_QUOTA_LINK,
            }),
    },
    'quota-revoked': {
        label: '⛔ Membership Revoked',
        title: 'Membership Revoked',
        category: 'Membership & Quotas',
        recipient: 'Member',
        when: 'Sent after the grace period ends without payment.',
        why: 'Inform that membership access is suspended and how to reactivate.',
        technical: 'Cron: /api/cron/membership-rules -> sendMembershipRevokedEmail',
        render: () =>
            renderMembershipRevokedEmail({
                name: 'Maria Silva',
                email: 'maria@exemplo.com',
                payLink: MOCK_QUOTA_LINK,
            }),
    },
    'account-welcome': {
        label: '✨ Account Welcome',
        title: 'Welcome Email',
        category: 'Membership & Quotas',
        recipient: 'Member',
        when: 'Template available after account activation (not automated yet).',
        why: 'Welcome the user and direct them to login.',
        technical: 'Template available (no sender wired).',
        render: () => renderWelcomeEmail({ name: 'Maria Silva', email: 'maria@exemplo.com' }),
    },
    'donation-receipt': {
        label: '❤️ Donation Receipt',
        title: 'Donation Receipt',
        category: 'Donations',
        recipient: 'Donor',
        when: 'Sent immediately after a successful donation.',
        why: 'Provide a receipt and thank you message.',
        technical: 'Webhook: /api/webhook or /api/reduniq/result -> sendDonationReceiptEmail',
        render: () => renderDonationReceiptEmail(MOCK_DONATION),
    },
    'donation-notification': {
        label: '📣 Donation Notification (Admin)',
        title: 'Donation Notification',
        category: 'Donations',
        recipient: 'Admin',
        when: 'Sent when a manual donation is recorded.',
        why: 'Notify admins for accounting follow-up.',
        technical: 'API: /api/donations/manual -> sendDonationNotification',
        render: () => renderDonationNotification(MOCK_DONATION_NOTIFICATION),
    },
    'store-owner': {
        label: '🛍️ New Store Order (Admin)',
        title: 'Store Order (Admin)',
        category: 'Online Store',
        recipient: 'Store Admin',
        when: 'Sent after a store checkout completes.',
        why: 'Notify the store owner about a new order.',
        technical: 'Store flow -> sendStoreOwnerEmail',
        render: () => renderStoreOwnerEmail(MOCK_STORE),
    },
    'store-confirm': {
        label: '🧾 Store Order Confirmation',
        title: 'Store Order Confirmation',
        category: 'Online Store',
        recipient: 'Buyer',
        when: 'Sent immediately after a successful purchase.',
        why: 'Confirm the order and provide access details.',
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
        label: '📦 Order Preparing',
        title: 'Order Preparing',
        category: 'Online Store',
        recipient: 'Buyer',
        when: 'Sent after payment for orders with physical items.',
        why: 'Inform the customer that the order is being prepared.',
        technical: 'Store flow -> sendStorePreparingEmail',
        render: () =>
            renderStorePreparingEmail({
                orderRef: 'ORD-2025-001',
                buyerEmail: 'joao@exemplo.com',
                buyerName: 'Joao Santos',
            }),
    },
    'store-shipped': {
        label: '🚚 Order Shipped',
        title: 'Order Shipped',
        category: 'Online Store',
        recipient: 'Buyer',
        when: 'Sent when an admin adds tracking and marks the order as shipped.',
        why: 'Share tracking details and confirm dispatch.',
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
        label: '📋 Waitlist Confirmation',
        title: 'Waitlist Confirmation',
        category: 'Leads & Pilgrimages',
        recipient: 'Lead',
        when: 'Sent when a lead is captured without a pilgrimage date.',
        why: 'Confirm the waiting list registration.',
        technical: 'API: /api/leads/capture -> sendGeneralLeadEmail',
        render: () =>
            renderGeneralLeadEmail({
                email: 'waitlist@test.com',
                name: 'Peregrino Interessado',
            }),
    },
    'lead-brochure': {
        label: '🧭 Brochure Delivery',
        title: 'Pilgrimage Brochure',
        category: 'Leads & Pilgrimages',
        recipient: 'Lead',
        when: 'Sent when a lead requests the pilgrimage brochure.',
        why: 'Deliver the requested PDF itinerary.',
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
        label: '↩️ Abandonment Recovery',
        title: 'Abandonment Recovery',
        category: 'Leads & Pilgrimages',
        recipient: 'Lead',
        when: 'Sent after 30 minutes of inactivity on a draft registration.',
        why: 'Encourage the user to complete the registration.',
        technical: 'Cron: /api/cron/recover-leads -> sendAbandonmentRecoveryEmail',
        render: () =>
            renderAbandonmentRecoveryEmail({
                email: 'recovery@test.com',
                name: 'Peregrino',
                pilgrimageName: 'Garabandal - Maio 2025',
                recoveryLink: 'https://apostoladodegarabandal.com/peregrinacoes/garabandal-maio/inscrever?resume=123',
            }),
    },
    'booking-confirmation': {
        label: '✅ Booking Confirmation',
        title: 'Booking Confirmation',
        category: 'Leads & Pilgrimages',
        recipient: 'Pilgrim',
        when: 'Sent after a pilgrimage pre-booking is created.',
        why: 'Confirm the reservation and provide the payment link.',
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
    'factpt-client': {
        label: '🧾 Fact.pt Document (Client)',
        title: 'Fact.pt Document (Client)',
        category: 'Billing & Invoicing',
        recipient: 'Client',
        when: 'Sent when a certified invoice is issued.',
        why: 'Deliver the fact.pt document to the client.',
        technical: 'fact.pt issuer -> sendFactPtClientDocumentEmail',
        render: () => renderFactPtClientEmail(MOCK_FACTPT),
    },
    'factpt-admin': {
        label: '📨 Fact.pt Document (Admin)',
        title: 'Fact.pt Document (Admin)',
        category: 'Billing & Invoicing',
        recipient: 'Admin',
        when: 'Sent when a certified invoice is issued.',
        why: 'Notify admin/accounting with a copy of the invoice.',
        technical: 'fact.pt issuer -> sendFactPtAdminDocumentEmail',
        render: () => renderFactPtAdminEmail(MOCK_FACTPT),
    },
} satisfies Record<string, EmailTemplate>;

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

    const isOverview = activeView === 'overview';
    const activeTemplate = isOverview ? null : EMAIL_TEMPLATES[activeView];

    const { htmlContent, errorMessage } = useMemo(() => {
        if (!activeTemplate) {
            return { htmlContent: '', errorMessage: '' };
        }

        try {
            const rendered = activeTemplate.render();
            return { htmlContent: rendered.html, errorMessage: '' };
        } catch (error: any) {
            return {
                htmlContent: '<div style="padding:20px;color:red;">Erro ao renderizar template.</div>',
                errorMessage: error?.message || 'Erro desconhecido',
            };
        }
    }, [activeTemplate]);

    return (
        <AdminLayout title="System Emails Preview">
            <div className="flex h-[calc(100vh-140px)] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">

                {/* Sidebar */}
                <aside className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 border-b border-slate-100">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email System</h2>
                        <p className="text-[10px] text-slate-400 mt-1">Select a template to view details</p>
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
                            <span>📋 All Emails</span>
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
                                    {isOverview ? 'All System Emails' : activeTemplate?.title}
                                </h2>
                                {isOverview ? (
                                    <p className="text-sm text-slate-500 mt-2">
                                        {TEMPLATE_LIST.length} templates available. Click any email in the list to preview.
                                    </p>
                                ) : (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <Info className="w-4 h-4 text-slate-400 mt-0.5" />
                                            <span><strong>Recipient:</strong> {activeTemplate?.recipient}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <Info className="w-4 h-4 text-slate-400 mt-0.5" />
                                            <span><strong>When:</strong> {activeTemplate?.when}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <Info className="w-4 h-4 text-slate-400 mt-0.5" />
                                            <span><strong>Why:</strong> {activeTemplate?.why}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">
                                            <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5" />
                                            <span>{activeTemplate?.technical}</span>
                                        </div>
                                        {errorMessage ? (
                                            <div className="text-xs text-red-500">Erro: {errorMessage}</div>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            {/* View Controls */}
                            {!isOverview && (
                                <div className="flex bg-slate-100 rounded-lg p-1 self-start">
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
                                                            <div>
                                                                <span className="font-semibold text-slate-500">When:</span> {template.when}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-slate-500">Why:</span> {template.why}
                                                            </div>
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
                                    title="Email Preview"
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
