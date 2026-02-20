import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';

export default function DonationStory() {
    return (
        <section id="historia" className="py-16 md:py-24 bg-garabandal-mist relative overflow-hidden">
            <div className="container mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-garabandal-dark mb-6">
                        Presente e Futuro
                    </h2>
                    <p className="text-lg text-gray-600">
                        Garabandal será um grande local de conversão a nível mundial e a nossa casa estará pronta para servir o plano de Deus!
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
                    {/* Ruins Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="group relative rounded-3xl overflow-hidden shadow-xl min-h-[500px]"
                    >
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-sm font-medium z-10">
                            Estado Atual
                        </div>
                        <img
                            src="/images/casaantes1.webp"
                            alt="Estado atual (Ruínas)"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 filter sepia-[0.3]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-90" />
                        <div className="absolute bottom-0 left-0 p-8">
                            <h3 className="text-xl font-bold text-white mb-2">Em Ruínas</h3>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                Atualmente, a casa encontra-se degradada e necessita de reconstrução total.
                                As fotos mostram o estado real do imóvel que adquirimos e que precisa da sua ajuda para ser reerguido.
                            </p>
                        </div>
                    </motion.div>

                    {/* Future Project Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="group relative rounded-3xl overflow-hidden shadow-2xl ring-4 ring-garabandal-gold/20 min-h-[500px]"
                    >
                        <div className="absolute top-4 left-4 bg-garabandal-gold text-garabandal-dark px-4 py-1.5 rounded-full text-sm font-bold z-10 shadow-lg">
                            O Projeto
                        </div>
                        <img
                            src="/images/casaafter.webp"
                            alt="Projeção IA"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80" />
                        <div className="absolute bottom-0 left-0 p-8">
                            <h3 className="text-xl font-bold text-white mb-2">Visão Futura</h3>
                            <p className="text-gray-200 text-sm leading-relaxed">
                                Esta projeção (IA) ilustra o nosso objetivo: renovar a casa para, numa primeira fase, acolher o Apostolado.
                                Futuramente, será um refúgio seguro para acolher em massa durante os eventos profetizados.
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* Additional Context - Call for Help */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className="mt-16 bg-red-50 rounded-3xl p-8 lg:p-12 shadow-sm border border-red-100 flex flex-col lg:flex-row items-center gap-8"
                >
                    <div className="lg:w-1/3 text-center lg:text-right">
                        <div className="inline-block p-4 bg-red-100 rounded-full text-red-600 mb-4">
                            <Heart className="w-8 h-8 fill-red-600" />
                        </div>
                    </div>
                    <div className="lg:w-2/3 space-y-4 text-center lg:text-left">
                        <h3 className="text-2xl font-serif text-red-900">Necessitamos da sua ajuda!</h3>
                        <p className="text-red-800/80 leading-relaxed font-medium">
                            A casa adquirida necessita de obras e de requalificação, pois a maior parte está em ruínas.
                            A nossa Associação necessita de doações e da boa vontade das pessoas que nos queiram ajudar neste projeto.
                            Ajude-nos nesta missão!
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
