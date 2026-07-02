# Fluxo Operacional de Emails de Marketing

> Estado apos Fase 0. Este documento resume que emails podem disparar, em que ordem, e porque o sistema nao deve fazer spam.

## Ordem de Processamento no Cron

1. Reconstruir contactos a partir das fontes Supabase e persistir `marketing_contacts`.
2. Inscrever contactos elegiveis nos funis ativos.
3. Verificar `waitlist_open_spot` para listas de espera com vaga real.
4. Processar enrollments vencidos por prioridade:
   - maior `lead_score`;
   - maior valor historico do contacto;
   - `next_run_at` mais antigo em caso de empate.

## Regras Anti-Spam

- Maximo global por contacto: 1 email de marketing por dia, com teto tecnico de 7 emails em 7 dias.
- Intervalo minimo global por contacto: 24h entre emails.
- Teto global do cron: 50 emails/dia por defeito.
- Lote por execucao: 15 emails por defeito.
- Os limites contam `marketing_message_logs` com `status = sent`, independentemente do funil.
- Estar em varios funis nao multiplica envios; os contactos rate-limited ficam reagendados ou sao tentados noutro cron.

## Fluxos e Condicoes

| Fluxo | Segmento | Templates | Condicoes efetivas | Conflitos tratados |
|---|---|---|---|---|
| Recuperacao de inscricao | `abandoned-registration` | `abandoned_registration_1`, `abandoned_registration_faq`, `abandoned_registration_final` | `not_booked` + `has_availability` | Lista de espera fica fora deste segmento; sem vagas reais, nao envia copy de "garanta vaga". |
| Lista de espera | `waitlist-contacts` | `waitlist_welcome` | email valido, consentimento ativo | Copy informa que avisamos quando houver vagas; nao empurra inscricao sem disponibilidade. |
| Vaga abriu | lista de espera por peregrinacao | `waitlist_open_spot` | peregrinacao `open`/`active`/`ativo`, `current_vacancies > 0`, prazo valido, nao enviado antes para a mesma peregrinacao | Partilha o cap global com os outros emails; deduplica por contacto + peregrinacao. |
| Doador para membro | `donors-not-members` | `donor_to_member`, tarefa manual | `not_member` | Para se se tornou membro, suprimiu ou cancelou subscricao. |
| Loja / livro recomendado | contactos com interesse por Garabandal | `store_book_recommendation` | produto real, URL da Loja, consentimento ativo | Separado dos emails de membro; livro nunca usa CTA de adesao. |
| Onboarding de membro | `new-members` | `member_welcome`, `member_pray_intentions`, `member_novena_invite`, `member_learn_garabandal` | consentimento ativo | Sequencia de valor espiritual, nao pedidos consecutivos. |
| Referral de membro | `members-without-referrals` | `referral_activation`, `share_mission` | consentimento ativo | Fica sujeito ao cap global se houver outros funis. |

## Como Ler o Dry Run

Chamar o cron com `?dryRun=1` devolve:

- `waitlistOpenSpot`: candidatos de lista de espera que receberiam `waitlist_open_spot`.
- `candidates`: enrollments vencidos ja ordenados por prioridade.
- `effectiveConditions`: condicoes reais aplicadas, incluindo condicoes implicitas como `has_availability`.
- `limits`, `sentLast24h`, `remainingDailyCapacity`: estado da protecao anti-spam.

## Guardrails de Copy

- Nunca usar URLs com `app.apostoladodegarabandal.com` nos emails.
- Nunca pedir para responder ao email; usar WhatsApp ou `geral@apostoladodegarabandal.com`.
- Em PT publico, usar "membro/membros", nunca "socio/socios".
- Loja significa livros.
