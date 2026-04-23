import { db } from '@/db/client';
import { categories, habitLogs, habits, targets, users } from '@/db/schema';
import { hashPassword, verifyPassword } from '@/utils/hash';
import { eq } from 'drizzle-orm';
import { createContext, useCallback, useContext, useState } from 'react';

type User = { id: number; email: string };

type AuthContextValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  deleteProfile: () => Promise<{ error?: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();
    const rows = await db.select().from(users).where(eq(users.email, trimmed));
    if (rows.length === 0) return { error: 'No account found with that email.' };
    const row = rows[0];
    // Accept both hashed passwords and any legacy plaintext rows still in the DB.
    const valid = verifyPassword(password, row.passwordHash) || row.passwordHash === password;
    if (!valid) return { error: 'Incorrect password.' };
    setUser({ id: row.id, email: row.email });
    return {};
  }, []);

  // Handle user registration
  const register = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();
    // check for empty fields and password length
    if (!trimmed || !password) return { error: 'Email and password are required.' };
    if (password.length < 6) return { error: 'Password must be at least 6 characters.' };
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, trimmed));
    // Check for existing users
    if (existing.length > 0) return { error: 'An account with that email already exists.' };
    const today = new Date().toISOString().slice(0, 10);
    // Hash the password before storing it
    const [created] = await db
      .insert(users)
      .values({ email: trimmed, passwordHash: hashPassword(password), createdAt: today })
      .returning();
    setUser({ id: created.id, email: created.email });
    return {};
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const deleteProfile = useCallback(async () => {
    if (!user) return { error: 'Not logged in.' };
    // Delete all data owned by this user
    const userHabits = await db
      .select({ id: habits.id })
      .from(habits)
      .where(eq(habits.userId, user.id));
    const habitIds = userHabits.map((h) => h.id);
    // Delete all habit logs and targets for each habit
    for (const id of habitIds) {
      await db.delete(habitLogs).where(eq(habitLogs.habitId, id));
      await db.delete(targets).where(eq(targets.habitId, id));
    }
    await db.delete(habits).where(eq(habits.userId, user.id));
    await db.delete(categories).where(eq(categories.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
    setUser(null);
    return {};
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, deleteProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
