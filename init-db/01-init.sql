-- Script de inicialização do banco de dados
-- Este arquivo é executado automaticamente quando o container PostgreSQL é criado

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Configurações de timezone
SET timezone = 'UTC';

-- Comentário de inicialização
DO $$
BEGIN
    RAISE NOTICE 'Banco de dados Momentum inicializado com sucesso!';
END $$;
