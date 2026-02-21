"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MembershipHero from "../../components/membership/MembershipHero";
import MembershipBenefits from "../../components/membership/MembershipBenefits";
import MembershipImpact from "../../components/membership/MembershipImpact";
import MembershipFAQ from "../../components/membership/MembershipFAQ";
import MembershipModal from "../../components/membership/MembershipModal";
import { QuotaWarning } from "../../components/membership/QuotaWarning";
import { useAuth } from "../../contexts/AuthContext";
import { getMembershipAmountClient } from "../../lib/membership-pricing";

function TornarMembroContent() {
    const search = useSearchParams();
    const refParam = search.get("ref");
    const joinParam = search.get("join");
    const router = useRouter();
    const { isMember, memberData, loading, isAuthenticated } = useAuth();
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
            router.replace("/member");
        }
    }, [hasMembership, isAuthenticated, loading, router]);

    // Auto-open modal if ?join=1 or ?ref is present
    useEffect(() => {
        if ((joinParam === "1" || refParam) && !hasMembership) {
            setModalOpen(true);
        }
    }, [hasMembership, joinParam, refParam]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="animate-spin w-8 h-8 border-2 border-garabandal-gold border-t-transparent rounded-full" />
            </div>
        );
    }
    if (isAuthenticated && hasMembership) return null;

    return (
        <main className="min-h-screen bg-white">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-24 lg:mt-28 mb-4">
                <QuotaWarning memberData={memberData} />
            </div>
            <MembershipHero onJoinClick={() => setModalOpen(true)} />
            <MembershipBenefits />
            <MembershipImpact stats={impact} />
            <MembershipFAQ />

            <MembershipModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                impact={impact}
                referralCode={refParam || undefined}
            />

            {/* Mobile Sticky Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-100 z-50">
                <button
                    onClick={() => setModalOpen(true)}
                    className="w-full py-4 bg-garabandal-dark text-white rounded-xl font-bold uppercase tracking-widest shadow-lg"
                >
                    Tornar-me Membro · {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(membershipAmount)}
                </button>
            </div>
        </main>
    );
}

export default function MembershipClient() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center">A carregar...</div>}>
            <TornarMembroContent />
        </Suspense>
    );
}
