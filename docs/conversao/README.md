# Conversão das peregrinações: como o sistema funciona

Tudo o que serve para medir, perceber e melhorar as inscrições está nesta pasta.

## Peças

| Peça | Onde | O que faz |
|---|---|---|
| Tracking próprio | `src/lib/site-tracker.ts` → `/api/m` → tabelas `site_sessions`, `site_events`, `site_visitors` | Conta todas as visitas, com ou sem cookies (sem guardar IP). Liga o visitante ao lead e à inscrição quando deixa o email. |
| Painel | `/admin/conversao` | Funil, origens, quem contactar (com pontuação de interesse), perfil de cada pessoa, links de campanha e relatórios do Claude. |
| Pontuação de interesse | `src/lib/site-intent-score.ts` | Quente, morno ou frio, com as razões e a próxima ação. |
| Boletim semanal | Tarefa `revisao-semanal-conversao`, sextas às 15:00 · [BOLETIM_SEMANAL.md](BOLETIM_SEMANAL.md) | Números da semana, o que se partiu e quem contactar. Não mexe no site. Grava no painel (`trigger = 'semanal'`). |
| Revisão mensal | Tarefa `revisao-mensal-conversao`, dia 1 às 10:00 · [REVISAO_MENSAL.md](REVISAO_MENSAL.md) | Avalia as experiências, analisa segmentos e prepara no máximo 2 mudanças num branch. Grava no painel (`trigger = 'mensal'`). |
| Registo de experiências | [EXPERIENCIAS.md](EXPERIENCIAS.md) | Cada mudança com a hipótese, a métrica, o valor de partida e a data de avaliação. É assim que o sistema aprende. |
| Estudo de base | [ESTUDO_BASE_2026-11.md](ESTUDO_BASE_2026-11.md) | Números de partida: quem compra, quem desiste, que emails trazem inscrições. |
| Plano inicial | [PLANO_INICIAL_TRACKING.md](PLANO_INICIAL_TRACKING.md) | O diagnóstico que deu origem a tudo isto (histórico). |

As tarefas do Claude só correm com a app do Claude aberta. Se estiver fechada à hora marcada, correm quando a app voltar a abrir.

## Ciclo

1. **Todas as sextas:** ler o boletim e contactar as pessoas sugeridas.
2. **Dia 1 de cada mês:** ler a revisão. Aprovar ou não as mudanças preparadas no branch. Cada mudança aprovada já entra registada em `EXPERIENCIAS.md`.
3. **4 semanas depois de cada mudança:** a revisão mensal avalia se resultou (✅ manter, ❌ reverter, ⏸ inconclusivo).

## Migrações

- `supabase/migrations/20261102120000_site_tracking.sql`: tabelas e ingestão.
- `supabase/migrations/20261102150000_site_tracking_insights.sql`: funções de leitura, pessoas e relatórios.

## Flags

- Primeiro email de abandono adaptado ao passo onde a pessoa parou: o texto está pronto em `email-renderer.ts` (`registrationStep`), mas o motor de funis ainda não o preenche. A ligação foi retirada no commit 2ec2701 e só volta depois de o texto ser aprovado.
