// djb2-based hash — good enough for local SQLite demo auth
export function hashPassword(password: string): string {
  // Initialize hash to a large prime number
  let h = 5381;
  // Iterate over each character in the password
  for (let i = 0; i < password.length; i++) {
    h = (((h << 5) + h) ^ password.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Compare a plaintext password to a stored hash
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
