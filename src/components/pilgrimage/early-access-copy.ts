/* -------------------------------------------------------------------------- */
/*                     Early-access landing — localized copy                  */
/*                                                                            */
/*  Central dictionary for the /acesso-antecipado (PT) and /en/early-access   */
/*  (EN) landing pages. All user-facing strings live here so both locales     */
/*  render from a single source of truth.                                     */
/* -------------------------------------------------------------------------- */

export type EarlyAccessLocale = 'pt' | 'en';

export type TextSegment = { text: string; strong?: boolean };

export type EarlyAccessCopy = {
  locale: EarlyAccessLocale;
  paths: {
    landing: string;
    confirm: string;
    privacy: string;
  };
  meta: {
    title: string;
    description: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    lead: TextSegment[];
    dateAccessValue: string;
    dateAccessLabel: string;
    datePublicValue: string;
    datePublicLabel: string;
    scrollHint: string;
  };
  destinations: {
    statDays: string;
    statCountries: string;
    statShrines: string;
    countries: Record<string, string>;
  };
  pricing: {
    opportunity: string;
    belowMarket: string;
    badgeExclusive: string;
    badgeBelow: string;
    terrestreLabel: string;
    terrestreValue: string;
    terrestreSub: string;
    taxaLabel: string;
    taxaValue: string;
    taxaSub: string;
    scarcityMain: string;
    scarcitySought: string;
    bottomNote: TextSegment[];
  };
  mission: {
    eyebrow: string;
    headline: string;
    body: TextSegment[];
  };
  signup: {
    eyebrow: string;
    title: string;
    dateAccessLabel: string;
    datePublicLabel: string;
    submittingTitle: string;
    submittingSub: string;
    emailLabel: string;
    emailPlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    consent: string;
    submit: string;
    disclaimer: string;
    errorGeneric: string;
  };
  confirmation: {
    eyebrowRegistered: string;
    eyebrowDone: string;
    title: string;
    lead: string;
    dateAccessValue: string;
    dateAccessLabel: string;
    datePublicValue: string;
    datePublicLabel: string;
    groupIntro: string;
    groupBtnActive: string;
    groupBtnRequest: string;
    inviteBtn: string;
    inviteCopied: string;
    inviteNote: string;
    shareTitle: string;
    shareText: string;
    supportMessage: (email: string) => string;
  };
  footerPrivacy: string;
};

const pt: EarlyAccessCopy = {
  locale: 'pt',
  paths: {
    landing: '/acesso-antecipado',
    confirm: '/acesso-antecipado/confirmado',
    privacy: '/privacidade',
  },
  meta: {
    title: 'Acesso antecipado — Caminho Mariano 2027',
    description:
      'Acesso às inscrições do Caminho Mariano 2027 com 48 horas de antecedência.',
  },
  hero: {
    eyebrow: 'Acesso VIP',
    title: 'Caminho Mariano 2027',
    lead: [
      { text: 'A lista privada recebe o acesso às inscrições a ' },
      { text: '13 de outubro', strong: true },
      { text: '.' },
    ],
    dateAccessValue: '13 Out',
    dateAccessLabel: 'Acesso privado',
    datePublicValue: '15 Out',
    datePublicLabel: 'Abertura pública',
    scrollHint: 'Descubra o percurso',
  },
  destinations: {
    statDays: 'dias',
    statCountries: 'países',
    statShrines: 'santuários',
    countries: { Portugal: 'Portugal', Espanha: 'Espanha', França: 'França' },
  },
  pricing: {
    opportunity: 'Oportunidade única',
    belowMarket: 'Um valor abaixo do mercado',
    badgeExclusive: 'Preço exclusivo',
    badgeBelow: 'Abaixo do mercado',
    terrestreLabel: 'Peregrinação terrestre',
    terrestreValue: '1.850',
    terrestreSub: 'Quarto duplo · por pessoa',
    taxaLabel: 'Taxa de inscrição',
    taxaValue: '500',
    taxaSub: 'Garante a sua vaga',
    scarcityMain: 'Vagas limitadas',
    scarcitySought: 'Altamente procurado',
    bottomNote: [
      {
        text: '14 dias pelos maiores santuários da Europa a um valor abaixo do mercado — possível por sermos uma ',
      },
      { text: 'Associação sem fins lucrativos', strong: true },
      { text: '.' },
    ],
  },
  mission: {
    eyebrow: 'A nossa missão',
    headline: 'Ajude a obra da Casa do Apostolado',
    body: [
      { text: 'Somos uma ' },
      { text: 'Associação sem fins lucrativos', strong: true },
      { text: '. As doações feitas nesta peregrinação revertem para as obras da ' },
      { text: 'Casa do Apostolado', strong: true },
      { text: ' — um lar de oração e acolhimento ao serviço de Nossa Senhora.' },
    ],
  },
  signup: {
    eyebrow: 'Inscrição antecipada',
    title: 'Garanta o seu lugar',
    dateAccessLabel: 'O seu acesso',
    datePublicLabel: 'Abertura pública',
    submittingTitle: 'A confirmar o seu acesso',
    submittingSub: 'Só um instante.',
    emailLabel: 'O seu email',
    emailPlaceholder: 'nome@exemplo.com',
    phoneLabel: 'O seu telefone',
    // A maioria da audiência é brasileira, por isso o exemplo é um número do
    // Brasil com DDI — o formato português continua a passar na validação.
    phonePlaceholder: '+55 11 98765-4321',
    consent:
      'Aceito receber informação sobre esta peregrinação e o acesso antecipado.',
    submit: 'Ter acesso antecipado',
    disclaimer: 'Prioridade de acesso. Não garante vaga.',
    errorGeneric: 'Não foi possível concluir o registo.',
  },
  confirmation: {
    eyebrowRegistered: 'Email já registado',
    eyebrowDone: 'Registo concluído',
    title: 'Confirmado.',
    lead: 'A 13 de outubro recebe o link de inscrição por email — dois dias antes da abertura pública a 15 de outubro.',
    dateAccessValue: '13 Out',
    dateAccessLabel: 'O seu acesso',
    datePublicValue: '15 Out',
    datePublicLabel: 'Abertura pública',
    groupIntro: 'Aceda já ao grupo para receber todos os detalhes da peregrinação.',
    groupBtnActive: 'Aceder ao grupo privado',
    groupBtnRequest: 'Pedir ligação do grupo',
    inviteBtn: 'Convidar alguém que conheço',
    inviteCopied: 'Ligação copiada',
    inviteNote: 'Partilhe esta ligação com quem também quer receber acesso VIP.',
    shareTitle: 'Acesso VIP — Caminho Mariano 2027',
    shareText:
      'Entra na lista privada para receber acesso às inscrições 48 horas antes.',
    supportMessage: (email) =>
      `Olá! Inscrevi-me no acesso antecipado do Caminho Mariano 2027 com o email ${email} e gostaria de receber a ligação do grupo privado.`,
  },
  footerPrivacy: 'Privacidade',
};

const en: EarlyAccessCopy = {
  locale: 'en',
  paths: {
    landing: '/en/early-access',
    confirm: '/en/early-access/confirmed',
    privacy: '/en/privacy',
  },
  meta: {
    title: 'Early access — Marian Way 2027',
    description:
      'Access to Marian Way 2027 registration 48 hours before the public opening.',
  },
  hero: {
    eyebrow: 'VIP Access',
    title: 'Marian Way 2027',
    lead: [
      { text: 'The private list gets access to registration on ' },
      { text: '13 October', strong: true },
      { text: '.' },
    ],
    dateAccessValue: '13 Oct',
    dateAccessLabel: 'Private access',
    datePublicValue: '15 Oct',
    datePublicLabel: 'Public opening',
    scrollHint: 'Discover the route',
  },
  destinations: {
    statDays: 'days',
    statCountries: 'countries',
    statShrines: 'shrines',
    countries: { Portugal: 'Portugal', Espanha: 'Spain', França: 'France' },
  },
  pricing: {
    opportunity: 'A unique opportunity',
    belowMarket: 'A price below the market',
    badgeExclusive: 'Exclusive price',
    badgeBelow: 'Below market',
    terrestreLabel: 'Overland pilgrimage',
    terrestreValue: '1,850',
    terrestreSub: 'Double room · per person',
    taxaLabel: 'Registration fee',
    taxaValue: '500',
    taxaSub: 'Secures your place',
    scarcityMain: 'Limited places',
    scarcitySought: 'Highly sought after',
    bottomNote: [
      {
        text: "14 days through Europe's greatest shrines at a price below the market — possible because we are a ",
      },
      { text: 'non-profit association', strong: true },
      { text: '.' },
    ],
  },
  mission: {
    eyebrow: 'Our mission',
    headline: 'Support the work of the House of the Apostolate',
    body: [
      { text: 'We are a ' },
      { text: 'non-profit association', strong: true },
      { text: '. Donations made on this pilgrimage support the works of the ' },
      { text: 'House of the Apostolate', strong: true },
      { text: ' — a home of prayer and welcome in the service of Our Lady.' },
    ],
  },
  signup: {
    eyebrow: 'Early registration',
    title: 'Secure your place',
    dateAccessLabel: 'Your access',
    datePublicLabel: 'Public opening',
    submittingTitle: 'Confirming your access',
    submittingSub: 'Just a moment.',
    emailLabel: 'Your email',
    emailPlaceholder: 'name@example.com',
    phoneLabel: 'Your phone',
    phonePlaceholder: '+44 7700 900123',
    consent:
      'I agree to receive information about this pilgrimage and early access.',
    submit: 'Get early access',
    disclaimer: 'Priority access. Does not guarantee a place.',
    errorGeneric: "We couldn't complete your registration.",
  },
  confirmation: {
    eyebrowRegistered: 'Email already registered',
    eyebrowDone: 'Registration complete',
    title: 'Confirmed.',
    lead: 'On 13 October you will receive the registration link by email — two days before the public opening on 15 October.',
    dateAccessValue: '13 Oct',
    dateAccessLabel: 'Your access',
    datePublicValue: '15 Oct',
    datePublicLabel: 'Public opening',
    groupIntro: 'Join the group now to receive all the pilgrimage details.',
    groupBtnActive: 'Join the private group',
    groupBtnRequest: 'Request the group link',
    inviteBtn: 'Invite someone I know',
    inviteCopied: 'Link copied',
    inviteNote: 'Share this link with anyone who also wants VIP access.',
    shareTitle: 'VIP Access — Marian Way 2027',
    shareText:
      'Join the private list to get access to registration 48 hours early.',
    supportMessage: (email) =>
      `Hello! I signed up for early access to Marian Way 2027 with the email ${email} and would like to receive the private group link.`,
  },
  footerPrivacy: 'Privacy',
};

export const earlyAccessCopy: Record<EarlyAccessLocale, EarlyAccessCopy> = {
  pt,
  en,
};

export function getEarlyAccessCopy(locale: EarlyAccessLocale): EarlyAccessCopy {
  return earlyAccessCopy[locale] ?? earlyAccessCopy.pt;
}
