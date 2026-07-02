# Estratégia de Funis de Marketing & Email — Apostolado de Garabandal

> **Estado:** plano aprovado para implementação faseada. Fase 0 é a próxima a construir.
> **Data:** 2026-06-30
> **Objetivo de negócio:** repescar leads, organizar a lista de contactos, fazer cross-sell
> (livros da loja, doações, adesão a membro), crescer a comunidade (convites/referral) —
> aumentando vendas e conversões **sem spammar**.

---

## 1. Contexto e objetivo

O sistema atual de marketing já tem um motor sólido, mas é usado quase só para **pedir**
(inscrição em peregrinação, renovação de quota). Faltam:

- aproveitar a lista de contactos para **outras ofertas relevantes** (livros, doações, membro);
- **conteúdo de valor** que mantém a lista quente entre pedidos (e protege a reputação);
- **cross-sell** entre os vários papéis (comprador ↔ doador ↔ peregrino ↔ membro);
- mecanismos de **crescimento da comunidade** (convidar pessoas).

Este documento mapeia o que existe, identifica as lacunas, define a estratégia e o plano
por fases.

---

## 2. Como o sistema funciona hoje (mapa técnico)

### 2.1 Fonte de contactos (a "lista")
[`buildMarketingContacts`](../src/lib/marketing-data.ts) unifica **10 fontes** numa única
lista de contactos, deduplicada por email/telefone:

| Fonte (tabela) | Sinal que gera |
|---|---|
| `membros` | estado de membro, quota, referral, tipo de subscrição |
| `booking_leads` | `brochure_request`, `waitlist`, inscrição abandonada (`draft`) |
| `pilgrimage_waitlists` | lista de espera |
| `bookings` | reservas / reservas confirmadas |
| `pilgrims` | peregrinos registados |
| `pilgrimage_payments` | pagamentos de peregrinação |
| `donations` | doações (valor, sucesso/falha) |
| `store_orders` | **encomendas da loja (valor)** — capturado mas não usado em funis |
| `pagamentos_quotas` | quotas pagas |
| `marketing_suppression_list` | supressões (não contactar) |

Cada contacto recebe `lead_score` (0–100), `lifecycle_stage` e `segments`, recalculados a
cada execução do cron — ver [`marketing-core.ts`](../src/lib/marketing-core.ts).

### 2.2 Segmentos atuais
[`evaluateMarketingSegments`](../src/lib/marketing-core.ts#L230):
`hot-pilgrimage-leads`, `abandoned-registration`, `brochure-requested-not-booked`,
`waitlist-contacts`, `past-pilgrims`, `donors-not-members`, `new-members`,
`members-without-referrals`, `expired-pending-members`, `high-value-supporters`.

### 2.3 Funis ativos (na BD `marketing_funnels`)
| Funil | Segmento | Estado | Passos |
|---|---|---|---|
| Member renewal support | expired-pending-members | draft | membership_renewal → task |
| Booking payment support | hot-pilgrimage-leads | draft | payment_support (cond. pending) → task |
| First donation thank-you | donors-not-members | draft | donation_thank_you → donor_to_member |
| Donor to member | donors-not-members | **active** | member_invitation → task |
| Abandoned registration recovery | abandoned-registration | **active** | abandoned_registration_1 → faq → final → task |
| Waitlist conversion | waitlist-contacts | **active** | waitlist_welcome → task |
| Member referral activation | members-without-referrals | **active** | referral_activation → share_mission |
| Brochure nurture | brochure-requested-not-booked | draft | brochure_followup_1 → pilgrimage_testimony → task |
| Member onboarding | new-members | **active** | welcome → pray_intentions → novena → learn_garabandal |

### 2.4 Motor de envio (cron)
[`/api/cron/marketing-automations`](../src/app/api/cron/marketing-automations/route.ts):
1. Para cada funil **ativo**, reconstrói os contactos e inscreve quem está no segmento.
2. Busca enrollments com `next_run_at <= agora`, **ordenados por `next_run_at` (FIFO)**.
3. Processa cada um: verifica objetivo/condição/cadência → envia ou cria tarefa → avança passo.

### 2.5 Governador anti-spam (já existe e é robusto)
[`marketing-limits.ts`](../src/lib/marketing-limits.ts):
- **máx. 1 email / dia por contacto**, com teto técnico de 7 emails / 7 dias (`MARKETING_MAX_EMAILS_PER_7D`);
- **mínimo 24h entre emails** por contacto (`MARKETING_MIN_HOURS_BETWEEN_EMAILS`);
- teto global de 50/dia, lote de 15 por execução.
- O limite é **global por contacto** (conta `marketing_message_logs`, não por funil) → estar
  em vários funis **não** gera spam; os emails ficam em fila e são reagendados para respeitar a janela de 24h.
- `List-Unsubscribe` one-click (RFC 8058) já implementado ✅.

---

## 3. Lacunas estratégicas (o que melhorar)

1. **Zero cross-sell da loja.** `store_value`/`store_orders` são capturados mas só alimentam
   `high-value-supporters`. Não há segmento nem funil de loja. Não há template `category: 'Loja'`.
2. **Contradição da lista de espera.** Quem está em lista de espera (`waitlists > 0`) também
   entra em `hot-pilgrimage-leads` ([core:233](../src/lib/marketing-core.ts#L233)) e leva +50
   de score ([core:255](../src/lib/marketing-core.ts#L255)), sendo tratado como lead a converter
   com copy "garanta a sua vaga" — mesmo sem vagas. O template certo `waitlist_open_spot`
   **nunca dispara** (só existe como opção manual no admin).
3. **Nenhum funil verifica disponibilidade real.** A recuperação empurra "garanta a vaga" mesmo
   que a peregrinação esteja esgotada.
4. **Sequenciamento FIFO, não estratégico.** Em sobreposição de funis, envia-se o que está "due"
   primeiro, não o de maior valor → não há prioridade.
5. **Tudo são pedidos; falta valor.** Só há nurture espiritual para membros. Sem newsletter/conteúdo
   que dê valor entre pedidos — que é o que de facto evita queixas/spam.
6. **Sem topo de funil nem winback.** Não há captura de subscritores/lead magnet; inativos >180d só
   penalizam score, sem reativação.
7. **Sobreposição de segmentos sem desempate** (`hot-pilgrimage-leads` ≈ `abandoned-registration`).

---

## 4. Estratégia: a "escada do ciclo de vida"

Cada contacto sobe uma escada; em cada degrau recebe **valor + 1 pedido estratégico**
(nunca só pedidos):

```
Prospect ─▶ Lead peregrinação ─▶ Peregrino / Doador / Comprador ─▶ Membro ─▶ Embaixador
 (newsletter)   (brochura/         (cross-sell loja, doação,        (benefícios  (referral,
                 abandono)          conversão a membro)              reais)       convidar amigo)
```

### Matriz de cross-sell (hoje inexistente)
| De \ Para | Livro (loja) | Doação | Membro | Peregrinação | Convidar amigo |
|---|---|---|---|---|---|
| **Comprador livro** | repetir/relacionado | soft-ask impacto | benefícios | testemunho | ✔ |
| **Doador** | livro relacionado | recorrência | **prioritário** | — | ✔ |
| **Peregrino** | livro recordação | impacto | benefícios | próxima data | ✔ (forte) |
| **Membro** | exclusivo membro | campanha | — | desconto membro | **member-get-member** |

**Princípio anti-spam:** entre quaisquer 2 "pedidos" há sempre **conteúdo de valor**. O cap de
1/dia já trava o volume; o que falta é **relevância e ordem**.

---

## 4b. Sistema de design dos emails (decidido)

O template visual aprovado é o estilo do email de **mudança de domínio / acesso** —
[`emails/_preview-login-access.html`](../emails/_preview-login-access.html). Características:
- **Hero** com imagem de Nossa Senhora de Garabandal + overlay escuro em gradiente.
- **Badge dourado** (`#d4af37`) com a categoria, **headline grande** a branco.
- Card branco arredondado (20px) com sombra suave sobre fundo `#eef2f8`.
- Tipografia `Helvetica Neue`/Arial; CTA principal dourado; estrutura em tabelas (Outlook-safe).

**Adições para marketing** (já prototipadas em `scratchpad/email-preview/index-novo.html`):
- Bloco de ajuda com **botão verde "Falar no WhatsApp"** (`wa.me/351915206815`) + `geral@…`.
- Linha de **cancelar subscrição** no rodapé.
- Opção de **cartão de produto** (capa + título + preço + link) para emails de loja.

**Bloqueio de modo escuro (requisito):** o email deve manter-se **sempre claro**, mesmo com o
telemóvel/cliente em dark mode (o fundo aparecia escuro no iOS). Técnicas aplicadas no protótipo:
- `<meta name="color-scheme" content="light only">` + `supported-color-schemes` + `:root{color-scheme:light only}`;
- `@media (prefers-color-scheme: dark)` a forçar fundo/card/texto com `!important` (iOS/Apple Mail);
- seletores `[data-ogsc]` / `[data-ogsb]` para o **Outlook dark mode** (web e desktop);
- `bgcolor` explícito no `body`, wrapper e card (clientes legados/Outlook).
- *Caveat honesto:* o **app do Gmail** (sobretudo Android) faz inversão parcial própria que nenhum
  email controla a 100% — mas com os fundos explícitos fica claro e legível na prática.

**Implementação (Fase 0):** converter o `Layout` de [`email-renderer.ts`](../src/lib/email-renderer.ts)
para este estilo (incl. bloqueio dark-mode), mantendo as APIs (`Header`, `Section`, `Button`,
`renderMarketingTemplateEmail`) para que todos os templates existentes e futuros (loja, newsletter)
o herdem automaticamente.

## 5. Plano por fases

### ✅ FASE 0 — Fundações & correções *(próxima a implementar)*
*Baixo risco, só código, arruma a casa antes de escalar.*

1. **Corrigir a contradição da lista de espera**
   - Remover `waitlists > 0` da condição de `hot-pilgrimage-leads`
     ([marketing-core.ts:233](../src/lib/marketing-core.ts#L233)).
   - Manter lista de espera só no segmento `waitlist-contacts` com copy correta (já existe
     `waitlist_welcome`: "está na lista, avisamos quando houver vaga").
2. **Gate de disponibilidade nos funis de recuperação**
   - Nova condição de passo `has_availability` em
     [`marketingStepConditionPasses`](../src/lib/marketing-automation-engine.ts#L26), para os
     emails de "garanta a vaga" só dispararem quando há vagas reais.
3. **Ligar `waitlist_open_spot` a um trigger real**
   - Disparar o email "abriu uma vaga" quando a peregrinação passa a ter disponibilidade
     (a parte que faz sentido e está desligada). Definir o gatilho (cron que compara
     `waitlist` vs vagas, ou hook na gestão de reservas).
4. **Prioridade no motor de envio**
   - Ordenar enrollments devidos por valor/score do contacto (e não só `next_run_at`) em
     [cron route](../src/app/api/cron/marketing-automations/route.ts#L87), para o contacto
     receber primeiro o email mais relevante quando há sobreposição.
5. **Unsubscribe granular por tema** *(opcional dentro da fase)*
   - Permitir cancelar por tema (peregrinações / loja / doações / espiritual) em vez de
     tudo-ou-nada → reduz opt-outs totais. Requer coluna de preferências no contacto.

**Critério de conclusão da Fase 0:** lista de espera deixa de receber copy de "garanta a vaga";
`waitlist_open_spot` dispara automaticamente; ordem de envio passa a respeitar valor.

---

### FASE 1 — Captura & organização da lista
1. **Signup de newsletter / lead magnet** (ex.: ebook/novena grátis sobre Garabandal) → nova
   fonte de contactos + **welcome flow** de 2–3 emails.
2. **Novos segmentos**: `store-buyers-not-members`, `store-buyers-no-repeat`,
   `donors-not-buyers`, `pilgrims-not-members`, `inactive-180d`, `newsletter-only`.
3. **Normalização** para a lista ficar acionável: idioma, país, tema de interesse inferido pela
   origem (quem veio por um livro ≠ quem veio por peregrinação).

---

### FASE 2 — Cross-sell & conversão *(aumentar vendas)*
1. **Funis de loja** (novos templates `category: 'Loja'`):
   - pós-compra "obrigado + livro relacionado";
   - "novo título / recomendado para si";
   - recomendação de livro a peregrinos e doadores.
   - Copy com **benefício real** (o que o leitor ganha), não catálogo.
2. **Doação ligada a impacto**: usar `donation_thank_you_story` + soft-ask de doação pós-compra
   e pós-peregrinação.
3. **Escada para membro com benefícios concretos** (diploma digital, conteúdos exclusivos,
   bónus 5€ — já existe em `lead_to_member_welcome`), alargada a **compradores e peregrinos**,
   não só doadores.
4. **Winback** de inativos (>180d): "sentimos a sua falta + novidade/conteúdo".

---

### FASE 3 — Comunidade & referral *(crescer o Apostolado)*
1. **Convidar amigo** alargado a *todos* os compradores/doadores/peregrinos (hoje só membros),
   com recompensa mútua (saldo loja).
2. **Referral melhorado** (templates `referral_activation` / `share_mission` já existem) +
   member-get-member.
3. **Campanhas sazonais/litúrgicas**: N. Sra. do Carmo (16 jul, central em Garabandal), Advento,
   Quaresma, aniversário de adesão. Razão natural para contactar sem parecer venda.

---

### FASE 4 — Conteúdo & cadência anti-spam
1. **Newsletter de valor** (testemunhos, notícias de Garabandal, novenas, excertos de livros)
   **intercalada** com os pedidos → ratio valor:pedido saudável.
2. **Governador de relevância**: garantir conteúdo de valor entre 2 pedidos; respeitar 1/dia;
   honrar preferências de tema (Fase 0.5).
3. A/B de assuntos + hora de envio + higiene de deliverability (one-click já ✅).

---

### FASE 5 — Medição
- Conversão por funil (a coluna `metrics` em `marketing_funnels` já existe).
- Atribuição de receita (loja / doação / quota) por funil.
- **Monitorização da taxa de opt-out** como travão de segurança (se sobe, abrandar).

---

## 6. Princípios anti-spam (transversais)
- O cap global (**1/dia, 24h**) é a proteção principal — já construído. **Não** precisa de
  baixar volume; precisa de **subir relevância**.
- Regra de ouro: **nunca 2 pedidos seguidos sem valor pelo meio**.
- Sempre `List-Unsubscribe` one-click + (Fase 0.5) opt-out por tema.
- Conteúdo de valor protege a reputação de domínio quando o volume crescer.

---

## 7. Itens técnicos auxiliares (fora do âmbito de funis, mas relacionados)
*Detetados na auditoria de URLs — tratar quando conveniente:*
- Confirmar que as env de produção (`APP_URL` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`)
  apontam para o **apex** `apostoladodegarabandal.com` e **não** `app.` (o README refere
  `CRON_TARGET_URL=https://app...`, sinal de que o subdomínio ainda está em uso).
- Corrigir subdomínio `app.` hardcoded em
  [scripts/send-all-login-emails.ts](../scripts/send-all-login-emails.ts#L59) e
  [scripts/send-test-login-email.ts](../scripts/send-test-login-email.ts#L29).

> **Já feito nesta sessão:** botão direto de WhatsApp no rodapé de todos os emails + substituição
> de "responda a este email" (saía de `no-reply@`, não funcionava) por contacto via WhatsApp /
> `geral@apostoladodegarabandal.com` — em [`email-renderer.ts`](../src/lib/email-renderer.ts).

---

## 8. Decisões em aberto (a confirmar antes de cada fase)
- **Fase 0.3** — gatilho do `waitlist_open_spot`: cron periódico que compara lista de espera vs
  vagas, ou hook quando uma reserva é cancelada/aberta? (definir ao implementar)
- **Fase 0.5** — implementar já o opt-out por tema ou adiar para a Fase 4?
- **Fase 1** — qual o lead magnet concreto (ebook? novena? amostra de livro?).
- **Fase 2** — catálogo de regras de "livro relacionado" (manual por categoria vs. automático).
