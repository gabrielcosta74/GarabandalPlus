import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

export default function DonationFAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const faqs = [
        {
            q: 'A doação é segura?',
            a: 'Absolutamente. Utilizamos o processador de pagamento Reduniq com certificação de segurança máxima (PCI DSS). Os seus dados são encriptados e nunca guardamos informações de cartões.',
        },
        {
            q: 'Posso pedir recibo fiscal da doação?',
            a: 'Sim. Durante o processo de doação, basta preencher os dados fiscais (NIF/CPF). O recibo será emitido e enviado para o seu email automaticamente após a confirmação do pagamento.',
        },
        {
            q: 'Existem outras formas de doar além do site?',
            a: 'Sim. Aceitamos transferências bancárias diretas. Por favor, entre em contacto connosco através do email geral@apostoladodegarabandal.com para obter o IBAN.',
        },
        {
            q: 'Como sei que o dinheiro está a ser bem usado?',
            a: 'A transparência é um pilar fundamental. Publicamos atualizações regulares sobre o progresso da obra e relatórios financeiros aqui no site. Pode também visitar-nos e ver a obra com os seus próprios olhos.',
        }
    ];

    return (
        <section className="py-24 bg-garabandal-mist/50">
            <div className="container mx-auto px-6 max-w-4xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl font-serif text-garabandal-dark mb-4">Dúvidas Frequentes</h2>
                    <p className="text-gray-600">Esclareça as suas questões antes de contribuir.</p>
                </motion.div>

                <div className="space-y-4">
                    {faqs.map((faq, idx) => {
                        const isOpen = openIndex === idx;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                            >
                                <button
                                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                                    className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <span className="font-medium text-lg text-garabandal-dark pr-8">{faq.q}</span>
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-garabandal-dark text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    </div>
                                </button>
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                        >
                                            <div className="px-6 pb-6 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                                                {faq.a}
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
