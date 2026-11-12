import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Chiffrement AES-256-GCM des jetons Garmin en base.
 * Clé : TOKEN_KEY (base64, 32 octets) sinon dérivée de SESSION_SECRET,
 * sur le même principe que le Fernet TOKEN_KEY de la version Flask.
 */
function key(): Buffer {
  const tokenKey = process.env.TOKEN_KEY;
  if (tokenKey) {
    const k = Buffer.from(tokenKey, 'base64');
    if (k.length === 32) return k;
  }
  const secret = process.env.SESSION_SECRET ?? 'dev-a-changer';
  return createHash('sha256').update(secret).digest();
}

export function enc(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('base64');
}

export function dec(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  if (raw.length < 29) {
    throw new Error('Jetons Garmin illisibles : reconnecte ton compte Garmin.');
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Jetons Garmin illisibles : reconnecte ton compte Garmin.');
  }
}
