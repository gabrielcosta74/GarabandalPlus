export type MembershipFaqItem = {
  question: string;
  answer: string;
};

export const MEMBERSHIP_FAQS: MembershipFaqItem[] = [
  {
    question: 'Qual é o valor da quota de membro?',
    answer:
      'A quota anual é de 25€. O valor é fixo e é usado para sustentar as atividades do Apostolado e os serviços da comunidade.',
  },
  {
    question: 'Quais métodos de pagamento estão disponíveis?',
    answer:
      'Podes pagar online com Cartão, MB WAY, PIX ou Multibanco. Depois da confirmação do pagamento, o estado da tua quota é atualizado na tua área.',
  },
  {
    question: 'A renovação da quota é automática?',
    answer:
      'Não. A renovação é manual. Quando a tua quota estiver perto do vencimento, podes renovar diretamente na área de membro, em poucos passos.',
  },
  {
    question: 'Recebo confirmação depois de pagar?',
    answer:
      'Sim. Após confirmação do pagamento, recebes email de confirmação e consegues consultar o histórico de quotas na tua conta.',
  },
  {
    question: 'Se eu nunca fui membro, posso ter estado "em atraso"?',
    answer:
      'Não. "Quota em atraso" só se aplica a quem já teve quota ativa e ficou com pagamento vencido. Novos registos aparecem como pendentes até ao primeiro pagamento.',
  },
];
