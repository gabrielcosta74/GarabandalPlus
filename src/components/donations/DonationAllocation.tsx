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
        <section className="py-16 md:py-24 bg-white">
            <div className="container mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-garabandal-dark mb-6">
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

                </div>
            </div>
        </section>
    );
}
