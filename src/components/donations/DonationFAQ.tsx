import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

export default function DonationFAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const { locale } = useLocale();
    const isEn = locale === 'en';

    const faqs = isEn ? [
        {
            q: 'Which payment methods are available?',
            a: 'You can donate by Credit Card, MB WAY, PIX, Multibanco or Bank Transfer. The available methods appear in the donation modal.',
        },
        {
            q: 'Is the donation secure?',
            a: 'Yes. Online payments are processed by certified partners and sensitive data is not stored by us.',
        },
        {
            q: 'How does bank transfer work?',
            a: 'When you choose Bank Transfer, we show the bank details and ask you to upload proof of payment in the form. The donation is registered after submission.',
        },
        {
            q: 'Can I request a donation receipt?',
            a: 'Yes. In the form, enable the receipt option and fill in the required details. The receipt is issued and validated by the administrative team after payment confirmation.',
        },
        {
            q: 'What are donations used for?',
            a: 'Donations support the mission of the Apostolate: pilgrimages, evangelization and the maintenance of projects and works in progress.',
        }
    ] : [
        {
            q: 'Quais métodos de pagamento estão disponíveis?',
            a: 'Pode doar com Cartão de Crédito, MB WAY, PIX, Multibanco ou por Transferência Bancária. Os métodos disponíveis aparecem no modal de doação.',
        },
        {
            q: 'A doação é segura?',
            a: 'Sim. Os pagamentos online são processados por parceiros certificados e os dados sensíveis não são guardados por nós.',
        },
        {
            q: 'Como funciona a transferência bancária?',
            a: 'Ao escolher Transferência Bancária, mostramos os dados bancários e pedimos o envio do comprovativo no próprio formulário. A doação fica registada após esse envio.',
        },
        {
            q: 'Posso pedir recibo da doação?',
            a: 'Sim. No formulário, ative a opção de recibo e preencha os dados necessários. A emissão e validação são feitas pela equipa administrativa após confirmação do pagamento.',
        },
        {
            q: 'Para que servem as doações?',
            a: 'As doações apoiam a missão do Apostolado: peregrinações, evangelização e manutenção dos projetos e obras em curso.',
        }
    ];

    return (
        <section className="py-16 md:py-24 bg-garabandal-mist/50">
            <div className="container mx-auto px-6 max-w-4xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl font-serif text-garabandal-dark mb-4">{isEn ? 'Frequently Asked Questions' : 'Dúvidas Frequentes'}</h2>
                    <p className="text-gray-600">{isEn ? 'Clarify your questions before contributing.' : 'Esclareça as suas questões antes de contribuir.'}</p>
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
