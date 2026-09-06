import * as Crypto from 'expo-crypto';

/** Short, collision-resistant id used for document and page filenames. */
export function createId(): string {
  return Crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
