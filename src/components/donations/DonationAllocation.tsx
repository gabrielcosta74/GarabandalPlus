import { motion } from 'framer-motion';
import { BrickWall, Hammer, Lightbulb, Home, Users } from 'lucide-react';

export default function DonationAllocation() {
    const items = [
        {
            icon: BrickWall,
            title: 'Obras Estruturais',
            desc: 'Reforço de fundações, paredes e telhado para garantir segurança total.'
        },
        {
            icon: Hammer,
            title: 'Materiais de Qualidade',
            desc: 'Revestimentos duráveis e isolamento térmico para os invernos rigorosos.'
        },
        {
            icon: Users,
            title: 'Mão de Obra Local',
            desc: 'Apoio à economia local através da contratação de equipas especializadas.'
        },
        {
            icon: Lightbulb,
            title: 'Infraestruturas',
            desc: 'Renovação completa das redes de água, eletricidade e saneamento.'
        },
        {
            icon: Home,
            title: 'Espaços de Acolhimento',
            desc: 'Criação de quartos confortáveis, cozinha equipada e áreas de convívio.'
        },
    ];

    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-5xl font-serif text-garabandal-dark mb-6">
                        Transparência Total
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Cada euro doado é aplicado diretamente na renovação. Aqui está como o seu investimento será utilizado.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-gray-50 hover:bg-white p-8 rounded-3xl transition-all duration-300 hover:shadow-xl border border-transparent hover:border-gray-100 group"
                        >
                            <div className="w-12 h-12 bg-garabandal-mist rounded-2xl flex items-center justify-center mb-6 text-garabandal-dark group-hover:scale-110 transition-transform">
                                <item.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-garabandal-dark mb-3">{item.title}</h3>
                            <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                        </motion.div>
                    ))}

                    {/* Final CTA Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: items.length * 0.1 }}
                        className="bg-garabandal-dark p-8 rounded-3xl flex flex-col justify-center text-center text-white relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-garabandal-gold/10 blur-xl" />
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold mb-3 text-garabandal-gold">Fase Atual: 2</h3>
                            <p className="text-gray-300 mb-6">Estamos focados nas obras principais e revestimentos.</p>
                            <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                                <div className="bg-garabandal-gold h-2 rounded-full w-[60%]"></div>
                            </div>
                            <span className="text-xs text-gray-400">60% da Fase 2 concluída</span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
