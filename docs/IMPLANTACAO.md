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


## Autorizações e cadastro de contas

Admin > Técnicos e acessos: autorizar nome, e-mail e perfil Administrador ou Apenas técnico. Autorizar não cria conta no Firebase Auth e não envia e-mail. A lista mostra Aguardando cadastro ou Conta cadastrada. É possível alterar o perfil e ativar/desativar outros acessos; ninguém pode alterar o próprio acesso, preservando um administrador ativo. Todas as alterações são transacionais e auditadas.

Na tela de login, Criar conta recebe e-mail, senha (10–128 caracteres) e confirmação. rotafrotaRegisterAccount verifica a autorização ativa antes de criar a conta. O cliente envia a confirmação de e-mail pelo Firebase. O primeiro login chama rotafrotaActivateAccount: só um e-mail confirmado, ainda autorizado e vinculado à empresa correta ganha o documento de membro e as permissões correspondentes. O cadastro não aceita o perfil escolhido pelo usuário. Senhas nunca são registradas em documentos ou logs pela aplicação. Contas já existentes usam Entrar ou Esqueci minha senha; nunca redefinimos sua senha ao autorizar.

Contas administrativas provisionadas anteriormente permanecem válidas sem migração de senha. As autorizações novas ficam em rotafrota_companies/{empresa}/accessEmails/{sha256(emailNormalizado)}, inacessíveis diretamente aos clientes. Gestão por rotafrotaManageTechnicians, exigindo membro ativo com canManageTechnicians=true. Perfil Apenas técnico tem canManageTechnicians=false. A empresa vem da sessão do gestor, não do formulário.

A confirmação enviada pelo cadastro só prova posse do e-mail; o acesso é liberado no login seguinte, após nova verificação da autorização. Desativar preserva conta Firebase, viagens e auditoria, bloqueando acesso futuro ao RotaFrota. Não remove arquivos já baixados ou dados já carregados. Lista limitada a 200 entradas com aviso. Novo cadastro está indisponível no modo demo.

Backend: rotafrotaManageTechnicians, rotafrotaRegisterAccount, rotafrotaActivateAccount. Criar contas diretamente pela API pública do Firebase Auth não concede acesso à frota: documentos de membros só são criados pelas funções autorizadas. Controle adicional de abuso/App Check continua recomendado antes de escalar comercialmente.
