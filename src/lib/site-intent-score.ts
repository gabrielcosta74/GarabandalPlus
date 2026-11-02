/**
 * Pontuação de interesse de uma pessoa numa peregrinação, a partir dos sinais
 * do tracking próprio (função site_pilgrimage_people). Serve para ordenar a
 * lista do admin e o relatório semanal: quem vale um contacto hoje.
 *
 * Regras simples e explicáveis de propósito: cada ponto tem uma razão que
 * aparece no painel, para a equipa saber porque é que alguém está "quente".
 */

export type SitePersonSignals = {
  email: string;
  sessions: number | null;
  page_views: number | null;
  active_seconds: number | null;
  read_itinerary: boolean | null;
  read_pricing: boolean | null;
  info_opens: number | null;
  cta_clicks: number | null;
  max_step: string | null;
  validation_errors: number | null;
  chat_messages: number | null;
  whatsapp_clicks: number | null;
  last_seen: string;
  booking_id: string | null;
  booking_status: string | null;
  paid_amount: number | string | null;
};

export type IntentLevel = 'quente' | 'morno' | 'frio';
export type PersonStage = 'pagou' | 'por_pagar' | 'em_aberto';

export type IntentScore = {
  score: number;
  level: IntentLevel;
  stage: PersonStage;
  reasons: string[];
  nextAction: string;
};

const STEP_POINTS: Record<string, [number, string]> = {
  dados: [10, 'Deu o email no formulário'],
  quartos: [18, 'Preencheu os dados pessoais'],
  voos: [20, 'Chegou à parte dos voos'],
  pagamento: [28, 'Chegou ao passo do pagamento'],
};

const DAY_MS = 86_400_000;

export function scorePerson(person: SitePersonSignals, now = Date.now()): IntentScore {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string) => {
    score += points;
    if (points > 0) reasons.push(reason);
  };

  const sessions = Number(person.sessions || 0);
  if (sessions >= 3) add(15, `Voltou ${sessions} vezes ao site`);
  else if (sessions === 2) add(8, 'Voltou uma segunda vez');

  const minutes = Math.round(Number(person.active_seconds || 0) / 60);
  if (minutes >= 5) add(10, `${minutes} min a ler o site`);
  else if (minutes >= 2) add(5, `${minutes} min a ler o site`);

  if (person.read_itinerary) add(8, 'Leu o roteiro');
  if (person.read_pricing) add(8, 'Viu o preço');
  if (Number(person.info_opens || 0) > 0) add(8, 'Abriu "incluído" ou "voos"');
  if (Number(person.cta_clicks || 0) > 0) add(8, 'Clicou em inscrever');

  const step = person.max_step ? STEP_POINTS[person.max_step] : undefined;
  if (step) add(step[0], step[1]);

  const chat = Number(person.chat_messages || 0);
  if (chat >= 3) add(12, `Fez ${chat} perguntas no chat`);
  else if (chat > 0) add(6, 'Fez perguntas no chat');

  if (Number(person.whatsapp_clicks || 0) > 0) add(8, 'Clicou no WhatsApp');
  if (Number(person.validation_errors || 0) >= 2) reasons.push('Teve erros no formulário (pode precisar de ajuda)');

  const daysSince = (now - new Date(person.last_seen).getTime()) / DAY_MS;
  if (daysSince <= 2) add(10, 'Ativo nos últimos 2 dias');
  else if (daysSince > 21) {
    score -= 20;
    reasons.push(`Sem visitas há ${Math.floor(daysSince)} dias`);
  } else if (daysSince > 10) {
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));
  const paid = Number(person.paid_amount || 0) > 0;
  const stage: PersonStage = paid ? 'pagou' : person.booking_id ? 'por_pagar' : 'em_aberto';
  const level: IntentLevel = score >= 55 ? 'quente' : score >= 30 ? 'morno' : 'frio';

  let nextAction: string;
  if (stage === 'pagou') nextAction = 'Nada a fazer: já pagou.';
  else if (stage === 'por_pagar') nextAction = 'Inscrito sem pagamento: confirmar se precisa de ajuda para pagar.';
  else if (person.max_step === 'pagamento') nextAction = 'Parou no pagamento: explicar prestações e formas de pagamento.';
  else if (person.max_step === 'voos') nextAction = 'Parou nos voos: explicar o que está incluído para o país dele.';
  else if (Number(person.validation_errors || 0) >= 2) nextAction = 'Teve erros no formulário: oferecer ajuda a preencher.';
  else if (chat > 0) nextAction = 'Falou no chat: responder às dúvidas que deixou.';
  else if (level === 'quente') nextAction = 'Interesse alto: contacto pessoal por WhatsApp.';
  else nextAction = 'Deixar seguir a sequência de emails.';

  return { score, level, stage, reasons, nextAction };
}
