import * as crypto from 'crypto';

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// Aviso se a chave não estiver configurada (gera chave aleatória a cada restart)
if (!process.env.ENCRYPTION_KEY) {
  console.warn(
    '[EncryptionHelper] AVISO CRÍTICO: ENCRYPTION_KEY não está configurada no .env!',
  );
  console.warn(
    '[EncryptionHelper] Uma chave aleatória foi gerada, mas tokens criptografados anteriormente não poderão ser descriptografados.',
  );
  console.warn(
    '[EncryptionHelper] Configure ENCRYPTION_KEY no .env com uma string de 64 caracteres (32 bytes em hex).',
  );
}

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Criptografa um texto usando AES-256-CBC
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);

  // Se ENCRYPTION_KEY for hex (64 chars), converte para buffer de 32 bytes
  // Se for string normal, pega os primeiros 32 bytes
  let key: Buffer;
  if (ENCRYPTION_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(ENCRYPTION_KEY)) {
    // É uma string hex de 64 caracteres = 32 bytes
    key = Buffer.from(ENCRYPTION_KEY, 'hex');
  } else {
    // É uma string normal, pega os primeiros 32 bytes
    key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
  }

  if (key.length !== 32) {
    throw new Error(
      `Chave de criptografia deve ter 32 bytes, mas tem ${key.length}`,
    );
  }

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Descriptografa um texto criptografado usando AES-256-CBC
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || typeof encryptedText !== 'string') {
    throw new Error('Texto criptografado inválido');
  }

  const parts = encryptedText.split(':');

  if (parts.length < 2) {
    throw new Error(
      'Formato de texto criptografado inválido. Esperado: iv:encrypted',
    );
  }

  const ivHex = parts.shift();
  if (!ivHex) {
    throw new Error('IV não encontrado no texto criptografado');
  }

  let iv: Buffer;
  try {
    iv = Buffer.from(ivHex, 'hex');
    if (iv.length !== IV_LENGTH) {
      throw new Error(`IV deve ter ${IV_LENGTH} bytes, mas tem ${iv.length}`);
    }
  } catch (error: any) {
    throw new Error(`Erro ao decodificar IV: ${error.message}`);
  }

  const encrypted = parts.join(':');
  if (!encrypted) {
    throw new Error('Texto criptografado vazio');
  }

  // Se ENCRYPTION_KEY for hex (64 chars), converte para buffer de 32 bytes
  // Se for string normal, pega os primeiros 32 bytes
  let key: Buffer;
  if (ENCRYPTION_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(ENCRYPTION_KEY)) {
    // É uma string hex de 64 caracteres = 32 bytes
    key = Buffer.from(ENCRYPTION_KEY, 'hex');
  } else {
    // É uma string normal, pega os primeiros 32 bytes
    key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
  }

  if (key.length !== 32) {
    throw new Error(
      `Chave de criptografia deve ter 32 bytes, mas tem ${key.length}`,
    );
  }

  let decipher: crypto.Decipher;
  try {
    decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  } catch (error: any) {
    throw new Error(`Erro ao criar decipher: ${error.message}`);
  }

  let decrypted: string;
  try {
    decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
  } catch (error: any) {
    throw new Error(
      `Erro ao descriptografar texto: ${error.message}. O token pode ter sido criptografado com uma chave diferente.`,
    );
  }

  return decrypted;
}
