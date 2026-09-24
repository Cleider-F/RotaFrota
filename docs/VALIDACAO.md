# Validação

- Testes de domínio: hodômetros, litros, evidências e consumo.
- Testes de autorização: autoria imutável, papéis, encerramento e etapas anteriores.
- Sete testes de regras em emuladores Firestore/Storage: isolamento por empresa e motorista, acesso técnico, bloqueio de escrita direta, fotos privadas e bloqueio de sobrescrita. Passaram em 23/09/2026.
- Fluxo visual demo: iniciar viagem, abastecer com duas fotos, finalizar e acessar painel técnico protegido. Nenhuma navegação administrativa na tela do motorista.
- Backend publicado no projeto fornecido; integração real exercitada na empresa separada rotafrota-homologacao. Resultado local em .runtime/firebase-smoke-result.json quando concluído com sucesso.

```sh
npm test
npm run build
firebase emulators:exec --only firestore,storage --project demo-rotafrota "npm run test:rules"
```

Os testes de regras são ignorados no npm test quando emuladores não estão ativos. Requer Java 21 para emuladores atuais. Smoke remoto: node scripts/smoke-firebase.mjs, somente após provisionar explicitamente a empresa de homologação; cria registros fictícios identificados nessa empresa.

Senha real do técnico não foi usada nem alterada; a validação de login real deve ser feita pelo titular. Instalação PWA/câmera em celulares físicos e publicação nas lojas permanecem pendentes.

Atualização de autorizações: 23 testes unitários passaram. Teste remoto isolado em rotafrota-homologacao validou e-mail não listado recusado, autorização sem criar conta, bloqueio de e-mail não confirmado, ativação com perfil vindo da autorização (tentativa de autopromoção ignorada), promoção, bloqueio de alteração do próprio acesso e revogação. Contas e permissões fictícias do teste foram removidas; auditorias técnicas permanecem na empresa de homologação. Nenhum e-mail foi enviado pelo teste. A entrega do e-mail de confirmação em uma caixa real deve ser validada pelo titular.

## Exportação CSV

O relatório controle-km-combustivel.csv respeita os filtros do painel e inclui o título CONTROLE DE KM E COMBUSTIVEL seguido das colunas DATA, HORÁRIO, Nº DA NOTA, KM INICIAL, KM FINAL, ABASTECIMENTO EM L, KM DE ABASTECIMENTO, KM TOTAL e NOME DO MOTORISTA. Cada linha representa uma viagem. Data/hora correspondem à saída, no fuso America/Sao_Paulo; litros são somados e múltiplos hodômetros de abastecimento aparecem separados por | na mesma célula. Km final/total ficam vazios para viagens abertas. CSV usa ponto e vírgula, decimais com vírgula e UTF-8 com BOM para acentos no Excel; o formato não suporta estilos visuais.

Fluxo vigente atualizado: cadastro autorizado com senha mínima de 6 caracteres e entrada imediata, sem confirmação por e-mail. 27 testes unitários passaram. Teste remoto isolado confirmou criação com senha de 6 caracteres, ativação sem verificar e-mail, recusa de e-mail não autorizado, perfil definido pelo gestor, promoção e revogação de acesso. As contas temporárias foram removidas e nenhum e-mail foi enviado. Esta validação substitui a exigência de confirmação descrita no teste histórico anterior.

## BI da operação

Menu Operação > BI da operação, disponível para técnicos e administradores. Filtros por data inicial/final (dias inclusivos de Brasília), veículo, nome do motorista, situação e dia clicado. Data de referência: início da viagem; todos os abastecimentos da viagem selecionada entram nos totais, mesmo se enviados depois do intervalo. Distância inclui o último hodômetro conhecido de viagens abertas. Rendimento é ponderado, limitado às viagens concluídas com litros positivos, sem representar consumo aferido.

Gráficos clicáveis por veículo/motorista selecionam o recorte e levam ao resumo; barras diárias filtram viagens iniciadas naquele dia. Rankings mostram até dez itens, com seleção completa pelos filtros. Agrupamento de motoristas usa nome digitado normalizado, pois ID anônimo identifica aparelho, não pessoa: homônimos podem ser agrupados. Tabela abre detalhes/fotos/correções e exporta o CSV padrão apenas do recorte. Consulta usa os dados já autorizados do painel e acompanha atualizações recebidas; não cria acesso novo no Firebase.

Testes: agregação ponderada, viagens abertas, ausência de litros, filtros combinados e virada de data em Brasília. Verificação visual em demonstração: navegação do geral para veículo, motorista, abertura da viagem e largura de celular. Consultas ainda são carregadas no cliente; agregações no servidor ficam para frotas maiores.

## Cancelamento de viagens

Motorista confirma o cancelamento com motivo de 5 a 500 caracteres. O registro e suas evidências são preservados, com data e motivo disponíveis no painel técnico e na auditoria. A viagem não pode ser retomada. Canceladas têm filtro próprio no painel/BI; seus litros e distância conhecida continuam nos totais, mas são excluídas do rendimento e do CSV operacional de nove colunas.

Validação: 35 testes passaram, com sete testes de emuladores ignorados nesta execução; build de produção aprovado. Integração Firebase em rotafrota-homologacao confirmou cancelamento com abastecimento preservado, recusa de reabertura e nova viagem para o mesmo motorista/placa. Função rotafrotaSaveTrip atualizada. Fluxo visual demo confirmou desistência da confirmação e cancelamento retornando ao formulário de nova viagem.
