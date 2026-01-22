import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const getKey = () => {
  const raw = env.CONFIG_ENCRYPTION_KEY || process.env.CONFIG_ENCRYPTION_KEY || '';
  if (!raw) {
    if (env.NODE_ENV === 'production') {
      throw new Error('CONFIG_ENCRYPTION_KEY não configurado');
    }
    logger.warn('CONFIG_ENCRYPTION_KEY não configurado; usando chave efêmera em dev');
    return crypto.createHash('sha256').update('dev-fallback-key').digest();
  }

  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  return crypto.createHash('sha256').update(raw).digest();
};

export const encryptJson = (value: unknown) => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const payload = Buffer.from(JSON.stringify(value), 'utf-8');
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

export const decryptJson = (value: string) => {
  const key = getKey();
  const [ivRaw, tagRaw, dataRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !dataRaw) {
    throw new Error('Payload criptografado inválido');
  }
  const iv = Buffer.from(ivRaw, 'base64');
  const tag = Buffer.from(tagRaw, 'base64');
  const data = Buffer.from(dataRaw, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8'));
};
