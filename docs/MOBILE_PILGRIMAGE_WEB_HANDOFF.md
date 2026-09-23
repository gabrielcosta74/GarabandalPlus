# Pagamento de peregrinações — passagem app → site

A app abre o formulário completo de inscrição no browser do sistema com login
automático por um código temporário e de utilização única. A recolha dos dados,
o cálculo das prestações, o checkout, a confirmação Reduniq,
a reconciliação e a emissão FACT.pt continuam exclusivamente no site. A app
nunca interpreta o regresso do browser como prova de pagamento: consulta a API
da inscrição para atualizar o estado.

## Ordem de ativação

1. Aplicar `20260923094559_mobile_pilgrimage_web_handoff.sql` e
   `20260923094643_mobile_pilgrimage_web_handoff_least_privilege.sql`; confirmar RLS
   ativo e ausência de permissões para `anon`/`authenticated` na nova tabela.
2. Publicar o site com `MOBILE_PILGRIMAGE_WEB_HANDOFF_ENABLED=false` e testar
   os endpoints existentes de inscrição e pagamento. A app abre o URL normal
   de login/inscrição enquanto a flag estiver desligada.
3. Testar com dois utilizadores: A cria a passagem para a própria inscrição;
   B recebe 404 para a inscrição de A. O link de A deve expirar em 3 minutos,
   funcionar uma única vez e terminar na inscrição correta sem `view_token`
   permanente no URL. Confirmar que o token bruto nunca é guardado na tabela.
   Fazer o mesmo para iniciar uma nova peregrinação: depois da passagem, o site
   deve mostrar o formulário da peregrinação escolhida já autenticado como A,
   sem pedir outra palavra-passe ou link por email.
4. Ativar `MOBILE_PILGRIMAGE_WEB_HANDOFF_ENABLED=true` e verificar que
   `/api/mobile/capabilities` anuncia `externalBookingHandoffAvailable=true`.
   A capacidade pública pode demorar até 5 minutos a atualizar por cache.
5. Em sandbox, fazer uma inscrição inteiramente no site com e sem NIF/CPF, pagar com os métodos
   relevantes, sair e regressar à app, e confirmar que só um pagamento é
   contabilizado. Testar falha/cancelamento, sessão expirada, dois toques,
   reabertura do link e indisponibilidade do site.
6. Validar a Fatura-Recibo na série de peregrinações, total incluindo taxa,
   cliente correto, morada, IVA, PDF e email nos dois casos fiscais. Seguir o
   checklist e os gates de `docs/FACTPT_INTEGRATION.md`; esta passagem não
   autoriza emissão de produção nem altera a classificação fiscal existente.

## Desativação

Definir `MOBILE_PILGRIMAGE_WEB_HANDOFF_ENABLED=false`. A app volta a abrir a
página normal da inscrição no site (com login web se necessário). Não desligar
o checkout Reduniq nem o worker FACT.pt como parte deste rollback. Os links
temporários já emitidos deixam de funcionar; o membro pode abrir novamente a
inscrição na app.
