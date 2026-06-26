import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const KEY_LENGTH = 32; // 256 bits

let encryptionKey: Buffer | null = null;

// Securely retrieve or generate the application's unique encryption key
function getEncryptionKey(): Buffer {
  if (encryptionKey) {
    return encryptionKey;
  }

  let userDataPath: string;
  try {
    userDataPath = app.getPath('userData');
  } catch (error) {
    // Fallback for development/testing outside Electron package context
    userDataPath = path.resolve(__dirname, '../../');
  }

  const keyPath = path.join(userDataPath, '.security.key');

  if (fs.existsSync(keyPath)) {
    try {
      const keyHex = fs.readFileSync(keyPath, 'utf8').trim();
      encryptionKey = Buffer.from(keyHex, 'hex');
      if (encryptionKey.length === KEY_LENGTH) {
        return encryptionKey;
      }
    } catch (e) {
      console.error('[Security] Error reading encryption key file, regenerating...', e);
    }
  }

  // Generate a new cryptographically secure random key
  console.log('[Security] Generating new cryptographically secure key...');
  const newKey = crypto.randomBytes(KEY_LENGTH);
  try {
    fs.writeFileSync(keyPath, newKey.toString('hex'), 'utf8');
  } catch (e) {
    console.error('[Security] Failed to write key file to disk:', e);
  }
  
  encryptionKey = newKey;
  return encryptionKey;
}

/**
 * Encrypts a string using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error('[Security] Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts a string encrypted with AES-256-GCM.
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  
  try {
    const key = getEncryptionKey();
    const parts = cipherText.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[Security] Decryption failed:', error);
    throw new Error('Decryption failed');
  }
}
