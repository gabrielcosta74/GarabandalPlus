"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MembershipModal from "../../components/membership/MembershipModal";
import MembershipLanding from "../../components/membership/MembershipLanding";
import { QuotaWarning } from "../../components/membership/QuotaWarning";
import { useAuth } from "../../contexts/AuthContext";
import { getMembershipAmountClient } from "../../lib/membership-pricing";
import { useLocale } from "../../contexts/LocaleContext";
import { useCurrency } from "../../components/providers/CurrencyProvider";

function TornarMembroContent() {
    const search = useSearchParams();
    const refParam = search.get("ref");
    const joinParam = search.get("join");
    const router = useRouter();
    const { isMember, memberData, loading, isAuthenticated } = useAuth();
    const { t, locale } = useLocale();
    const m = t.membership;
    const { formatPrice } = useCurrency();
    const [modalOpen, setModalOpen] = useState(false);
    const membershipAmount = getMembershipAmountClient();
    const [impact, setImpact] = useState({ members: 0, raised: 0, goal: 2500 });
    const hasMembership = !!memberData?.is_membro;

    // Load impact stats from API
    useEffect(() => {
        const loadImpact = async () => {
            try {
                const res = await fetch("/api/membership/impact");
                if (res.ok) {
                    const data = await res.json();
                    setImpact({
                        members: Number(data.members || 0),
                        raised: Number(data.raised || 0),
                        goal: Number(data.goal || 2500),
                    });
                }
            } catch (e) {
                console.error(e);
            }
        };
        loadImpact();
    }, []);

    useEffect(() => {
        if (!loading && isAuthenticated && hasMembership) {
            router.replace(locale === 'en' ? "/en/member" : "/member");
        }
    }, [hasMembership, isAuthenticated, loading, locale, router]);

    // Auto-open modal if ?join=1 or ?ref is present
    useEffect(() => {
        if ((joinParam === "1" || refParam) && !hasMembership) {
            setModalOpen(true);
        }
    }, [hasMembership, joinParam, refParam]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full" />
            </div>
        );
    }
    if (isAuthenticated && hasMembership) return null;

    // Same formatter as the landing, so the sticky bar shows the visitor's currency too.
    const priceLabel = formatPrice(membershipAmount);

    return (
        <main className="min-h-screen bg-white pb-24 md:pb-0">
            <MembershipLanding
                onJoin={() => setModalOpen(true)}
                impact={impact}
                notice={<QuotaWarning memberData={memberData} />}
            />

            <MembershipModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                impact={impact}
                referralCode={refParam || undefined}
            />

            {/* Mobile Sticky Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-line z-50">
                <button
                    onClick={() => setModalOpen(true)}
                    className="w-full min-h-14 rounded-full bg-brand text-base font-semibold text-white transition-colors hover:bg-brand-700"
                >
                    {m.mobileBar.cta} · {priceLabel}
                </button>
            </div>
        </main>
    );
}

function MembershipSuspenseFallback() {
    return (
        <div className="h-screen flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full" />
        </div>
    );
}

export default function MembershipClient() {
    return (
        <Suspense fallback={<MembershipSuspenseFallback />}>
            <TornarMembroContent />
        </Suspense>
    );
}
