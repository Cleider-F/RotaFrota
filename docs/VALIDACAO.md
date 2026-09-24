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
