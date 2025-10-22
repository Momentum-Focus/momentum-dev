#!/bin/bash

# Script para gerenciar o ambiente Docker do projeto Momentum

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_message() {
    echo -e "${2}${1}${NC}"
}

# Função para verificar se Docker está rodando
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_message "❌ Docker não está rodando. Por favor, inicie o Docker Desktop." $RED
        exit 1
    fi
}

# Função para criar arquivo .env se não existir
create_env_file() {
    if [ ! -f .env ]; then
        print_message "📝 Criando arquivo .env a partir do env.example..." $YELLOW
        cp env.example .env
        print_message "✅ Arquivo .env criado! Lembre-se de ajustar as variáveis conforme necessário." $GREEN
    fi
}

# Função para construir e iniciar os containers
start() {
    print_message "🚀 Iniciando ambiente Docker do Momentum..." $BLUE
    
    check_docker
    create_env_file
    
    print_message "📦 Construindo e iniciando containers..." $YELLOW
    docker-compose up --build -d
    
    print_message "⏳ Aguardando serviços ficarem prontos..." $YELLOW
    sleep 10
    
    print_message "🗄️ Executando migrações do Prisma..." $YELLOW
    docker-compose exec app npx prisma migrate deploy
    
    print_message "🌱 Executando seed do banco de dados..." $YELLOW
    docker-compose exec app npm run seed
    
    print_message "✅ Ambiente iniciado com sucesso!" $GREEN
    print_message "🌐 Aplicação disponível em: http://localhost:3000" $GREEN
    print_message "🗄️ PostgreSQL disponível em: localhost:5432" $GREEN
    print_message "🔴 Redis disponível em: localhost:6379" $GREEN
}

# Função para parar os containers
stop() {
    print_message "🛑 Parando containers..." $YELLOW
    docker-compose down
    print_message "✅ Containers parados!" $GREEN
}

# Função para reiniciar os containers
restart() {
    print_message "🔄 Reiniciando containers..." $YELLOW
    docker-compose down
    docker-compose up --build -d
    print_message "✅ Containers reiniciados!" $GREEN
}

# Função para ver logs
logs() {
    if [ -n "$1" ]; then
        docker-compose logs -f "$1"
    else
        docker-compose logs -f
    fi
}

# Função para executar comandos no container da aplicação
exec() {
    docker-compose exec app "$@"
}

# Função para resetar o banco de dados
reset_db() {
    print_message "🗑️ Resetando banco de dados..." $YELLOW
    docker-compose exec app npx prisma migrate reset --force
    docker-compose exec app npm run seed
    print_message "✅ Banco de dados resetado!" $GREEN
}

# Função para mostrar status dos containers
status() {
    print_message "📊 Status dos containers:" $BLUE
    docker-compose ps
}

# Função para mostrar ajuda
help() {
    print_message "🐳 Script de Gerenciamento Docker - Momentum" $BLUE
    echo ""
    echo "Comandos disponíveis:"
    echo "  start     - Inicia todos os containers"
    echo "  stop      - Para todos os containers"
    echo "  restart   - Reinicia todos os containers"
    echo "  logs      - Mostra logs de todos os containers"
    echo "  logs [service] - Mostra logs de um serviço específico"
    echo "  exec [cmd] - Executa comando no container da aplicação"
    echo "  reset-db  - Reseta o banco de dados"
    echo "  status    - Mostra status dos containers"
    echo "  help      - Mostra esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  ./docker-scripts.sh start"
    echo "  ./docker-scripts.sh logs app"
    echo "  ./docker-scripts.sh exec npx prisma studio"
}

# Verificar argumentos
case "${1:-help}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs "$2"
        ;;
    exec)
        shift
        exec "$@"
        ;;
    reset-db)
        reset_db
        ;;
    status)
        status
        ;;
    help|--help|-h)
        help
        ;;
    *)
        print_message "❌ Comando desconhecido: $1" $RED
        help
        exit 1
        ;;
esac
