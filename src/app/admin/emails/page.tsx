"use client";

import { useState, useEffect } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import {
    renderMembershipEmail,
    renderMemberReceiptEmail,
    renderQuotaReminderEmail,
    renderStoreBuyerEmail,
    renderStoreShippingEmail,
    renderStorePreparingEmail,
    renderDonationReceiptEmail,
    renderGeneralLeadEmail,
    renderAbandonmentRecoveryEmail,
} from '../../../lib/email-renderer';
import { Mail, Smartphone, Monitor, ChevronRight, Info, Clock, CheckCircle } from 'lucide-react';

// --- MOCK DATA ---
const MOCK_MEMBER = {
    kind: 'new' as const,
    memberName: 'Maria Silva',
    memberNumber: 1234,
    amount: 2500,
    paymentMethod: 'Stripe',
    nextQuotaDate: '2026-01-31'
};

const MOCK_STORE = {
    orderRef: 'ORD-2025-001',
    buyerName: 'João Santos',
    buyerEmail: 'joao@exemplo.com',
    subtotal: '45.00',
    vat: '10.35',
    total: '55.35',
    items: [
        { name: 'Livro O Aviso', qty: 1, unit_price: 15.00 },
        { name: 'Terço Oficial', qty: 2, unit_price: 15.00 }
    ],
    shipping: {
        address1: 'Rua das Flores, 123',
        city: 'Lisboa',
        postalCode: '1000-001',
        country: 'Portugal'
    }
};

type TemplateKey = 'member-welcome' | 'member-receipt' | 'member-reminder' | 'store-confirm' | 'store-shipped' | 'store-preparing' | 'donation-receipt' | 'lead-waitlist' | 'lead-abandonment';

export default function EmailPreviewPage() {
    const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('member-welcome');
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [htmlContent, setHtmlContent] = useState('');
    const [triggerInfo, setTriggerInfo] = useState<{ title: string; trigger: string; technical: string }>({ title: '', trigger: '', technical: '' });

    useEffect(() => {
        // Generate HTML based on selected template
        let generated: { html: string; subject?: string } = { html: '' };
        let info = { title: '', trigger: '', technical: '' };

        try {
            switch (activeTemplate) {
                case 'member-welcome':
                    generated = renderMembershipEmail(MOCK_MEMBER);
                    info = {
                        title: "Membership Welcome",
                        trigger: "Sent immediately after a new member successfully pays their quota via Stripe.",
                        technical: "Webhook: checkout.session.completed (type=membership) -> sendMembershipNotification"
                    };
                    break;
                case 'member-receipt':
                    generated = renderMemberReceiptEmail({ ...MOCK_MEMBER, toEmail: 'test@test.com' });
                    info = {
                        title: "Member Receipt",
                        trigger: "Sent as payment confirmation for both new registrations and renewals.",
                        technical: "Webhook: checkout.session.completed -> sendMemberReceiptEmail"
                    };
                    break;
                case 'member-reminder':
                    generated = renderQuotaReminderEmail({
                        toEmail: 'test@test.com',
                        memberName: 'Maria Silva',
                        memberNumber: 1234,
                        daysUntilDue: 30,
                        nextQuotaDate: '2026-01-31'
                    });
                    info = {
                        title: "Quota Reminder",
                        trigger: "Sent 30, 7, and 1 day BEFORE due date. Also sent when OVERDUE by 7, 14, and 30 days.",
                        technical: "Cron Job (Daily) -> sendQuotaReminderEmail"
                    };
                    break;
                case 'store-confirm':
                    generated = renderStoreBuyerEmail(MOCK_STORE);
                    info = {
                        title: "Store Order Confirmation",
                        trigger: "Sent to the customer immediately after a successful purchase.",
                        technical: "Webhook: checkout.session.completed (type=store) -> sendStoreBuyerEmail"
                    };
                    break;
                case 'store-shipped':
                    generated = renderStoreShippingEmail({
                        orderRef: 'ORD-2025-001',
                        buyerName: 'João Santos',
                        tracking: 'CTT-123456789PT',
                        shippedAt: new Date().toISOString()
                    });
                    info = {
                        title: "Order Shipped",
                        trigger: "Sent when an admin manually adds a tracking code to an order.",
                        technical: "Admin Action -> sendStoreShippingEmail"
                    };
                    break;
                case 'store-preparing':
                    generated = renderStorePreparingEmail({
                        orderRef: 'ORD-2025-001',
                        buyerEmail: 'joao@test.com',
                        buyerName: 'João Santos'
                    });
                    info = {
                        title: "Order Preparing",
                        trigger: "Sent automatically for orders with physical items after payment.",
                        technical: "Webhook: checkout.session.completed (if has_physical) -> sendStorePreparingEmail"
                    };
                    break;
                case 'donation-receipt':
                    generated = renderDonationReceiptEmail({
                        toEmail: 'donor@test.com',
                        donorName: 'Ana Benfeitora',
                        amount: 50.00,
                        method: 'Stripe',
                        paidAt: new Date().toISOString()
                    });
                    info = {
                        title: "Donation Receipt",
                        trigger: "Sent immediately after a successful donation.",
                        technical: "Webhook: checkout.session.completed (type=donation) -> sendDonationReceiptEmail"
                    };
                    break;
                case 'lead-waitlist':
                    generated = renderGeneralLeadEmail({
                        email: 'waitlist@test.com',
                        name: 'Peregrino Interessado'
                    });
                    info = {
                        title: "Waitlist Join",
                        trigger: "Sent when a user signs up for the general pilgrimage waiting list.",
                        technical: "API: /api/leads/capture -> sendGeneralLeadEmail"
                    };
                    break;
                case 'lead-abandonment':
                    generated = renderAbandonmentRecoveryEmail({
                        email: 'recovery@test.com',
                        name: 'Peregrino',
                        pilgrimageName: 'Garabandal - Maio 2025',
                        recoveryLink: 'https://apostoladodegarabandal.com/peregrinacoes/garabandal-maio/inscrever?resume=123'
                    });
                    info = {
                        title: "Abandonment Recovery",
                        trigger: "Sent if a user starts registration (status 'draft') but doesn't finish within 30 minutes.",
                        technical: "Cron Job (Every 15m) -> sendAbandonmentRecoveryEmail"
                    };
                    break;
                default:
                    generated = { html: '<div style="padding:20px;text-align:center;color:#666;">Selecione um template</div>' };
                    info = { title: 'Select a Template', trigger: '-', technical: '-' };
            }
            setHtmlContent(generated.html);
            setTriggerInfo(info);
        } catch (e: any) {
            console.error(e);
            setHtmlContent(`<div style="padding:20px;color:red;">Erro ao renderizar template: ${e?.message || 'Erro desconhecido'}</div>`);
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

                        <div>
                            <div className="px-3 mb-2 text-[10px] font-bold uppercase text-slate-400">Membership & Quotas</div>
                            <TemplateBtn
                                id="member-welcome"
                                label="👋 Welcome Member"
                                active={activeTemplate}
                                onClick={setActiveTemplate}
                            />
                            <TemplateBtn
                                id="member-receipt"
                                label="🧾 Member Receipt"
                                active={activeTemplate}
                                onClick={setActiveTemplate}
                            />
                            <TemplateBtn
                                id="member-reminder"
                                label="⏰ Quota Reminder"
                                active={activeTemplate}
                                onClick={setActiveTemplate}
                            />
                        </div>

                        <div>
                            <div className="px-3 mb-2 text-[10px] font-bold uppercase text-slate-400">Online Store</div>
                            <TemplateBtn
                                id="store-confirm"
                                label="🛍️ Order Confirm"
                                active={activeTemplate}
                                onClick={setActiveTemplate}
                            />
                            <TemplateBtn
                                id="store-preparing"
                                label="📦 Order Preparing"
                                active={activeTemplate}
                                onClick={setActiveTemplate}
                            />
                            <TemplateBtn
                                id="store-shipped"
                                label="🚚 Order Shipped"
                                active={activeTemplate}
                                onClick={setActiveTemplate}
                            />
                        </div>

                        <div>
                            <div className="px-3 mb-2 text-[10px] font-bold uppercase text-slate-400">Leads & Donations</div>
                            <TemplateBtn
                                id="lead-waitlist"
                                label="📋 Waitlist (New)"
                                active={activeTemplate}
                                onClick={setActiveTemplate}
                            />
                            <TemplateBtn
                                id="lead-abandonment"
                                label="u21A9ufe0f Abandonment Recovery"
                                active={activeTemplate}
                                onClick={setActiveTemplate}
                            />
                            <TemplateBtn
                                id="donation-receipt"
                                label="❤️ Donation Receipt"
                                active={activeTemplate}
                                onClick={setActiveTemplate}
                            />
                        </div>

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
                                    {triggerInfo.title}
                                </h2>
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-start gap-2 text-sm text-slate-600">
                                        <Info className="w-4 h-4 text-slate-400 mt-0.5" />
                                        <span><strong>Trigger:</strong> {triggerInfo.trigger}</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">
                                        <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5" />
                                        <span>{triggerInfo.technical}</span>
                                    </div>
                                </div>
                            </div>

                            {/* View Controls */}
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
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 overflow-hidden flex items-center justify-center p-8 bg-slate-200/50">
                        <div
                            className={`bg-white shadow-2xl transition-all duration-300 ease-in-out overflow-hidden flex flex-col
                                ${viewMode === 'mobile' ? 'w-[375px] h-[667px] rounded-[30px] border-[8px] border-slate-800' : 'w-full max-w-4xl h-full rounded-lg border border-slate-300'}
                            `}
                        >
                            <iframe
                                srcDoc={htmlContent}
                                className="w-full h-full border-none bg-white"
                                title="Email Preview"
                            />
                        </div>
                    </div>
                </main>
            </div>
        </AdminLayout>
    );
}

function TemplateBtn({ id, label, active, onClick }: { id: TemplateKey, label: string, active: string, onClick: (id: TemplateKey) => void }) {
    return (
        <button
            onClick={() => onClick(id)}
            className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group
                ${active === id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
            `}
        >
            <span>{label}</span>
            {active === id && <ChevronRight className="w-4 h-4 text-indigo-500" />}
        </button>
    );
}
