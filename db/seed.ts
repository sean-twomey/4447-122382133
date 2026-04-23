import { hashPassword } from '@/utils/hash';
import { db } from './client';
import { categories, habitLogs, habits, targets, users } from './schema';

export async function seedIfEmpty() {
  const existingUsers = await db.select().from(users);

  if (existingUsers.length > 0) return;

  // User
  const [user] = await db
    .insert(users)
    .values({ email: 'demo@habits.app', passwordHash: hashPassword('demo'), createdAt: '2026-03-01' })
    .returning();

  // Categories matching the 75 Hard challenge UI
  const cats = await db
    .insert(categories)
    .values([
      { userId: user.id, name: 'Exercise', colour: '#3A7D5A', icon: '🏃' },
      { userId: user.id, name: 'Hydration', colour: '#2E6E8E', icon: '💧' },
      { userId: user.id, name: 'Nutrition', colour: '#B07D3A', icon: '🥗' },
      { userId: user.id, name: 'Mindfulness', colour: '#6B5B8A', icon: '📖' },
    ])
    .returning();

  const [exercise, hydration, nutrition, mindfulness] = cats;

  // 75 Hard habits
  const insertedHabits = await db
    .insert(habits)
    .values([
      { userId: user.id, categoryId: exercise.id, name: 'Workout 1 (45 min)', type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: exercise.id, name: 'Workout 2 — Outdoor (45 min)', type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: hydration.id, name: 'Drink 1 Gallon of Water', type: 'count', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: nutrition.id, name: 'Follow Diet Plan', type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: nutrition.id, name: 'No Alcohol or Cheat Meals', type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: mindfulness.id, name: 'Read 10 Pages of Nonfiction', type: 'boolean', createdAt: '2026-03-01' },
    ])
    .returning();

  const [workout1, workout2, water, diet, noAlcohol, reading] = insertedHabits;

  // Weekly targets (daily habits = goal of 7 per week; water = 7 gallons/week)
  await db.insert(targets).values([
    { habitId: workout1.id, period: 'weekly', goalCount: 7 },
    { habitId: workout2.id, period: 'weekly', goalCount: 7 },
    { habitId: water.id, period: 'weekly', goalCount: 7 },
    { habitId: diet.id, period: 'weekly', goalCount: 7 },
    { habitId: noAlcohol.id, period: 'weekly', goalCount: 7 },
    { habitId: reading.id, period: 'weekly', goalCount: 7 },
  ]);

  // 53 tracked days of historical logs 
  const logs: { habitId: number; date: string; completed: number; count: number }[] = [];
  const startMs = Date.UTC(2026, 2, 1); // 2026-03-01 in UTC
  const TOTAL_DAYS = 53;
  const imperfectDays = new Map<number, { missedHabits: number[]; waterCount: number }>([
    [0, { missedHabits: [reading.id], waterCount: 17 }],
    [2, { missedHabits: [workout2.id], waterCount: 16 }],
    [5, { missedHabits: [water.id], waterCount: 15 }],
    [6, { missedHabits: [diet.id], waterCount: 16 }],
    [8, { missedHabits: [workout1.id], waterCount: 17 }],
    [10, { missedHabits: [reading.id], waterCount: 16 }],
    [13, { missedHabits: [water.id], waterCount: 14 }],
    [14, { missedHabits: [noAlcohol.id], waterCount: 17 }],
    [17, { missedHabits: [workout2.id], waterCount: 16 }],
    [19, { missedHabits: [reading.id], waterCount: 18 }],
    [21, { missedHabits: [workout1.id], waterCount: 16 }],
    [24, { missedHabits: [water.id], waterCount: 15 }],
    [28, { missedHabits: [diet.id], waterCount: 17 }],
    [37, { missedHabits: [workout2.id], waterCount: 18 }],
    [41, { missedHabits: [reading.id], waterCount: 16 }],
    [42, { missedHabits: [water.id], waterCount: 15 }],
    [48, { missedHabits: [workout1.id], waterCount: 17 }],
  ]);
  const trackedHabits = [workout1, workout2, water, diet, noAlcohol, reading];

  function buildWaterCount(dayIndex: number, missed: boolean, overrideCount: number) {
    if (missed) return overrideCount;

    const gallonCounts = [16, 17, 18, 16, 19, 17, 18];
    return gallonCounts[dayIndex % gallonCounts.length];
  }

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = new Date(startMs + i * 86_400_000);
    const date = d.toISOString().slice(0, 10);
    const imperfectDay = imperfectDays.get(i);
    const missedHabits = imperfectDay?.missedHabits ?? [];

    for (const habit of trackedHabits) {
      const missed = missedHabits.includes(habit.id);
      const isWater = habit.id === water.id;

      logs.push({
        habitId: habit.id,
        date,
        completed: missed ? 0 : 1,
        count: isWater ? buildWaterCount(i, missed, imperfectDay?.waterCount ?? 16) : 0,
      });
    }
  }

  await db.insert(habitLogs).values(logs);
}
