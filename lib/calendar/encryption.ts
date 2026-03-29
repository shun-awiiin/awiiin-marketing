/**
 * Simple AES-256-GCM encryption for OAuth tokens at rest.
 * Uses CALENDAR_ENCRYPTION_KEY env var (32-byte hex string).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.CALENDAR_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error(
      'CALENDAR_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
    )
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])

  const tag = cipher.getAuthTag()

  // Format: iv:tag:ciphertext (all base64)
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey()
  const parts = encoded.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const tag = Buffer.from(parts[1], 'base64')
  const ciphertext = Buffer.from(parts[2], 'base64')

  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Invalid IV or auth tag length')
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}
