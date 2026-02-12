import { Metadata } from 'next';
import MembershipClient from './MembershipClient';
import { APP_URL } from '../../lib/config';

export const metadata: Metadata = {
  title: 'Torne-se membro',
  description: 'Faça parte do Apostolado de Garabandal. Apoie a missão, receba conteúdos exclusivos e participe da comunidade.',
  alternates: {
    canonical: `${APP_URL}/tornar-membro`,
  },
};

export default function TornarMembroPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Como me tornar membro do Apostolado?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Você pode se tornar membro online, preenchendo o formulário e efetuando a contribuição anual.'
        }
      },
      {
        '@type': 'Question',
        name: 'Quais benefícios eu recebo?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Membros recebem conteúdos exclusivos e participam da comunidade do Apostolado.'
        }
      },
      {
        '@type': 'Question',
        name: 'O recibo é automático?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Os recibos são emitidos manualmente pela administração após a confirmação do pagamento.'
        }
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <MembershipClient />
    </>
  );
}
