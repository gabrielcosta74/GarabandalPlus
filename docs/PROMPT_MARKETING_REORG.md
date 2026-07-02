# Prompt — Reorganizar o Sistema de Marketing Automático

> Este é o prompt para pedir o documento de reorganização. Revê, ajusta o que quiseres,
> e devolve-mo (ou diz "avança") para eu gerar o documento final.

---

## O QUE QUERO

Cria um documento `docs/MARKETING_SYSTEM.md` que me deixe **perceber, organizar e confiar** no
sistema automático de marketing por email do Apostolado de Garabandal. Hoje a área de marketing do
admin está confusa: há funis e segmentos a mais, sobrepostos, e eu não consigo ver **quem recebe o
quê e quando**. Quero um sistema **automático, mas com regras claras e visíveis** — que corra sozinho
sem eu ter medo de estar a mandar coisas a toa.

## FILOSOFIA (a regra de ouro)

O sistema deve ser **automático com regras claras**. Eu confio nele se:
1. Cada contacto tem **um lugar óbvio** (um estado/segmento) e eu sei que email vai receber a seguir.
2. As **regras anti-spam** estão escritas e são respeitadas (nunca mandar demais, nunca ao segmento errado).
3. Não há **funis sobrepostos** a competir pelo mesmo contacto sem eu perceber porquê.

## INVESTIGA A FUNDO (não assumas)

Antes de escrever, investiga o **código real** e os **dados reais**:
- Código: `src/lib/marketing-*.ts` (engine, core, data, limits, email), os crons em
  `src/app/api/cron/*` e a UI `src/app/admin/marketing/*`.
- Dados: consulta o Supabase de produção (contactos, funis, segmentos, enrollments, logs de envio)
  para números reais — não estimativas.

## O DOCUMENTO DEVE TER 5 PARTES

### 1. MAPA — Como funciona hoje (em português simples)
- O fluxo ponta-a-ponta: contacto → segmento → funil → passo → email, com os crons e horários.
- Lista de **todos os funis** (ativos e draft), o que cada um faz, para que segmento, e quantos passos.
- Lista de **todos os segmentos**, a regra que mete um contacto em cada, e **quantos contactos** tem hoje.
- Os **limites** (frequência, teto diário/semanal) explicados em linguagem humana.
- Como o sistema **reagenda** e **ignora** (condição falha, limite atingido, meta atingida, sem consentimento).

### 2. FALHAS — O que está mal / confuso
- **Buracos de cobertura**: segmentos com contactos mas sem funil ativo (quem fica sem receber nada).
- **Sobreposições**: contactos que caem em vários funis ao mesmo tempo e podem receber a mais.
- **Riscos**: ex. segmentos que misturam estados que não deviam receber o mesmo email.
- **Falta de visibilidade**: o que hoje é impossível de ver no admin e devia ser fácil.

### 3. PLANO — Reorganizar com o que já temos
- Proposta para **simplificar**: reduzir/renomear funis e segmentos para um conjunto claro e sem sobreposição.
- Um **mapa "1 estado do contacto → 1 sequência"** para eu perceber de relance.
- Ordem de prioridade das mudanças (o que muda primeiro, impacto vs esforço).
- Não inventar features grandes novas — organizar e clarificar o que existe.

### 4. REGRAS — Livro de regras do sistema
- Regras de **quem recebe o quê e quando** (tabela por segmento/estado).
- Regras **anti-spam** (frequência, teto, prioridade quando há conflito de funis).
- Regras de **"nunca fazer"** (ex. segmentos sensíveis, estados que não devem receber certos emails).
- Regras de **paragem** (quando um contacto sai de um funil / completa a meta).

### 5. UI ADMIN — Como reorganizar as páginas
- Proposta de como reorganizar a área de marketing do admin para eu **ver quem recebe o quê e quando**,
  o estado de cada funil, e confiar no que está a acontecer.
- O que mostrar em cada ecrã (visão geral, funis, contactos, envios) e o que simplificar/remover.

## FORMATO
- Português (PT-BR na parte de conteúdo/exemplos), claro e escaneável, com tabelas e listas.
- Números reais da base de dados, com a data da recolha.
- No fim, um **checklist de ações** priorizado (o que fazer a seguir).

## O QUE NÃO FAZER
- Não executar mudanças no sistema ainda — este passo é só o **documento/plano**.
- Não enviar emails nem ativar/desativar funis sem eu aprovar.
