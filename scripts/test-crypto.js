const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

console.log('--------------------------------------------------');
console.log('StackOrbitAI Security Module Verification Script');
console.log('--------------------------------------------------');

// Generate a random key
const testKey = crypto.randomBytes(KEY_LENGTH);
const secretText = 'WP_APP_PASSWORD_12345_SECURE';

console.log(`Original Text:   "${secretText}"`);

// 1. Encryption
const iv = crypto.randomBytes(IV_LENGTH);
const cipher = crypto.createCipheriv(ALGORITHM, testKey, iv);
let encrypted = cipher.update(secretText, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag().toString('hex');
const dbPayload = `${iv.toString('hex')}:${authTag}:${encrypted}`;

console.log(`Encrypted State: "${dbPayload}"`);

// 2. Decryption
const parts = dbPayload.split(':');
const decIv = Buffer.from(parts[0], 'hex');
const decAuthTag = Buffer.from(parts[1], 'hex');
const ciphertext = parts[2];

const decipher = crypto.createDecipheriv(ALGORITHM, testKey, decIv);
decipher.setAuthTag(decAuthTag);
let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
decrypted += decipher.final('utf8');

console.log(`Decrypted Text:  "${decrypted}"`);
console.log('--------------------------------------------------');
if (secretText === decrypted) {
  console.log('SUCCESS: Encryption and Decryption verified matching!');
} else {
  console.error('FAIL: Decrypted string does not match original!');
}
console.log('--------------------------------------------------');
