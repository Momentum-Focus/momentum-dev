import { memoryStorage } from 'multer';

/**
 * Configuração do Multer para uploads de arquivos
 * Limite de 50MB por arquivo
 */
export const multerConfig = {
  storage: memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
};
