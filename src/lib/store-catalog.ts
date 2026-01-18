export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  tag?: string;
  description: string;
  format: string;
  isPhysical: boolean;
  digitalUrl?: string;
};

export const products: Product[] = [
  {
    id: '978-989-33-8094--9',
    name: 'Diário de Conchita - Versão digital em Português',
    price: 19.99,
    image:
      'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200007052-cba50cba52/450/Capa%20frontal%20livro%20diario%20Conchita-4.jpeg?ph=7a8de8e761',
    tag: 'Livro digital',
    format: 'PDF digital',
    isPhysical: false,
    digitalUrl: '',
    description:
      'Edição digital do diário de Conchita. Um relato completo das aparições e mensagens, pensado para leitura no telemóvel, tablet ou computador.',
  },
  {
    id: '200000048',
    name: 'Livro - Garabandal, Um Chamamento Urgente à Conversão',
    price: 16.5,
    image:
      'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200002511-c33c6c33c8/450/livro_garabandal.JPG?ph=7a8de8e761',
    tag: 'Livro',
    format: 'Livro físico',
    isPhysical: true,
    description:
      'Livro introdutório sobre Garabandal com foco na conversão e testemunhos. Ideal para oferecer e para aprofundar a mensagem.',
  },
  {
    id: '200000057',
    name: 'Guia do Peregrino - Garabandal (Português / Espanhol) - PDF',
    price: 5,
    image:
      'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200002519-a4366a4369/450/guia_do_peregrino_apa-8.jpg?ph=7a8de8e761',
    tag: 'Livro digital',
    format: 'PDF bilingue',
    isPhysical: false,
    digitalUrl: '',
    description:
      'Guia essencial para peregrinos com indicações, orações e contexto histórico. Versão digital em português e espanhol.',
  },
  {
    id: '200000056',
    name: 'A História de Garabandal para Crianças - PDF',
    price: 5,
    image:
      'https://7a8de8e761.clvaw-cdnwnd.com/71f1178ac9c9a00e4eb676b74ddebc1f/200002517-2f3012f303/450/livrinho_criancas.JPG?ph=7a8de8e761',
    tag: 'Livro infantil',
    format: 'PDF infantil',
    isPhysical: false,
    digitalUrl: '',
    description:
      'Narrativa acessível para crianças com ilustrações e linguagem simples, ideal para catequese e leitura em família.',
  },
];
