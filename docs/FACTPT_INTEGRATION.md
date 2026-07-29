# Integração FACT.pt

Esta integração suporta sandbox e produção automática estritamente limitada
a pagamentos de peregrinações. A produção exige, em simultâneo:

- `FACTPT_PRODUCTION_ENABLED=true` apenas no servidor;
- a linha `production` de `factpt_settings` ativa;
- `production_pilgrimages_only=true`;
- `require_approval=false` e `pilot_private_only=false`;
- `go_live_at` posterior ao deploy validado do worker.

Quotas, loja e donativos gerais continuam sem autorização de produção. A
trigger rejeita qualquer origem que não seja `pilgrimage_payments` e o cliente
também bloqueia essas origens antes de qualquer chamada externa.

## Séries

| Origem | Série | Credencial |
| --- | --- | --- |
| Quotas | `2026Q` | `FACTPT_SANDBOX_KEY_2026Q` |
| Loja | `2026L` | `FACTPT_SANDBOX_KEY_2026L` |
| Donativos | `2026D` | `FACTPT_SANDBOX_KEY_2026D` |
| Prestações de peregrinações | `2026D` | `FACTPT_SANDBOX_KEY_2026D` |

Em produção, só a última linha está ativa e usa
`FACTPT_PRODUCTION_KEY_2026D`.

Donativos e prestações de peregrinações incluem sempre em
`document.comments`:

```text
Doação sem contrapartidas
```

Nas peregrinações, o cliente fiscal é sempre o titular da conta que possui a
reserva. Os restantes peregrinos não originam documentos separados. O email do
titular é o destinatário normal do PDF; na sandbox, o destinatário é sempre
substituído pelo email de teste configurado.

Nos pagamentos Reduniq de peregrinações, `pilgrimage_payments.amount` mantém
apenas o valor creditado à prestação. A taxa cobrada ao pagador fica em
`processing_fee_amount` e `charged_amount` é calculado pela base de dados como
a soma dos dois. O total do documento FACT.pt usa `charged_amount`; o saldo da
reserva continua a usar exclusivamente `amount`.

## Decisão do documento

- Peregrinações: sempre Fatura-Recibo para o titular da reserva.
  - Com NIF válido, o cliente é pesquisado pelo NIF.
  - Sem NIF, é criado ou reutilizado um cliente nominal com
    `finalConsumer:true`; nome, email e morada permanecem no cliente e a
    FACT.pt identifica o contribuinte como `Consumidor final`.
  - Nome, email, morada, código postal, cidade e país continuam obrigatórios.
- Restantes origens com NIF e dados fiscais completos: Fatura-Recibo.
- Restantes origens sem NIF/dados completos: Fatura Simplificada para
  Consumidor Final.
- Limite total da Fatura Simplificada: encomendas da loja até 1.000 €;
  quotas e donativos até 100 €. O limite da simplificada não se aplica às
  peregrinações porque estas usam sempre Fatura-Recibo.
- Acima do limite sem dados suficientes: `needs_data`, sem chamada à FACT.pt.
- Email é obrigatório. Um email vazio ou técnico é um erro de integridade.
- O PDF oficial segue como anexo no template institucional do Apostolado. O
  email não inclui links públicos ou permanentes da FACT.pt.
- Em produção, o destinatário é o email do titular aprovado no snapshot; na
  sandbox, é sempre substituído pelo email de teste.

Para Fatura-Recibo com NIF, pesquisar primeiro por NIF:

```http
GET /clients?searchTin={NIF}
```

Reutilizar o cliente encontrado. Criar com `POST /clients` apenas quando não
existe e nunca usar `forceTin:true`.

Para uma peregrinação sem NIF, pesquisar pelo email e nome com
`GET /clients?search=...`. Reutilizar apenas uma correspondência exata do
mesmo consumidor final; se os contactos ou a morada mudaram, atualizar por
`POST /clients/{id}`. Ao criar, enviar `finalConsumer:true` e omitir
completamente `tin`, `ric` e `retention`.

## Endpoints utilizados

- `GET /clients?searchTin=...`
- `GET /clients?search=...`
- `POST /clients`
- `POST /clients/{id}`
- `GET /taxes`
- `POST /documents/invoicereceipt`
- `POST /documents/simpleinvoice`
- `GET /documents/{id}/download`

Headers:

```http
x-auth-token: <chave da série>
api-version: 1.0.0
Content-Type: application/json
```

A sandbox usa `http://api.sandbox.fact.pt`, aceita apenas dados fictícios e
pode eliminar os dados periodicamente. A produção usa `https://api.fact.pt`.

## Idempotência e limites

- `identifierId`: `gp:{source_type}:{source_id}`, máximo de 50 caracteres.
- Uma emissão por `(environment, source_type, source_id)`.
- Máximo global de uma chamada por segundo.
- Limites documentados: 100 clientes/dia, 100 produtos/dia e 200
  documentos/dia.
- Depois de timeout, falha de rede ou resposta inválida durante a emissão, o
  trabalho não volta a emitir sem reconciliação.
- Um worker que fique interrompido em `processing` é colocado em
  `stale_processing_reconciliation_required`; nunca é reclamado
  automaticamente para uma segunda emissão.
- Falhas de email são repetidas como email-only, até cinco tentativas. O PDF é
  descarregado novamente pelo ID já emitido; nunca é criada outra fatura.

## Validação antes da emissão

Novos trabalhos entram em `awaiting_approval` quando
`factpt_settings.require_approval=true`:

1. **Preparar validação** carrega o pagamento e valida impostos/artigos na
   FACT.pt, mas não cria cliente, não emite documento e não envia email.
2. O admin confirma titular, email, contribuinte/Consumidor final, morada,
   referência, meio de pagamento, linhas, IVA, total e observações.
3. **Aprovar e emitir** guarda o administrador, a hora e um SHA-256 do snapshot
   fiscal, mudando o trabalho para `pending`.
4. O worker só pode emitir o snapshot aprovado. Qualquer alteração posterior
   faz a emissão parar e obriga a nova validação.

Este modo continua disponível para sandbox, testes e intervenções manuais. Em
produção automática de peregrinações, `require_approval=false`: o worker
carrega e valida o snapshot, bloqueia dados incompletos em `needs_data` e emite
apenas quando todas as regras fiscais passam.

## Processamento

`factpt_documents` funciona como fila e registo. O cron chama
`GET /api/cron/factpt` com `Authorization: Bearer <CRON_SECRET>`.

O cron Reduniq procura todos os pagamentos pendentes, sem os excluir por
idade, e reconhece `reduniq`, `reduniq_card`, `reduniq_mbway`, `reduniq_pix` e
`reduniq_multibanco`. Uma falha da Supabase ou da Reduniq faz o cron responder
com erro, para não produzir um falso resultado verde. Webhook, confirmação no
browser e reconciliação convergem na mesma referência única do pagamento.

Nos pagamentos processados pelo terminal geral Reduniq, o meio de pagamento
fiscal é sempre `paymentType: 9` (`Outros`). A aplicação não tenta inferir
cartão, MB WAY, PIX ou Multibanco a partir da opção apresentada no checkout.
Transferências bancárias confirmadas continuam a usar `paymentType: 11`.

Na sandbox, `factpt_settings.auto_enabled` é `false`. Os testes são criados
explicitamente por um administrador através de `POST /api/admin/factpt/enqueue`,
com `confirmFictitious:true`. O pagamento selecionado tem de usar um email
terminado em `.test` ou pertencer à reserva privada de teste FACT.pt,
explicitamente marcada e associada ao utilizador autorizado. Em produção, as
triggers apenas enfileiram transições novas para pago; nunca chamam serviços
externos dentro da transação da base de dados. `go_live_at` impede a captura de
pagamentos históricos.

## Checklist sandbox

1. Criar três API keys sandbox associadas às séries.
2. Guardar as chaves diretamente nas variáveis seguras.
3. Definir `FACTPT_SANDBOX_EMAIL_OVERRIDE` para uma caixa de teste.
4. Definir `FACTPT_ZERO_TAX_ID_2026D` com o imposto a 0% cujo motivo fiscal
   foi confirmado para donativos sem contrapartida. A integração bloqueia a
   emissão se existirem várias opções a 0% e nenhuma tiver sido escolhida.
5. Aplicar a migração Supabase.
6. Validar impostos devolvidos por cada chave e confirmar o
   `FACTPT_UNIT_ID` configurado.
7. Preparar e rever os testes fictícios antes de cada aprovação.
8. Emitir testes de FR e FS nas três séries, incluindo uma Fatura-Recibo de
   peregrinação sem NIF.
9. Confirmar série, número, linhas, IVA, total, observações e PDF.
10. Confirmar que um retry não duplica o documento.
11. Manter `auto_enabled=false` e `require_approval=true` até existir uma fase
    de produção aprovada.

## Checklist de produção automática

1. Fazer deploy do código validado mantendo a produção desligada.
2. Guardar no alojamento, como segredos server-side:
   `FACTPT_PRODUCTION_KEY_2026D`, `FACTPT_PRODUCTION_UNIT_ID` e
   `FACTPT_PRODUCTION_ZERO_TAX_ID_2026D`.
3. Definir `FACTPT_PRODUCTION_ENABLED=true` e redeploy.
4. Confirmar o cron `/api/cron/factpt` com `CRON_SECRET`.
5. Aplicar a migration com `production_pilgrimages_only=true`.
6. Ativar `factpt_settings.production` com `require_approval=false`,
   `pilot_private_only=false` e `go_live_at` posterior ao deploy.
7. Confirmar no admin que o banner mostra produção automática.
8. Validar que não existem trabalhos históricos `pending`.
9. Acompanhar o primeiro pagamento real: um pagamento, um `identifierId`, uma
   Fatura-Recibo, um PDF e um email.
