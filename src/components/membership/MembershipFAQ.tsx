"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const faqs = [
    {
        question: "Posso pagar com MB WAY?",
        answer: "Sim. No passo de pagamento tens a opção 'Reduniq' que permite pagar via MB WAY, Multibanco e cartões de crédito nacionais."
    },
    {
        question: "Preciso criar uma conta?",
        answer: "Se já tiveres conta no site, basta fazer login. Se não, podes criar uma conta rapidamente durante o processo de adesão para gerires a tua subscrição."
    },
    {
        question: "A subscrição renova automaticamente?",
        answer: "Sim, a quota é anual. Receberás sempre um aviso antes da renovação e podes cancelar a qualquer momento na tua área de membro."
    },
    {
        question: "O que acontece ao dinheiro da quota?",
        answer: "Todo o valor é aplicado na missão do Apostolado: manutenção da sede, custos editoriais das publicações, organização de eventos e apoio social e espiritual aos peregrinos."
    }
];

export default function MembershipFAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="py-24 bg-garabandal-mist">
            <div className="container mx-auto px-6 max-w-4xl">
                <div className="text-center mb-16">
                    <h2 className="font-serif text-3xl md:text-4xl text-garabandal-dark mb-4">Perguntas Frequentes</h2>
                    <p className="text-gray-500">Dúvidas comuns sobre o processo de adesão.</p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, idx) => {
                        const isOpen = openIndex === idx;
                        return (
                            <motion.div
                                key={idx}
                                initial={false}
                                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
                            >
                                <button
                                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                                    className="w-full flex items-center justify-between p-6 text-left"
                                >
                                    <span className={`font-medium ${isOpen ? 'text-garabandal-gold' : 'text-gray-700'}`}>
                                        {faq.question}
                                    </span>
                                    <span className={`p-2 rounded-full transition-colors ${isOpen ? 'bg-garabandal-gold text-white' : 'bg-gray-50 text-gray-400'}`}>
                                        {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                                    </span>
                                </button>
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <div className="px-6 pb-6 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-4">
                                                {faq.answer}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
