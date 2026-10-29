import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT = 'kubepulse-vault-salt-v1';

function getOrInitializeMasterKey(): Buffer {
  let rawSecret = process.env.ENCRYPTION_SECRET;

  if (!rawSecret) {
    // Check if a local .env file exists with ENCRYPTION_SECRET
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/^ENCRYPTION_SECRET=(.+)$/m);
      if (match && match[1]) {
        rawSecret = match[1].trim();
      }
    }
  }

  if (!rawSecret) {
    // Generate a strong random 32-byte hex secret and persist it to local git-ignored .env
    rawSecret = crypto.randomBytes(32).toString('hex');
    const envPath = path.resolve(process.cwd(), '.env');
    try {
      const line = `\nENCRYPTION_SECRET=${rawSecret}\n`;
      fs.appendFileSync(envPath, line, 'utf-8');
    } catch {
      // Fallback to in-memory key if disk is read-only
    }
    process.env.ENCRYPTION_SECRET = rawSecret;
  }

  return crypto.scryptSync(rawSecret, SALT, 32);
}

export class CryptoVault {
  private key: Buffer;

  constructor() {
    this.key = getOrInitializeMasterKey();
  }

  /**
   * Encrypts sensitive plaintext (e.g., kubeconfig YAML or Bearer token) using AES-256-GCM.
   * Format: ivHex:authTagHex:cipherTextHex
   */
  public encrypt(plainText: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts an AES-256-GCM payload back to plaintext in memory only.
   */
  public decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted vault payload format');
    }
    const [ivHex, authTagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}

export const cryptoVault = new CryptoVault();

