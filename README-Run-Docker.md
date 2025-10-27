# 🚀 Como Rodar o Projeto Momentum com Docker

Este guia te ajudará a executar o projeto Momentum usando Docker de forma simples e rápida.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac)
- [Docker Engine](https://docs.docker.com/engine/install/) (Linux)
- [Docker Compose](https://docs.docker.com/compose/install/)

## 🚀 Início Rápido

### 1. **Clone o Repositório**
```bash
git clone <seu-repositorio>
cd momentum-dev
```

### 2. **Execute o Script Automatizado**
```bash
# No Linux/Mac
./docker-scripts.sh start

```

### 3. **Acesse a Aplicação**
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🛠️ Comandos Disponíveis

### **Script Automatizado**
```bash
# Iniciar tudo
./docker-scripts.sh start

# Parar tudo
./docker-scripts.sh stop

# Reiniciar
./docker-scripts.sh restart

# Ver logs
./docker-scripts.sh logs

# Ver logs de um serviço específico
./docker-scripts.sh logs app

# Executar comandos no container
./docker-scripts.sh exec npx prisma studio
./docker-scripts.sh exec npm run test

# Resetar banco de dados
./docker-scripts.sh reset-db

# Ver status dos containers
./docker-scripts.sh status

# Ajuda
./docker-scripts.sh help
```

### **Comandos Docker Compose Diretos**
```bash
# Iniciar todos os serviços
docker-compose up -d

# Construir e iniciar
docker-compose up --build -d

# Parar todos os serviços
docker-compose down

# Ver logs
docker-compose logs -f

# Executar comandos
docker-compose exec app npm run build
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npm run seed
```

## 🔧 Configuração Manual

### 1. **Configurar Variáveis de Ambiente**
```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar as variáveis conforme necessário
nano .env
```

### 2. **Iniciar Serviços**
```bash
# Iniciar banco de dados
docker-compose up postgres -d

# Aguardar banco ficar pronto
sleep 10

# Executar migrações
docker-compose exec app npx prisma migrate deploy

# Executar seed
docker-compose exec app npm run seed

# Iniciar aplicação
docker-compose up app -d
```

## 🗄️ Gerenciamento do Banco de Dados

### **Prisma Studio**
```bash
# Abrir Prisma Studio
docker-compose exec app npx prisma studio
# Acesse: http://localhost:5555
```

### **Migrações**
```bash
# Criar nova migração
docker-compose exec app npx prisma migrate dev --name nome_da_migracao

# Aplicar migrações
docker-compose exec app npx prisma migrate deploy

# Resetar banco
docker-compose exec app npx prisma migrate reset
```

### **Seed do Banco**
```bash
# Executar seed
docker-compose exec app npm run seed
```

## 🔍 Debugging e Logs

### **Ver Logs em Tempo Real**
```bash
# Todos os serviços
docker-compose logs -f

# Apenas aplicação
docker-compose logs -f app

# Apenas banco
docker-compose logs -f postgres
```

### **Acessar Container**
```bash
# Entrar no container da aplicação
docker-compose exec app sh

# Executar comandos específicos
docker-compose exec app npx prisma generate
docker-compose exec app npm run build
```

## 🧪 Testes

### **Executar Testes**
```bash
# Testes unitários
docker-compose exec app npm run test

# Testes e2e
docker-compose exec app npm run test:e2e

# Testes com coverage
docker-compose exec app npm run test:cov
```

## 🚨 Solução de Problemas

### **Problemas Comuns**

#### **1. Porta já em uso**
```bash
# Verificar processos usando a porta
netstat -tulpn | grep :3000

# Parar containers conflitantes
docker-compose down
```

#### **2. Banco de dados não conecta**
```bash
# Verificar se PostgreSQL está rodando
docker-compose ps postgres

# Ver logs do banco
docker-compose logs postgres

# Reiniciar apenas o banco
docker-compose restart postgres
```

#### **3. Erro de permissão**
```bash
# Dar permissão ao script (Linux/Mac)
chmod +x docker-scripts.sh
```

#### **4. Containers não iniciam**
```bash
# Limpar tudo e recomeçar
docker-compose down -v
docker system prune -f
./docker-scripts.sh start
```

### **Comandos de Diagnóstico**
```bash
# Status dos containers
docker-compose ps

# Uso de recursos
docker stats

# Informações da rede
docker network ls
docker network inspect momentum-dev_momentum-network

# Volumes
docker volume ls
```

## 🔄 Atualizações

### **Atualizar Código**
```bash
# Parar containers
docker-compose down

# Fazer pull das mudanças
git pull

# Reconstruir e iniciar
docker-compose up --build -d
```

### **Atualizar Dependências**
```bash
# Reconstruir com novas dependências
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Monitoramento

### **Health Checks**
- **Aplicação**: http://localhost:3000/health
- **PostgreSQL**: `docker-compose exec postgres pg_isready`
- **Redis**: `docker-compose exec redis redis-cli ping`

### **Métricas**
```bash
# Uso de CPU e memória
docker stats

# Logs de sistema
docker system df
```

## 🛑 Parar e Limpar

### **Parar Serviços**
```bash
# Parar containers
docker-compose down

# Parar e remover volumes
docker-compose down -v
```

### **Limpeza Completa**
```bash
# Remover containers, redes e volumes
docker-compose down -v --remove-orphans

# Limpar sistema Docker
docker system prune -f

# Limpar imagens não utilizadas
docker image prune -f
```

## 📚 Comandos Úteis

### **Desenvolvimento**
```bash
# Rebuild apenas a aplicação
docker-compose build app
docker-compose up app -d

# Ver logs da aplicação
docker-compose logs -f app

# Executar comandos npm
docker-compose exec app npm install
docker-compose exec app npm run build
```

### **Banco de Dados**
```bash
# Backup do banco
docker-compose exec postgres pg_dump -U momentum_user momentum_dev > backup.sql

# Restaurar backup
docker-compose exec -T postgres psql -U momentum_user momentum_dev < backup.sql
```

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique os logs**: `docker-compose logs -f`
2. **Verifique o status**: `docker-compose ps`
3. **Reinicie os serviços**: `docker-compose restart`
4. **Limpe e recomece**: `docker-compose down -v && ./docker-scripts.sh start`

## 🎉 Pronto!

Agora você tem o projeto Momentum rodando completamente containerizado! 

- ✅ API funcionando em http://localhost:3000
- ✅ Banco PostgreSQL configurado
- ✅ Redis para cache
- ✅ Migrações aplicadas
- ✅ Dados iniciais carregados
