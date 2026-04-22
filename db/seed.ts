import { db } from './client';
import { categories, habitLogs, habits, targets, users } from './schema';

export async function seedIfEmpty() {
  const existingUsers = await db.select().from(users);

  if (existingUsers.length > 0) return;

  // User
  const [user] = await db
    .insert(users)
    .values({ email: 'demo@habits.app', passwordHash: 'demo', createdAt: '2026-03-01' })
    .returning();

  // Categories matching the 75 Hard challenge UI
  const cats = await db
    .insert(categories)
    .values([
      { userId: user.id, name: 'Exercise',    colour: '#3A7D5A', icon: '🏃' },
      { userId: user.id, name: 'Hydration',   colour: '#2E6E8E', icon: '💧' },
      { userId: user.id, name: 'Nutrition',   colour: '#B07D3A', icon: '🥗' },
      { userId: user.id, name: 'Mindfulness', colour: '#6B5B8A', icon: '📖' },
    ])
    .returning();

  const [exercise, hydration, nutrition, mindfulness] = cats;

  // 75 Hard habits
  const insertedHabits = await db
    .insert(habits)
    .values([
      { userId: user.id, categoryId: exercise.id,    name: 'Workout 1 (45 min)',          type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: exercise.id,    name: 'Workout 2 — Outdoor (45 min)', type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: hydration.id,   name: 'Drink 1 Gallon of Water',      type: 'count',   createdAt: '2026-03-01' },
      { userId: user.id, categoryId: nutrition.id,   name: 'Follow Diet Plan',             type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: nutrition.id,   name: 'No Alcohol or Cheat Meals',    type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: mindfulness.id, name: 'Read 10 Pages of Nonfiction',  type: 'boolean', createdAt: '2026-03-01' },
    ])
    .returning();

  const [workout1, workout2, water, diet, noAlcohol, reading] = insertedHabits;

  // Weekly targets (daily habits = goal of 7 per week; water = 7 gallons/week)
  await db.insert(targets).values([
    { habitId: workout1.id,  period: 'weekly', goalCount: 7 },
    { habitId: workout2.id,  period: 'weekly', goalCount: 7 },
    { habitId: water.id,     period: 'weekly', goalCount: 7 },
    { habitId: diet.id,      period: 'weekly', goalCount: 7 },
    { habitId: noAlcohol.id, period: 'weekly', goalCount: 7 },
    { habitId: reading.id,   period: 'weekly', goalCount: 7 },
  ]);

  // 51 days of historical logs (2026-03-01 to 2026-04-20)
  // Adherence improves over time to show realistic progress in charts
  const logs: { habitId: number; date: string; completed: number; count: number }[] = [];
  const startDate = new Date('2026-03-01');

  for (let i = 0; i < 51; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const progress = i / 50; // 0 → 1 over the 51 days

    // Boolean habits — adherence climbs from ~65% to ~90%
    const boolRate = 0.65 + progress * 0.25;

    if (Math.random() < boolRate)
      logs.push({ habitId: workout1.id, date, completed: 1, count: 0 });

    if (Math.random() < boolRate - 0.05)
      logs.push({ habitId: workout2.id, date, completed: 1, count: 0 });

    if (Math.random() < boolRate + 0.05)
      logs.push({ habitId: diet.id, date, completed: 1, count: 0 });

    if (Math.random() < boolRate + 0.08)
      logs.push({ habitId: noAlcohol.id, date, completed: 1, count: 0 });

    if (Math.random() < boolRate)
      logs.push({ habitId: reading.id, date, completed: 1, count: 0 });

    // Water — count of glasses (target = 16 glasses = 1 gallon)
    const glasses = Math.min(Math.floor(8 + Math.random() * 10 + progress * 4), 20);
    logs.push({ habitId: water.id, date, completed: glasses >= 16 ? 1 : 0, count: glasses });
  }

  await db.insert(habitLogs).values(logs);
}
