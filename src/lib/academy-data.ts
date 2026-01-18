export type Episode = {
    id: string;
    title: string;
    duration: string;
    video_id: string;
    position: number;
    description?: string;
};

export type Course = {
    id: string;
    slug: string;
    title: string;
    description: string;
    thumbnail_url: string;
    duration?: string;
    is_premium: boolean;
    category: string;
    price?: number;
    instructor?: string;
    episodes?: Episode[];
    progress?: number; // 0 to 100
    format?: string; // 'course' | 'single'
    is_featured?: boolean; // NEW: Highlights in Hero Banner
    published?: boolean;
};

export const MOCK_COURSES: Course[] = [
    {
        id: 'm1',
        slug: 'mensagem-central-garabandal',
        title: 'A Mensagem Central',
        description: 'Um documentário cinematográfico sobre os avisos, o milagre e o castigo. Entenda a urgência da mensagem para os dias de hoje.',
        thumbnail_url: 'https://images.unsplash.com/photo-1473172707857-f9e276582ab6?q=80&w=2670&auto=format&fit=crop',
        category: 'Destaques',
        is_premium: false,
        instructor: 'Equipe Mensagem',
        progress: 45, // Demo progress
        is_featured: true,
        episodes: [
            {
                id: 'e1-1',
                title: 'O Início das Aparições',
                duration: '15:20',
                video_id: 'Bey4XXJAqS8', // Placeholder YouTube ID like "Catholic content"
                position: 1,
                description: 'Como tudo começou naquela tarde de domingo em San Sebastián de Garabandal.'
            },
            {
                id: 'e1-2',
                title: 'O Primeiro Aviso',
                duration: '18:45',
                video_id: 'Bey4XXJAqS8',
                position: 2,
                description: 'A análise detalhada do primeiro aviso dado pelas meninas.'
            },
            {
                id: 'e1-3',
                title: 'As Noites de Gritos',
                duration: '12:10',
                video_id: 'Bey4XXJAqS8',
                position: 3,
                description: 'O mistério das noites em que as meninas gritaram de terror.'
            }
        ]
    },
    {
        id: 'm2',
        slug: 'diario-conchita',
        title: 'O Diário de Conchita',
        description: 'Leitura comentada e análise espiritual dos escritos da principal vidente.',
        thumbnail_url: 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=2574&auto=format&fit=crop',
        category: 'Teologia',
        is_premium: false,
        instructor: 'Padre Oliveira',
        progress: 10,
        episodes: [
            {
                id: 'e2-1',
                title: 'Introdução ao Diário',
                duration: '22:00',
                video_id: 'Bey4XXJAqS8',
                position: 1,
                description: 'Contexto histórico e espiritual dos escritos de Conchita.'
            },
            {
                id: 'e2-2',
                title: 'A Última Carta',
                duration: '14:30',
                video_id: 'Bey4XXJAqS8',
                position: 2,
                description: 'Análise da última mensagem registrada no diário.'
            }
        ]
    },
    {
        id: 'm3',
        slug: 'profecias-secretas',
        title: 'Profecias Secretas',
        description: 'Investigação profunda sobre os arquivos do Vaticano e as cartas perdidas.',
        thumbnail_url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=2670&auto=format&fit=crop',
        category: 'Documentários',
        is_premium: true,
        price: 5,
        instructor: 'Dr. Ricardo',
        episodes: [
            {
                id: 'e3-1',
                title: 'Arquivos Secretos',
                duration: '45:00',
                video_id: 'Bey4XXJAqS8',
                position: 1,
                description: 'O que o Vaticano realmente sabia sobre Garabandal nos anos 60.'
            }
        ]
    },
    {
        id: 'm4',
        slug: 'vida-interior',
        title: 'Escola de Oração',
        description: 'Aprenda a rezar com a profundidade dos místicos.',
        thumbnail_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2670&auto=format&fit=crop',
        category: 'Vida Espiritual',
        is_premium: false,
        instructor: 'Madre Teresa (Cover)',
        episodes: [
            {
                id: 'e4-1',
                title: 'Silêncio Interior',
                duration: '10:00',
                video_id: 'Bey4XXJAqS8',
                position: 1,
                description: 'A importância do silêncio para ouvir a voz de Deus.'
            },
            {
                id: 'e4-2',
                title: 'A Oração do Coração',
                duration: '15:00',
                video_id: 'Bey4XXJAqS8',
                position: 2,
                description: 'Como manter a oração constante durante o dia.'
            }
        ]
    }
];
