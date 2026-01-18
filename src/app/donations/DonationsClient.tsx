"use client";

import { useEffect, useState } from 'react';
import DonationHero from '../../components/donations/DonationHero';
import DonationStory from '../../components/donations/DonationStory';
import DonationAllocation from '../../components/donations/DonationAllocation';
import DonationFAQ from '../../components/donations/DonationFAQ';
import DonationModal from '../../components/donations/DonationModal';

type ProgressMeta = {
    goal: number;
    raised: number;
};

export default function DonationsClient() {
    const [progress, setProgress] = useState<ProgressMeta>({ goal: 2500, raised: 0 });
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        const loadProgress = async () => {
            try {
                const res = await fetch('/api/donations/meta');
                if (!res.ok) return;
                const data = await res.json();
                setProgress({ goal: Number(data.goal || 0), raised: Number(data.raised || 0) });
            } catch {
                setProgress((prev) => prev);
            }
        };
        loadProgress();
    }, []);

    return (
        <main className="bg-white min-h-screen">
            <DonationHero progress={progress} onDonateClick={() => setModalOpen(true)} />
            <DonationStory />
            <DonationAllocation />
            <DonationFAQ />

            {/* Footer CTA */}
            <section className="py-24 bg-garabandal-dark text-white text-center">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl md:text-5xl font-serif mb-6">Juntos construímos o futuro</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto mb-10">
                        A tua generosidade permite-nos continuar a acolher com amor e dignidade. Obrigado por fazeres parte desta missão.
                    </p>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="px-10 py-4 bg-garabandal-gold text-garabandal-dark font-bold rounded-full hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all duration-300"
                    >
                        Fazer uma Doação
                    </button>
                </div>
            </section>

            <DonationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </main>
    );
}
