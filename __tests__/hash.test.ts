import { hashPassword, verifyPassword } from '../utils/hash';

describe('hashPassword / verifyPassword', () => {
  it('hashes a password consistently and verifies the match', () => {
    const hash = hashPassword('secret123');

    expect(hash).toBe(hashPassword('secret123'));
    expect(verifyPassword('secret123', hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });
});
