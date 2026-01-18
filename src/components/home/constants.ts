// Images
export const HERO_IMAGE_URL = "https://images.unsplash.com/photo-1510303099958-3d5df0274191?q=80&w=3431&auto=format&fit=crop"; // Misty mountains/Spiritual
export const CASA_IMAGE_URL = "/images/casaantes2.webp"; // House/Shelter concept
export const SHOP_IMAGE_URL = "https://images.unsplash.com/photo-1544258720-40409745d33e?q=80&w=2000&auto=format&fit=crop"; // Religious items
export const MEMBER_IMAGE_URL = "/images/associacao.webp"; // Community/Candles

export const NAVIGATION_LINKS = [
    { name: 'Ser Membro', href: '/tornar-membro' }, // Changed to internal route
    { name: 'Loja Online', href: '/loja-online' }, // Changed to internal route
    { name: 'Peregrinações', href: '/member/peregrinacoes' },
    { name: 'Doações', href: '/donations' }, // Changed to internal route
];

export const HERO_CONTENT = {
    quote: '"É preciso fazer muitos sacrifícios e muita penitência..."',
    title: "Garabandal +",
    subtitle: "O espaço oficial da Associação do Apostolado de Garabandal. Um lugar de fé, oração e divulgação da Mensagem.",
    cta: "Tornar-se Membro Oficial"
};

export const PILLARS_CONTENT = [
    {
        title: "Oração",
        description: "Envie as suas intenções. Uma rede mundial de oração unida pelo Imaculado Coração.",
        action: "Enviar Intenção",
        link: "/intencoes",
        backgroundImage: "/images/igrejagarabandal.jpg",
        highlight: false
    },
    {
        title: "Comunidade",
        description: "Faça parte da família. O seu apoio como membro sustenta esta obra de evangelização.",
        action: "Ser Membro",
        link: "/tornar-membro",
        highlight: true
    }
];

export const CAMPAIGN_CONTENT = {
    title: "Casa de Acolhimento",
    subtitle: "O seu apoio constrói este refúgio.",
    description: "A Associação adquiriu uma casa nas montanhas para servir de apoio ao peregrino que procura ir ao encontro de Deus através de Garabandal.",
    cta: "Doar para a Obra"
};

export const TESTIMONIALS = [
    {
        text: "Esta app facilitou muito a minha contribuição mensal. Sinto-me parte ativa da missão.",
        author: "Maria S., Associada"
    },
    {
        text: "Recebi a minha encomenda da loja em perfeitas condições. Os terços são lindíssimos.",
        author: "João P., Comprador"
    }
];
