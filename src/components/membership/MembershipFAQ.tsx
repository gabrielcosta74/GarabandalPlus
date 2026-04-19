"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useLocale } from "../../contexts/LocaleContext";

export default function MembershipFAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const { t } = useLocale();
    const f = t.membership.faq;

    return (
        <section className="py-24 bg-garabandal-mist">
            <div className="container mx-auto px-6 max-w-4xl">
                <div className="text-center mb-16">
                    <h2 className="font-serif text-3xl md:text-4xl text-garabandal-dark mb-4">{f.title}</h2>
                    <p className="text-gray-500">{f.subtitle}</p>
                </div>

                <div className="space-y-4">
                    {f.items.map((faq, idx) => {
                        const isOpen = openIndex === idx;
                        return (
                            <div
                                key={idx}
                                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
                            >
                                <button
                                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                                    aria-expanded={isOpen}
                                    aria-controls={`membership-faq-answer-${idx}`}
                                    className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-gray-50/60"
                                >
                                    <span className={`font-medium ${isOpen ? 'text-garabandal-gold' : 'text-gray-700'}`}>
                                        {faq.q}
                                    </span>
                                    <span
                                        className={`p-2 rounded-full transition-all duration-300 ${isOpen ? 'bg-garabandal-gold text-white' : 'bg-gray-50 text-gray-400'}`}
                                    >
                                        <Plus size={16} className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`} />
                                    </span>
                                </button>

                                <div
                                    id={`membership-faq-answer-${idx}`}
                                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="px-6 pb-6 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-4">
                                            {faq.a}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
