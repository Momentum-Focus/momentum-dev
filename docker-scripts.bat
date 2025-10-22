@echo off
REM Script para gerenciar o ambiente Docker do projeto Momentum (Windows)

setlocal enabledelayedexpansion

REM Cores para output (limitadas no Windows)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

REM Função para imprimir mensagens coloridas
:print_message
echo %~2%~1%NC%
goto :eof

REM Função para verificar se Docker está rodando
:check_docker
docker info >nul 2>&1
if errorlevel 1 (
    call :print_message "❌ Docker não está rodando. Por favor, inicie o Docker Desktop." "%RED%"
    exit /b 1
)
goto :eof

REM Função para criar arquivo .env se não existir
:create_env_file
if not exist .env (
    call :print_message "📝 Criando arquivo .env a partir do env.example..." "%YELLOW%"
    copy env.example .env >nul
    call :print_message "✅ Arquivo .env criado! Lembre-se de ajustar as variáveis conforme necessário." "%GREEN%"
)
goto :eof

REM Função para construir e iniciar os containers
:start
call :print_message "🚀 Iniciando ambiente Docker do Momentum..." "%BLUE%"

call :check_docker
if errorlevel 1 exit /b 1

call :create_env_file

call :print_message "📦 Construindo e iniciando containers..." "%YELLOW%"
docker-compose up --build -d

call :print_message "⏳ Aguardando serviços ficarem prontos..." "%YELLOW%"
timeout /t 10 /nobreak >nul

call :print_message "🗄️ Executando migrações do Prisma..." "%YELLOW%"
docker-compose exec app npx prisma migrate deploy

call :print_message "🌱 Executando seed do banco de dados..." "%YELLOW%"
docker-compose exec app npm run seed

call :print_message "✅ Ambiente iniciado com sucesso!" "%GREEN%"
call :print_message "🌐 Aplicação disponível em: http://localhost:3000" "%GREEN%"
call :print_message "🗄️ PostgreSQL disponível em: localhost:5432" "%GREEN%"
call :print_message "🔴 Redis disponível em: localhost:6379" "%GREEN%"
goto :eof

REM Função para parar os containers
:stop
call :print_message "🛑 Parando containers..." "%YELLOW%"
docker-compose down
call :print_message "✅ Containers parados!" "%GREEN%"
goto :eof

REM Função para reiniciar os containers
:restart
call :print_message "🔄 Reiniciando containers..." "%YELLOW%"
docker-compose down
docker-compose up --build -d
call :print_message "✅ Containers reiniciados!" "%GREEN%"
goto :eof

REM Função para ver logs
:logs
if "%~1"=="" (
    docker-compose logs -f
) else (
    docker-compose logs -f %~1
)
goto :eof

REM Função para executar comandos no container da aplicação
:exec
docker-compose exec app %*
goto :eof

REM Função para resetar o banco de dados
:reset_db
call :print_message "🗑️ Resetando banco de dados..." "%YELLOW%"
docker-compose exec app npx prisma migrate reset --force
docker-compose exec app npm run seed
call :print_message "✅ Banco de dados resetado!" "%GREEN%"
goto :eof

REM Função para mostrar status dos containers
:status
call :print_message "📊 Status dos containers:" "%BLUE%"
docker-compose ps
goto :eof

REM Função para mostrar ajuda
:help
call :print_message "🐳 Script de Gerenciamento Docker - Momentum" "%BLUE%"
echo.
echo Comandos disponíveis:
echo   start     - Inicia todos os containers
echo   stop      - Para todos os containers
echo   restart   - Reinicia todos os containers
echo   logs      - Mostra logs de todos os containers
echo   logs [service] - Mostra logs de um serviço específico
echo   exec [cmd] - Executa comando no container da aplicação
echo   reset-db  - Reseta o banco de dados
echo   status    - Mostra status dos containers
echo   help      - Mostra esta ajuda
echo.
echo Exemplos:
echo   docker-scripts.bat start
echo   docker-scripts.bat logs app
echo   docker-scripts.bat exec npx prisma studio
goto :eof

REM Verificar argumentos
if "%1"=="" goto help
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="logs" goto logs
if "%1"=="exec" goto exec
if "%1"=="reset-db" goto reset_db
if "%1"=="status" goto status
if "%1"=="help" goto help
if "%1"=="--help" goto help
if "%1"=="-h" goto help

call :print_message "❌ Comando desconhecido: %1" "%RED%"
goto help
