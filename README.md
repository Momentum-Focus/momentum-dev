# 🚀 Momentum API

> API RESTful para a plataforma SaaS de produtividade e bem-estar mental "Momentum" - Zen-Tech

[![NestJS](https://img.shields.io/badge/NestJS-11.0.1-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.16.2-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

## 📋 Sobre

A **Momentum API** é uma API RESTful robusta construída com **NestJS**, fornecendo endpoints para gerenciamento de usuários, autenticação, tarefas, projetos, timer Pomodoro, integração com serviços de música (Spotify/YouTube Music), planos de assinatura e relatórios de produtividade.

### Arquitetura

A aplicação segue a arquitetura modular do NestJS, organizada em módulos especializados:

- **Auth Module**: Autenticação JWT, OAuth (Google, Spotify)
- **User Module**: Gerenciamento de usuários e perfis
- **Tasks Module**: CRUD de tarefas com tags e prioridades
- **Project Module**: Gerenciamento de projetos
- **Media Module**: Upload de mídias, integração Spotify/YouTube Music
- **Timer Module**: Sessões de estudo e Pomodoro
- **Plan Module**: Planos de assinatura (Vibes, Flow, Epic)
- **Report Module**: Relatórios de produtividade e feedback
- **Tags Module**: Sistema de tags para organização
- **Comments Module**: Comentários em tarefas e projetos
- **Achievements Module**: Sistema de conquistas
- **Notification Module**: Notificações do sistema
- **Settings Module**: Configurações de foco e personalização

## 🛠️ Tech Stack

### Core

- **[NestJS](https://nestjs.com/)** `^11.0.1` - Framework Node.js progressivo
- **[TypeScript](https://www.typescriptlang.org/)** `^5.7.3` - Superset JavaScript com tipagem estática
- **[Prisma](https://www.prisma.io/)** `^6.16.2` - ORM moderno para TypeScript
- **[PostgreSQL](https://www.postgresql.org/)** - Banco de dados relacional

### Autenticação & Segurança

- **[Passport](https://www.passportjs.org/)** `^0.7.0` - Middleware de autenticação
- **[JWT](https://jwt.io/)** `^9.0.2` - Tokens de autenticação
- **[bcrypt](https://www.npmjs.com/package/bcrypt)** `^6.0.0` - Hash de senhas
- **[passport-google-oauth20](https://www.npmjs.com/package/passport-google-oauth20)** `^2.0.0` - OAuth Google
- **[passport-spotify](https://www.npmjs.com/package/passport-spotify)** `^2.0.0` - OAuth Spotify

### Integrações

- **[Supabase](https://supabase.com/)** `^2.86.0` - Storage de arquivos e mídias
- **[Axios](https://axios-http.com/)** `^1.13.2` - Cliente HTTP

### Validação & Transformação

- **[class-validator](https://github.com/typestack/class-validator)** `^0.14.2` - Validação de DTOs
- **[class-transformer](https://github.com/typestack/class-transformer)** `^0.5.1` - Transformação de objetos

### Utilitários

- **[date-fns](https://date-fns.org/)** `^2.30.0` - Manipulação de datas
- **[rxjs](https://rxjs.dev/)** `^7.8.1` - Programação reativa

## 📦 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** `>= 20.x` ([Download](https://nodejs.org/))
- **npm** ou **yarn** (gerenciador de pacotes)
- **Docker** e **Docker Compose** (opcional, para desenvolvimento com containers)
- **PostgreSQL** `>= 14` (ou acesso a um banco PostgreSQL remoto)
- Conta no **Supabase** (para storage de mídias)
- Conta no **Google Cloud Console** (para OAuth Google)
- Conta no **Spotify Developer** (para integração Spotify)

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone <repository-url>
cd momentum-dev
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# ============================================
# Configurações do Servidor
# ============================================
NODE_ENV=development
PORT=3000

# ============================================
# Banco de Dados (PostgreSQL)
# ============================================
DATABASE_URL=postgresql://usuario:senha@localhost:5432/momentum?schema=public
DIRECT_URL=postgresql://usuario:senha@localhost:5432/momentum?schema=public

# ============================================
# Autenticação JWT
# ============================================
JWT_SECRET=sua_chave_secreta_jwt_aqui

# ============================================
# CORS & Frontend
# ============================================
FRONTEND_URL=http://localhost:8080
FRONTEND_URL_PROD=https://seu-dominio-producao.com
CORS_ORIGIN=http://localhost:8080

# ============================================
# Google OAuth (Login e YouTube Music)
# ============================================
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_YOUTUBE_REDIRECT_URI=http://localhost:3000/media/google-youtube/callback

# ============================================
# Spotify OAuth
# ============================================
SPOTIFY_CLIENT_ID=seu_spotify_client_id
SPOTIFY_CLIENT_SECRET=seu_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/media/spotify/callback
SPOTIFY_REDIRECT_URI_PROD=https://seu-dominio-api.com/media/spotify/callback

# ============================================
# Supabase (Storage de Mídias)
# ============================================
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua_chave_anon_do_supabase

# ============================================
# Criptografia (Tokens OAuth)
# ============================================
ENCRYPTION_KEY=sua_chave_de_criptografia_32_caracteres
```

> ⚠️ **Importante**: Nunca commite o arquivo `.env` no repositório. Ele contém informações sensíveis.

### 4. Configure o banco de dados

#### Opção A: Usando Docker Compose (Recomendado para desenvolvimento)

```bash
# Inicie o PostgreSQL em um container Docker
docker-compose up -d
```

#### Opção B: PostgreSQL local

Certifique-se de que o PostgreSQL está rodando e crie um banco de dados:

```sql
CREATE DATABASE momentum;
```

### 5. Execute as migrations do Prisma

```bash
# Gerar o Prisma Client
npx prisma generate

# Executar migrations
npx prisma migrate dev
```

### 6. Popule o banco com dados iniciais (Seed)

```bash
npm run seed
```

Este comando irá:

- Criar roles padrão (Admin, User)
- Criar planos de assinatura (Vibes, Flow, Epic)
- Criar features e relacioná-las aos planos
- Criar achievements iniciais

## 🏃 Rodando a Aplicação

### Modo Desenvolvimento

```bash
npm run start:dev
```

A aplicação estará disponível em `http://localhost:3000`

### Modo Debug

```bash
npm run start:debug
```

O debugger estará disponível na porta `9229`

### Modo Produção

```bash
# Build da aplicação
npm run build

# Iniciar em produção
npm run start:prod
```

### Usando Docker

#### Desenvolvimento com Docker Compose

```bash
# Build e iniciar containers
docker-compose up --build

# Rodar em background
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Parar containers
docker-compose down
```

#### Produção com Docker

```bash
# Build da imagem de produção
docker build --target production -t momentum-api:latest .

# Executar container
docker run -p 3000:3000 --env-file .env momentum-api:latest
```

## 📊 Banco de Dados

### Estrutura Principal

O banco de dados utiliza **Prisma ORM** com PostgreSQL. Os principais modelos incluem:

- **User**: Usuários do sistema
- **Task**: Tarefas com prioridades e tags
- **Project**: Projetos agrupando tarefas
- **StudySession**: Sessões de foco Pomodoro
- **DailyLog**: Logs diários de produtividade
- **Plan**: Planos de assinatura
- **Subscription**: Assinaturas dos usuários
- **Media**: Mídias (imagens/vídeos) de background
- **Tag**: Tags para organização
- **Comment**: Comentários em tarefas/projetos
- **Achievement**: Conquistas do sistema
- **Notification**: Notificações

### Comandos Úteis do Prisma

```bash
# Visualizar banco no Prisma Studio
npx prisma studio

# Criar nova migration
npx prisma migrate dev --name nome_da_migration

# Aplicar migrations em produção
npx prisma migrate deploy

# Resetar banco (CUIDADO: apaga todos os dados)
npx prisma migrate reset

# Gerar Prisma Client após mudanças no schema
npx prisma generate
```

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes em modo watch
npm run test:watch

# Testes com cobertura
npm run test:cov

# Testes E2E
npm run test:e2e
```

## 📝 Scripts Disponíveis

| Script                | Descrição                                     |
| --------------------- | --------------------------------------------- |
| `npm run start`       | Inicia a aplicação em modo produção           |
| `npm run start:dev`   | Inicia em modo desenvolvimento com hot-reload |
| `npm run start:debug` | Inicia com debugger habilitado                |
| `npm run start:prod`  | Inicia aplicação compilada                    |
| `npm run build`       | Compila TypeScript para JavaScript            |
| `npm run format`      | Formata código com Prettier                   |
| `npm run lint`        | Executa ESLint                                |
| `npm run test`        | Executa testes unitários                      |
| `npm run seed`        | Popula banco com dados iniciais               |
| `npx prisma studio`   | Abre interface visual do banco                |

## 🔒 Segurança

- **JWT Tokens**: Autenticação stateless com tokens JWT
- **bcrypt**: Hash de senhas com salt rounds
- **CORS**: Configuração restritiva de origens permitidas
- **Validação**: DTOs validados com `class-validator`
- **Encryption**: Tokens OAuth criptografados antes de armazenar
- **Guards**: Proteção de rotas com guards NestJS

## 📡 Endpoints Principais

### Autenticação

- `POST /auth/register` - Registro de usuário
- `POST /auth/login` - Login com email/senha
- `GET /auth/google` - Iniciar OAuth Google
- `GET /auth/google/callback` - Callback OAuth Google

### Usuários

- `GET /user/profile` - Obter perfil do usuário
- `PUT /user/profile` - Atualizar perfil

### Tarefas

- `GET /tasks` - Listar tarefas
- `POST /tasks` - Criar tarefa
- `PUT /tasks/:id` - Atualizar tarefa
- `DELETE /tasks/:id` - Deletar tarefa

### Projetos

- `GET /project` - Listar projetos
- `POST /project` - Criar projeto
- `PUT /project/:id` - Atualizar projeto

### Timer

- `POST /study-sessions` - Iniciar sessão de estudo
- `PUT /study-sessions/:id` - Finalizar sessão

### Mídia

- `POST /media/upload` - Upload de imagem/vídeo
- `GET /media/spotify` - Iniciar OAuth Spotify
- `GET /media/spotify/callback` - Callback Spotify
- `GET /media/google-youtube` - Iniciar OAuth YouTube Music

> 📚 Para documentação completa da API, consulte a coleção do Postman ou a documentação Swagger (se configurada).

## 🐳 Docker Compose

O arquivo `docker-compose.yml` inclui:

- **PostgreSQL**: Banco de dados na porta `5432`
- **App**: Aplicação NestJS com hot-reload

Para desenvolvimento local:

```bash
docker-compose up -d
```

## 🏗️ Estrutura do Projeto

```
momentum-dev/
├── src/
│   ├── auth/              # Módulo de autenticação
│   ├── user/              # Módulo de usuários
│   ├── tasks/             # Módulo de tarefas
│   ├── project/           # Módulo de projetos
│   ├── media/             # Módulo de mídias e OAuth
│   ├── timer/             # Módulo de timer
│   ├── plan/              # Módulo de planos
│   ├── report/            # Módulo de relatórios
│   ├── tags/              # Módulo de tags
│   ├── comments/          # Módulo de comentários
│   ├── achievements/      # Módulo de conquistas
│   ├── notification/     # Módulo de notificações
│   ├── settings-focus/    # Configurações de foco
│   ├── study-sessions/    # Sessões de estudo
│   ├── daily-logs/        # Logs diários
│   ├── logs/              # Logs de atividade
│   ├── role/              # Sistema de roles
│   ├── user-role/         # Relação usuário-role
│   ├── support/           # Suporte
│   ├── prisma/            # Serviço Prisma
│   ├── common/            # Filtros e utilitários
│   ├── app.module.ts      # Módulo raiz
│   └── main.ts            # Bootstrap da aplicação
├── prisma/
│   ├── schema.prisma      # Schema do banco
│   ├── migrations/        # Migrations
│   └── seed.ts            # Seed do banco
├── uploads/               # Uploads locais (dev)
├── docker-compose.yml     # Docker Compose para dev
├── Dockerfile             # Dockerfile multi-stage
└── package.json
```

## 🔧 Troubleshooting

### Erro: "GOOGLE_CLIENT_ID não encontrado"

Certifique-se de que todas as variáveis de ambiente do Google OAuth estão configuradas no `.env`.

### Erro: "DATABASE_URL não configurada"

Verifique se a string de conexão do PostgreSQL está correta no `.env`.

### Erro: "Prisma Client não gerado"

Execute:

```bash
npx prisma generate
```

### Erro de CORS

Verifique se `FRONTEND_URL` no `.env` corresponde à URL do frontend.

## 📄 Licença

Este projeto é privado e proprietário.

## 👥 Contribuindo

Este é um projeto interno. Para contribuições, entre em contato com a equipe de desenvolvimento.

---

**Desenvolvido com ❤️ para a plataforma Momentum**
