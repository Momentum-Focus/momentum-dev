# 🐳 Estrutura Docker do Projeto Momentum

Este documento explica a estrutura Docker criada para o projeto Momentum, incluindo todos os arquivos e configurações necessárias para containerização.

## 📁 Arquivos Docker Criados

### 1. **Dockerfile**
Arquivo principal para construção da imagem da aplicação NestJS.

**Características:**
- **Multi-stage build** para otimização de tamanho
- **Base Alpine Linux** para menor footprint
- **Usuário não-root** para segurança
- **Otimização de cache** de dependências
- **Geração automática** do cliente Prisma

**Estágios:**
1. **Base**: Instalação de dependências de produção
2. **Builder**: Build completo da aplicação
3. **Production**: Imagem final otimizada

### 2. **docker-compose.yml**
Orquestração de todos os serviços necessários.

**Serviços incluídos:**
- **PostgreSQL 15**: Banco de dados principal
- **Redis 7**: Cache e sessões (opcional)
- **Aplicação NestJS**: API principal

**Recursos:**
- **Health checks** para todos os serviços
- **Volumes persistentes** para dados
- **Rede isolada** para comunicação
- **Dependências** entre serviços

### 3. **.dockerignore**
Otimização do contexto de build.

**Exclui:**
- `node_modules`
- Arquivos de build
- Logs e cache
- Arquivos de desenvolvimento
- Documentação

### 4. **env.example**
Template de variáveis de ambiente.

**Variáveis incluídas:**
- Configurações da aplicação
- Credenciais do banco de dados
- Configurações de autenticação
- Configurações de upload
- Configurações de CORS

### 5. **docker-scripts.sh**
Script de gerenciamento automatizado.

**Funcionalidades:**
- Inicialização completa do ambiente
- Execução de migrações
- Seed do banco de dados
- Gerenciamento de containers
- Logs e debugging

### 6. **init-db/01-init.sql**
Script de inicialização do PostgreSQL.

**Funcionalidades:**
- Criação de extensões
- Configurações de timezone
- Logs de inicialização

## 🏗️ Arquitetura Docker

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   App       │  │ PostgreSQL  │  │   Redis     │        │
│  │  (NestJS)   │  │   (Port 5432)│  │  (Port 6379)│        │
│  │ Port: 3000  │  │             │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Configurações Técnicas

### **PostgreSQL**
- **Versão**: 15-alpine
- **Porta**: 5432
- **Banco**: momentum_dev
- **Usuário**: momentum_user
- **Volume persistente**: postgres_data

### **Redis**
- **Versão**: 7-alpine
- **Porta**: 6379
- **Volume persistente**: redis_data

### **Aplicação**
- **Base**: Node.js 18-alpine
- **Porta**: 3000
- **Usuário**: nestjs (não-root)
- **Health check**: `/health`

## 🛡️ Segurança

### **Medidas Implementadas:**
- Usuário não-root no container
- Rede isolada para comunicação
- Variáveis de ambiente para credenciais
- Health checks para monitoramento
- Volumes nomeados para persistência

### **Boas Práticas:**
- Multi-stage build para otimização
- .dockerignore para contexto limpo
- Alpine Linux para menor superfície de ataque
- Dependências explícitas entre serviços

## 📊 Monitoramento

### **Health Checks:**
- **PostgreSQL**: `pg_isready`
- **Redis**: `redis-cli ping`
- **Aplicação**: `curl /health`

### **Logs:**
- Logs centralizados via docker-compose
- Rotação automática de logs
- Níveis de log configuráveis

## 🔄 Fluxo de Deploy

1. **Build**: Construção da imagem da aplicação
2. **Database**: Inicialização do PostgreSQL
3. **Migrations**: Execução das migrações Prisma
4. **Seed**: População inicial do banco
5. **Start**: Inicialização da aplicação

## 📈 Performance

### **Otimizações:**
- Cache de dependências npm
- Multi-stage build
- Imagem Alpine Linux
- Volumes otimizados
- Rede bridge para comunicação

### **Recursos:**
- CPU: Limitado por host
- Memória: Configurável via docker-compose
- Disco: Volumes persistentes
- Rede: Bridge isolada

## 🚀 Próximos Passos

### **Melhorias Sugeridas:**
- [ ] Configuração de SSL/TLS
- [ ] Load balancer (nginx)
- [ ] Monitoramento (Prometheus/Grafana)
- [ ] Backup automático do banco
- [ ] CI/CD pipeline
- [ ] Logs estruturados (ELK Stack)

### **Produção:**
- [ ] Variáveis de ambiente seguras
- [ ] Certificados SSL
- [ ] Backup strategy
- [ ] Monitoring e alerting
- [ ] Scaling horizontal

## 📚 Recursos Adicionais

- [Documentação Docker](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [NestJS Docker](https://docs.nestjs.com/recipes/docker)
- [Prisma Docker](https://www.prisma.io/docs/guides/deployment/docker)
- [PostgreSQL Docker](https://hub.docker.com/_/postgres)
