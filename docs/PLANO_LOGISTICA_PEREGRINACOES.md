# Logística & Contas das peregrinações

Substitui o `Contabilidade_Peregrinação_IItalia-Medjugorje 2027.xlsx` por uma área
dedicada no admin. Estado: **os seis separadores gravam na base de dados.**

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Entrada | Botão **Logística** em cada peregrinação (lista e editor) → `/admin/peregrinacoes/[id]/logistica` |
| Identidade | Área separada, cabeçalho escuro, separadores próprios. Não é um separador do editor. |
| Quartos | Planta **única** para toda a viagem (não por hotel) |
| Fornecedores | **Total + já pago**, sem histórico de pagamentos |
| Preço de hotel | **Partilhado + suplemento de individual**, não tabela por tipologia |
| Lugares especiais | Dois tipos distintos — ver abaixo |
| Inscrições e pagamentos | **Leitura apenas.** A área nunca escreve em `bookings` nem em `pilgrimage_payments` |

### Cortesia vs lugar guardado

São conceitos diferentes e não devem partilhar campo:

- **Cortesia** (`courtesy`) — Pe. João Mota, Rui Costa, motorista. Ocupam cama, contam
  para o custo de hotéis e refeições, geram 0€ de receita, nunca entram em cobranças
  nem em faturação.
- **Lugar guardado** (`held`) — Roberta Junqueira, mãe da Maria Helena. Vaga travada
  temporariamente enquanto se confirma se a pessoa vem. **Paga preço normal.** Tem
  data-limite; ao expirar liberta a vaga; ao confirmar converte-se em inscrição real.

## Separadores

| Separador | Substitui no Excel | Faz |
|---|---|---|
| **Painel** | — | Números de topo e alertas do que está por fechar |
| **Cobranças** | `Pagamentos-peregrinos` | Quem falta pagar, filtros, notas de seguimento |
| **Quartos** | `Distribuição dos quartos` | Board com arrastar-e-largar, deteta conflitos |
| **Hotéis** | `Hoteis` + `Preços hoteis` | Estadias com cálculo aberto, e orçamentos em estudo |
| **Serviços** | `Restaurantes` + `Transporte` + `Voos` | Fornecedores, unitário × pax, estado, sinal |
| **Contas** | `Saldo final` | Receita vs despesa, margem, break-even, cenários |

A folha `inscrições` não é substituída — já vive em `pilgrims`/`bookings`.
A folha `Percurso` também não — já vive em `pilgrimage_stages`.

## Como o preço de hotel é modelado

Não há tabela de tipologias. Cada estadia tem quatro números:

```
preço por pessoa/noite em quarto partilhado
+ suplemento de individual por noite
× pessoas em partilhado / pessoas em individual
```

Validado contra os 7 hotéis do Excel — encaixa em todos (Roma 134,50 + 45 = 179,50;
SGR 60 + 30 = 90; Medjugorje 59 + 28 = 87). Os triplos foram removidos: estavam a zero
nas 7 estadias e o preço era igual ao do duplo em 6 delas.

Mais dois campos que valem dinheiro: taxa turística por pessoa/noite, e "1 grátis por
cada N pessoas". O custo sai daí:

```
(partilhados × preço + individuais × (preço + suplemento)) × noites
+ taxa × pax × noites
− quartos grátis × preço × noites
```

Total refeito: **68.429,50 €** contra os 69.765 € do Excel.
Dos quais 2.180,50 € são gratuitos que a folha nunca reclamava.

## Erros encontrados no Excel

Detetados ao refazer as contas de raiz. A maquete mostra ambos os valores lado a lado.

1. **Taxa turística ignorada ou subtraída.** San Giovanni Rotondo (2 estadias),
   Royal Caserta (2 estadias) e Medjugorje têm taxa por pessoa/noite que a folha ou
   omite ou subtrai em vez de somar. Em Medjugorje conta 1 noite em vez de 3.
2. **Quartos gratuitos nunca descontados.** Seis dos sete hotéis dão 1 grátis por
   cada 20 ou 25 pessoas. Com 65 pax isso são vários milhares de euros que a folha
   simplesmente não reclama.
3. **Número de pessoas inconsistente.** A folha dos hotéis usa 65, a distribuição de
   quartos 53, e o saldo final divide por 55.
4. **Divergência de receita com o sistema.** O Excel diz 14.705,56 € recebidos sobre
   158.600 €. A base de dados tem 16.215,06 € sobre 141.280 €, em 44 inscrições.
   O sistema está mais correto nos recebimentos; o Excel tem pessoas que nunca
   chegaram a inscrever-se.

## Estado da migração

| Separador | Fonte |
|---|---|
| **Painel** | agregados do servidor |
| **Cobranças** | inscrições + pagamentos + notas |
| **Quartos** | planta, ocupantes e lugares especiais |
| **Hotéis** | estadias e preços |
| **Serviços** | restaurantes, transporte, voos |
| **Contas** | tudo o acima, agregado |

### Tabelas criadas

```
pilgrimage_seats              cortesias e lugares guardados
pilgrimage_hotel_stays        estadias, preços, taxa, gratuitos, sinal
pilgrimage_hotel_quotes       alternativas em estudo por cidade
pilgrimage_costs              restaurantes, transporte, voos, museus
pilgrimage_rooms              planta de quartos
pilgrimage_room_members       quem está em que quarto
pilgrimage_collection_notes   notas internas de cobrança
```

**`src/lib/logistics-mock.ts` foi apagado.** Nenhum ecrã lê números de ficheiro.

Índices únicos em `pilgrimage_room_members` garantem que ninguém está em dois
quartos ao mesmo tempo.

### Geração automática da planta

`POST /rooms/generate` distribui toda a gente a partir das inscrições:

1. Quem partilha a **mesma reserva** fica junto (casais e famílias inscrevem-se numa só).
2. **`roommate_name`** aponta para outra pessoa — junta as duas. Os nomes escritos à
   mão raramente batem certo, por isso a correspondência conta palavras em comum e
   tolera plurais e o troca-troca c/ç: *"Maria da Graça Teixeira"* encontra
   *"Maria das Graças Teixeira Chaves"*, *"Victor"* encontra *"Vitor"*. São precisas
   duas palavras em comum, o que impede juntar duas Marias diferentes.
3. **`bed_preference`** decide entre duplo de casal e twin.
4. O resto é emparelhado dentro da mesma tipologia.

Ambas com RLS `is_admin()` e trigger de `updated_at`. Endpoints em
`/api/admin/logistics/[pilgrimageId]/…`, todos com `verifyAdmin`.
O checkout, o webhook, a waterfall de pagamentos e a faturação FACT.pt não são tocados.

### O ciclo tipologia → orçamento

`pax_shared`/`pax_single` a **NULL** numa estadia significam *"seguir a
distribuição real das inscrições"*. É o que faz o orçamento acompanhar quem muda
de quarto, sem ninguém ter de reescrever números:

| Cenário | Mistura | Hotéis |
|---|---|---|
| Real hoje | 57 partilhado + 10 individual | 72.827 € |
| Se 5 passarem a individual | 52 + 15 | 75.122 € |
| Se 5 individuais partilharem | 62 + 5 | 70.532 € |

Quem quiser fixar o número numa estadia concreta preenche os campos; ficam a
ignorar as inscrições até serem limpos.

### Uma fonte só para o dinheiro

`getPilgrimageAccounts` calcula no servidor a despesa por rubrica (`expenses`) e
o saldo (`balance`). Os ecrãs mostram, não recalculam — foi assim que se acabou
com o Painel a dizer 97.470 € e as Contas 102.227 €.

Invariantes verificados contra a base de dados real:

```
hotéis linha a linha        == expenses.hotels
rubricas de serviços        == services.total
hotéis + serviços           == expenses.total
receita − despesa           == balance.result
total − pago                == expenses.due
receita por pessoa          == receita por reserva
recebido por pessoa         == pagamentos verificados
partilhado + individual     == camas
cortesias                   == 0 de receita
```

### O que segue as inscrições sozinho

| Campo | Comportamento |
|---|---|
| `pax_shared` / `pax_single` de uma estadia | NULL = tipologia real dos inscritos |
| `pax` de um custo | NULL = número de camas |

Preencher fixa o valor; o botão *Auto* volta a soltá-lo.

## Sistema visual

Toda a cor, escala tipográfica e comportamento de hover vive em
`logistica/components/kit.tsx`. **Os ecrãs não escrevem classes de cor do Tailwind.**
Motivo: antes havia `red` e `rose`, `blue` e `sky` a coexistir na mesma área.

Os ecrãs pedem um **papel**, não uma cor — e o papel mapeia para os tons de
`components/admin/ui/tones.ts`, os mesmos do resto do painel:

| Papel | Tom | Significa |
|---|---|---|
| `neutral` | slate | por decidir, sem dados |
| `progress` | sky | em curso |
| `waiting` | amber | à espera de ação nossa |
| `done` | emerald | fechado, pago |
| `alert` | rose | problema real |
| `special` | violet | cortesia |

**Regra do dinheiro** (`dueRole`): um valor em dívida só fica vermelho quando o
prazo já passou. Sem isto, sete linhas a dizer "falta pagar" ficavam todas
vermelhas e o alarme perdia o significado.

**Sem chrome nativo:** `NumberField` remove as setas do browser e mete a unidade
dentro do campo; `DateField` mostra um botão nosso e abre o calendário do sistema
por cima — um campo vazio diz mesmo que está vazio (o Safari mostrava a data de
hoje a cinzento, o que parecia preenchido).

**Ações de linha** (`RowAction`) estão sempre presentes a 45% de opacidade e
ficam cheias no hover da linha. Apagar nunca fica escondido atrás de uma expansão.

## Ficheiros

- `src/lib/logistics-mock.ts` — dados do Excel + funções de cálculo
- `src/app/admin/peregrinacoes/[id]/logistica/page.tsx` — shell e separadores
- `src/app/admin/peregrinacoes/[id]/logistica/components/` — um ficheiro por separador
