# RotaFrota

Aplicativo independente de viagens e abastecimentos. Marca provisória, sem vínculo com a Suzano.

## Acessos separados

- `/`: motorista, sem indicadores ou navegação administrativa. Nome, placa, número da nota e km inicial com foto; abastecimentos com km/foto e litros/foto; encerramento com km final/foto. Botões grandes e instruções em cada campo.
- `/#/admin`: técnico, com e-mail/senha Firebase, viagens em tempo real, filtros, relatórios CSV, fotos privadas e correções auditadas.

O acesso técnico da operação principal foi vinculado a **filho.cleider@gmail.com**, usando a conta já existente. A senha não foi alterada. A tela oferece recuperação de senha iniciada pelo próprio usuário.

## Executar

Requer Node 22.12+.

```sh
npm ci
npm run dev
```

Abra http://localhost:5173. O padrão conecta ao Firebase real. Demonstração apenas com `VITE_DEMO_MODE=true` ou `npm run build:demo`; credenciais fictícias aparecem na tela demo.

```sh
npm test
npm run build
npm run preview -- --port 4173
```

Preview: http://localhost:4173. Para o Live Server do VS Code, execute **npm run build** antes de Go Live. `.vscode/settings.json` aponta para `/dist`. Live Server não transforma TypeScript/TSX: abrir o `index.html` da raiz diretamente não funciona. Se um service worker antigo ainda interferir, abra DevTools > Application > Service Workers > Unregister na origem da porta 5500 e recarregue. Não é necessário apagar dados do aplicativo. Também existe `/recuperar-preview.html` para remover somente o registro do worker dessa origem. Durante desenvolvimento, prefira a porta 5173.

## Firebase

Projeto `controle-de-pneus-cmc`, Firestore, Storage privado, Auth e Functions em `southamerica-east1`. Backend e regras já implantados. As chaves web são identificadores públicos; permissões são verificadas no servidor. Dados do aplicativo ficam nos espaços `rotafrota_companies`, `rotafrota_members` e `rotafrota/` no Storage.

As regras anteriores do projeto eram públicas. A proteção foi aplicada aos espaços RotaFrota; o acesso legado fora deles foi preservado para não interromper outro sistema. Isto não significa que o projeto legado inteiro esteja protegido.

Veja [implantação](docs/IMPLANTACAO.md), [validação](docs/VALIDACAO.md) e [evolução](docs/PRODUTO.md).

## Indicadores e limites

Durante uma viagem, o motorista pode usar **Cancelar viagem**, informar um motivo e confirmar. O cancelamento preserva fotos e abastecimentos, libera motorista/placa para uma nova viagem e aparece com data e motivo no painel técnico. Não é possível retomar uma viagem cancelada. O BI identifica canceladas separadamente; seus litros e distância conhecida permanecem nos totais, mas não entram no rendimento km/L. O CSV operacional de nove colunas exclui canceladas.

Km/L estimado = distância de viagens concluídas dividida pelos litros abastecidos nessas viagens. A média é ponderada. Sem medição do combustível inicial/final, esse valor não comprova consumo real. Viagens abertas não entram nesse indicador.

O motorista usa uma sessão anônima persistente no navegador. Limpar dados/trocar aparelho perde a associação local; o técnico continua vendo os registros. Há uma viagem ativa por sessão e placa. O nome digitado não autentica identidade pessoal. Cadastro público de sessões exige controles adicionais contra abuso antes de comercialização em escala.

Envios exigem internet; não há fila offline. Fotos são reduzidas a JPEG até 1.800 px, sem preservação do original. Uploads sem viagem confirmada podem deixar objetos sem referência; limpeza futura deve considerar também auditorias. Consultas ainda não são paginadas.

PWA com cache da interface e configuração Capacitor presentes. Aplicativos nativos não foram compilados/publicados. Não há cobrança, gestão comercial de contratos, backup automatizado ou publicação web de produção nesta entrega.
