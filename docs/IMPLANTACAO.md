# Implantação Firebase

## Estado atual

Projeto: controle-de-pneus-cmc. Empresa: operacao-principal. Técnico: filho.cleider@gmail.com, conta Firebase existente. Login por e-mail/senha e sessões anônimas habilitados. Não colocar senhas ou credenciais administrativas no frontend.

Functions implantadas na região southamerica-east1, codebase rotafrota: rotafrotaDriverSession, rotafrotaSaveTrip, rotafrotaSaveVehicle. Gravações validam autoria, papel, empresa, hodômetros, evidências, versão e exclusividade de viagem ativa. Auditoria é gravada na mesma transação. Fotos não podem ser sobrescritas pelo cliente.

Firestore usa rotafrota_companies/{empresa}/trips, drivers, vehicles e locks; membros técnicos em rotafrota_members/{uid}. Storage usa rotafrota/{empresa}/{uid}/{arquivo}. Regras de consulta impedem motorista de listar a frota, mesmo conhecendo a URL administrativa.

## Reimplantar

```sh
npm ci
npm --prefix functions ci
npm --prefix functions run build
firebase deploy --only firestore:rules,storage,functions:rotafrota
```

Se a descoberta das Functions exceder o tempo, definir FUNCTIONS_DISCOVERY_TIMEOUT=60 no terminal. Não implantar regras genéricas públicas sobre os espaços RotaFrota. Backups locais das regras anteriores ficam em .firebase-backup, ignorado pelo Git.

Regras do Storage consultam o Firestore. A conta de serviço service-947294126166@gcp-sa-firebasestorage.iam.gserviceaccount.com precisa de roles/firebaserules.firestoreServiceAgent. Referência: https://firebase.google.com/docs/rules/manage-deploy . CORS do bucket está em firebase/cors.json; adicionar o domínio definitivo antes da publicação e aplicar com gcloud storage buckets update gs://controle-de-pneus-cmc.firebasestorage.app --cors-file=firebase/cors.json.

## Hospedagem

Executar npm run build e publicar dist em hospedagem HTTPS. Rotas usam hash, permitindo hospedagem estática. Registrar o domínio no Firebase Auth e no CORS. Não publicar .env locais, .firebase-backup, .runtime, tokens ou credenciais administrativas.

O workflow GitHub Pages publica demonstração com dados fictícios. A hospedagem comercial definitiva ainda precisa ser definida. Não há repositório remoto conectado nesta entrega.

## Novas empresas e técnicos

Criar documentos de empresa e membros por canal administrativo confiável, nunca pelo navegador do motorista. Cada membro técnico tem tenantId, role=technician e active=true. Criar o usuário no Firebase Auth separadamente. Para outra empresa, configurar VITE_COMPANY_ID e preparar o fluxo de distribuição. Motoristas recebem somente o endereço inicial; técnicos recebem /#/admin.

Antes de uma operação comercial, incluir controle de adesão de dispositivos, App Check/limites contra abuso, monitoramento e rotinas testadas de restauração. O projeto já utiliza faturamento habilitado; armazenamento, funções e leituras podem gerar cobranças conforme uso.
