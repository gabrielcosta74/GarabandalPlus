# Sistema de Marketing Automático — Mapa, Regras e Estado

> **Atualizado em 2026-07-02** após a reorganização (dados de produção Supabase `pntzzuxzjnzksubbjfvj`).
> A versão anterior deste documento era o diagnóstico; esta é o **estado atual + livro de regras**.
> As alterações aplicadas estão no changelog no fim.

---

## 1. MAPA — Como o sistema funciona

### 1.1 O fluxo ponta-a-ponta (em português simples)

```
Tabelas fonte (membros, booking_leads, waitlists, bookings, donations, orders, quotas)
        │  o motor lê tudo isto de novo a cada execução
        ▼
CONTACTO unificado (marketing_contacts) — 1 pessoa = 1 email normalizado
        │  regras automáticas calculam: estágio, pontuação, segmentos
        ▼
SEGMENTO — cada funil ativo aponta para 1 segmento
        ▼
INSCRIÇÃO no funil (marketing_enrollments) — automática, 1 vez por pessoa por funil
        ▼
PASSO do funil (sempre email) — verifica objetivo, condições, prioridade e limites
        ▼
EMAIL via Resend + registo em marketing_message_logs
```

**Garantias:**
- Cada pessoa passa por cada funil **uma vez** (nunca é reinscrita automaticamente).
- **Só emails** — o sistema já não cria tarefas manuais (removidas em 2026-07-02).
- Se o contacto **sai do segmento** a meio, a inscrição é **pausada automaticamente** (`left_segment`).
- Se o contacto está num funil **mais prioritário**, o outro funil **espera** (ver 4.2).

### 1.2 Os crons

| Cron | Horário | O que faz |
|---|---|---|
| `marketing-automations` | a cada 15 min | O motor: teto diário → auto-inscrição → avisos de vaga (waitlist) → processa passos devidos por prioridade |
| `quota-reminders` / `membership-rules` / `pilgrimage-payment-reminders` | manhã, diário | Transacionais — fora do marketing |

> O cron legado `recover-leads` foi **removido** (2026-07-02): duplicava o funil de recuperação
> por fora dos limites e dos logs. O envio manual por lead continua disponível no admin
> (`/api/leads/notify`), acionado por ti.

### 1.3 Os funis — 1 estado → 1 sequência

**ATIVOS (5):**

| Estado do contacto | Funil | Sequência (tudo email) |
|---|---|---|
| 🟢 Membro novo (≤14 dias) | **Member onboarding** | boas-vindas → oração/intenções (+4d) → novena (+9d) → conhecer Garabandal (+16d) |
| 🟠 Abandonou inscrição | **Abandoned registration recovery** | recuperação (+1h) → FAQ (+48h) → último aviso (+120h). Só com vagas reais (`has_availability`); pára se reservar |
| 🔵 Lista de espera | **Lista de espera** (funil único) | boas-vindas (imediato) → história (+3d) → livros (+7d) → missão (+14d) → convite membro (+24d, se não membro) |
| 🟣 Doou, não é membro | **Donor to member** | convite a membro (+72h) |
| 🟡 Membro sem referral | **Member referral activation** | ativar partilha (+3d) → partilhar missão (+14d). **Espera o onboarding terminar** |

**DRAFT (1):**

| Funil | Segmento | Nota |
|---|---|---|
| Renovação de membros | `expired-members` (**só** quota `expirado`) | 1 email (`membership_renewal`). Ativar só depois de reveres a copy — verificação segmento × copy obrigatória |

**PAUSADO (1):** Waitlist conversion — fundido no funil único de lista de espera; fica como histórico.

### 1.4 Os segmentos e a regra de cada um

**Como as fontes se juntam:** 1 email = 1 contacto, venha do site ou da newsletter (Sender).
Quem está nos dois fica com um perfil único e as duas origens. Total após o import da
newsletter (2026-07-02): **1086 contactos** = 772 só-newsletter + 102 newsletter+membro +
212 só-site. Línguas: 989 PT · 78 EN · 19 ES.

Contagens de 2026-07-02 (recalculadas a cada cron):

| Segmento | Regra | Contactos | Funil |
|---|---|---:|---|
| members-without-referrals | membro com 0 referrals | 184 | ✅ Referral (após onboarding) |
| abandoned-registration | lead de inscrição, sem waitlist, sem reserva | 74 | ✅ Recovery |
| past-pilgrims | já peregrinou ou reservou | 46 | ⚪ sem automação (decisão: só campanhas pontuais) |
| high-value-supporters | valor total ≥ 100€ | 41 | ⚪ sem automação (decisão: silêncio por defeito) |
| expired-members | quota **expirado** (pendente/revogado excluídos de propósito) | ~15 | 📝 draft renewal |
| waitlist-contacts | em lista de espera | 23 | ✅ Lista de espera |
| new-members | membro há ≤14 dias | 17 | ✅ Onboarding |
| donors-not-members | doou e não é membro | 13 | ✅ Donor to member |
| hot-pilgrimage-leads | pontuação ≥70 + lead sem reserva | 5 | ⚪ já cobertos pelo Recovery |
| brochure-requested-not-booked | pediu brochura, sem reserva | 0 | ⚪ vazio |
| **newsletter-pt** | subscritor da newsletter, língua PT | 827 | ⚪ só newsletter mensal (decisão) |
| **newsletter-en** | subscritor da newsletter, língua EN | 49 | ⚪ só newsletter mensal (decisão) |
| newsletter-subscribers | qualquer subscritor (inclui os 19 ES) | 895 | ⚪ ES fora de tudo até haver copy ES |

> **Newsletter e funis não se misturam:** os contactos só-newsletter não têm atividade de site,
> logo não caem em nenhum segmento de funil — não recebem nada das automações. Se um dia um
> deles se inscrever numa peregrinação ou tornar-se membro, entra no funil certo automaticamente,
> e o limite 1 email/dia impede colisão com a newsletter.

### 1.5 Limites anti-spam (linguagem humana)

Ajustáveis por variável de ambiente (`marketing-limits.ts`):

| Limite | Valor | Em português |
|---|---|---|
| Por contacto | **1 / 24h** | Ninguém recebe mais de 1 email de marketing por dia, venha de onde vier |
| Por contacto | 7 / 7 dias | Teto semanal (na prática o diário domina) |
| Por corrida do cron | 15 | Máximo por execução de 15 min |
| **Global** | **50 / 24h** | O sistema inteiro pára ao atingir 50 emails de marketing/dia |
| Campanha manual | 100 | Corte de audiência por campanha |

### 1.6 Como reagenda, pausa e pára

| Situação | O que acontece |
|---|---|
| Limite de frequência | Reagenda o mesmo passo +24h (não perde o email); log `skipped/rate_limited` |
| Contacto em funil prioritário | Adia +72h e tenta de novo (`waiting_priority_funnel`) |
| Saiu do segmento | **Pausa** com `left_segment` — só o admin reativa |
| Condição do passo falha | Salta o passo e avança (log `condition_failed`) |
| Objetivo atingido (reservou/doou/aderiu) | `completed` — sai do funil de vez |
| Unsubscribe/supressão | `stopped` — nunca mais recebe |
| Falha no envio | `failed` — visível no admin, não re-tenta sozinha |

Prioridade na fila: maior pontuação e maior valor histórico primeiro.

---

## 2. REGRAS — O livro de regras

### 2.1 Anti-spam (imutáveis sem decisão escrita)

1. Máximo **1 email de marketing por contacto por dia** — todos os funis e campanhas somados.
2. Máximo **50 emails de marketing por dia** no sistema inteiro.
3. Conflito entre funis: ganha a prioridade da tabela 1.3 (onboarding > resto); o outro adia sozinho.
4. Todo o email de marketing leva unsubscribe + one-click (RFC 8058).
5. Envios em massa por script devem ficar registados (ver 3, pendente).

### 2.2 Nunca fazer

- ❌ Enviar a `unsubscribed`, `suppressed` ou emails `@sem-email.local` — em funil, campanha ou script.
- ❌ Ativar um funil sem verificar **segmento × copy** (o email diz o que o segmento é?).
- ❌ Enviar renovação a `pendente` ou `revogado` — o segmento `expired-members` já os exclui por código.
- ❌ Convite de reserva sem vagas reais abertas (`has_availability` é automático nos emails de recuperação).
- ❌ "sócio" — sempre "membro" (copy PT-BR).

### 2.3 Newsletter mensal de artigos (decisões de 2026-07-02)

| Decisão | Escolha |
|---|---|
| Audiência | **Só subscritores da newsletter** (`newsletter-pt` 827 + `newsletter-en` 49). Os contactos só-do-site (consentimento `assumed`) ficam de fora. |
| Cadência | **Mensal**: 3-4 artigos do site + 1 destaque (livro, peregrinação ou missão). |
| Curadoria | Claude propõe a partir do CMS (posts publicados), **Gabriel aprova antes de qualquer envio**. |
| Funil de nurture | **Adiado** — por agora os subscritores recebem apenas a newsletter mensal, sem sequência automática. |
| ES (19 contactos) | Guardados mas fora de qualquer envio até existir copy em espanhol. |

⚠️ **Nota técnica para a 1.ª edição:** os limites atuais (50 emails/dia globais, 100 por campanha)
não servem para enviar a 876 pessoas num dia. O envio mensal vai precisar de um caminho próprio
(script com lotes ao longo de 1-2 dias, ou ajuste pontual dos limites por env var), sempre a
respeitar supressão/unsubscribe e a registar em `marketing_campaigns`. Resolver quando montarmos
a primeira edição.

### 2.4 Decisões tomadas (para não reabrir sem pensar)

- **Past-pilgrims (46) e high-value (41) não têm automação de propósito** — são o público mais valioso; menos email = mais confiança. Contactar só por campanha pontual aprovada à mão.
- **Hot leads não têm funil próprio** — já caem no Recovery (são um subconjunto de abandoned-registration).
- **Consentimento é `assumed`** (relação existente); unsubscribe fácil em todos os emails.
- **Tarefas manuais foram removidas** — nunca eram usadas; funis são 100% email.

---

## 3. UI ADMIN — 7 páginas

| Página | O que responde |
|---|---|
| **Dashboard** | "Está tudo bem?" — inclui o widget **Próximos Envios** (quem recebe o quê e quando, a fila real do cron) |
| **Fluxo & Previews** | Visão narrativa dos fluxos e prévias dos emails |
| **Contactos** | CRM com filtro por segmento e ficha por contacto |
| **Automações** | Funis, passos, estado, pausar/ativar |
| **Próximos Envios** | Agenda completa: pronto / hoje / futuro / bloqueado, com razão |
| **Enviados** | Outbox com histórico e falhas |
| **Templates** | Copy e prévia PT/EN |

Removidas (2026-07-02): Segmentos (virou filtro em Contactos), Campanhas (não usadas — tabela vazia;
envios pontuais por script), Tarefas (feature removida), Analytics (duplicava o Dashboard).

**Redesign minimalista (2026-07-02):** sidebar escuro "Centro de Comando" substituído por uma topbar
clara com separadores simples; dashboard reduzido a 4 números essenciais + fila de próximos envios +
alerta de falhas + atividade recente; cartões de funil planos (sem gradientes); filtros grandes
substituídos por pills discretas; animações removidas; filtro de segmentos com nomes em português;
cada linha de contacto tem link direto para o perfil.

---

## 4. CHANGELOG — Reorganização de 2026-07-02

**Segurança (P0)**
- ✅ Campanhas manuais agora excluem `unsubscribed` (antes só `suppressed`) — bug de compliance corrigido.
- ✅ Cron `recover-leads` removido (`vercel.json` + rota) — era um sistema paralelo sem limites nem logs.
- ✅ Funil draft "Booking payment support" apagado (apontava ao segmento errado).

**Estrutura (P1)**
- ✅ Funis de waitlist fundidos num só ("Lista de espera", 5 emails); 23 inscrições realinhadas sem perda de posição; funil antigo pausado.
- ✅ Referral espera pelo onboarding: novos membros completam o acolhimento antes de receber pedidos de partilha (regra `FUNNEL_BLOCKED_BY` no motor).
- ✅ Segmento `expired-members` substitui `expired-pending-members` — **só** quota `expirado`; funil de renovação (draft) reduzido a 1 email e re-apontado.
- ✅ Drafts duplicados apagados: first-donation-thank-you, brochure-nurture.

**Motor (P2)**
- ✅ `left_segment`: quem sai do segmento é pausado automaticamente (exceção: `new-members`, cuja janela de 14 dias expira a meio do onboarding por desenho).
- ✅ Tarefas manuais removidas: passos `task` retirados dos funis (inscrições nesses passos marcadas completas), criação de hot-lead tasks removida, 81 tarefas abertas dispensadas.

**UI (P3)**
- ✅ 11 abas → 7; widget "Próximos Envios" no Dashboard.
- ✅ Redesign minimalista de toda a área de marketing (ver secção 3).

**Newsletter (2026-07-02)**
- ✅ 895 subscritores do Sender importados e deduplicados (766 novos, 102 enriquecidos, 7 suprimidos); consent `explicit`; língua vinda dos grupos do Sender.
- ✅ Segmentos `newsletter-pt` / `newsletter-en` / `newsletter-subscribers` no código e no filtro de Contactos do admin.
- ✅ Decisões da newsletter mensal registadas (secção 2.3): só subscritores, mensal, curadoria com aprovação, sem funil de nurture por agora.

**Pendente (decisão tua)**
- [ ] Montar a 1.ª edição da newsletter mensal (proposta de artigos → aprovação → envio em lotes; ver nota técnica em 2.3).
- [ ] Ativar o funil de renovação (draft): rever a copy de `membership_renewal` primeiro e confirmar segmento × copy. ~15 contactos em `expired-members`.
- [ ] Política de campanhas pontuais por script: registar sempre em `marketing_campaigns` para aparecer no admin (os 297 do anúncio de junho ficaram fora da contabilidade).
- [ ] Fazer deploy — as regras novas do motor (prioridade, left_segment, sem tarefas) e a UI nova só entram em vigor em produção com o deploy.
