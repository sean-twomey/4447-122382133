import { db } from './client';
import { users, categories, habits, habitLogs, targets } from './schema';

export async function seedIfEmpty() {
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) return;

  // User
  const [user] = await db
    .insert(users)
    .values({ email: 'demo@habits.app', passwordHash: 'demo', createdAt: '2026-03-01' })
    .returning();

  // Categories
  const cats = await db
    .insert(categories)
    .values([
      { userId: user.id, name: 'Mindfulness', colour: '#7C3AED', icon: '🧘' },
      { userId: user.id, name: 'Sleep',       colour: '#2563EB', icon: '😴' },
      { userId: user.id, name: 'Exercise',    colour: '#16A34A', icon: '🏃' },
      { userId: user.id, name: 'Nutrition',   colour: '#D97706', icon: '🥗' },
      { userId: user.id, name: 'Hydration',   colour: '#0891B2', icon: '💧' },
    ])
    .returning();

  const [mindfulness, sleep, exercise, nutrition, hydration] = cats;

  // Habits
  const insertedHabits = await db
    .insert(habits)
    .values([
      { userId: user.id, categoryId: mindfulness.id, name: 'Meditation',   type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: mindfulness.id, name: 'Journaling',   type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: sleep.id,       name: 'Sleep 8hrs',   type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: exercise.id,    name: 'Workout',      type: 'boolean', createdAt: '2026-03-01' },
      { userId: user.id, categoryId: exercise.id,    name: 'Steps',        type: 'count',   createdAt: '2026-03-01' },
      { userId: user.id, categoryId: nutrition.id,   name: 'Healthy Meal', type: 'count',   createdAt: '2026-03-01' },
      { userId: user.id, categoryId: hydration.id,   name: 'Water Intake', type: 'count',   createdAt: '2026-03-01' },
    ])
    .returning();

  const [meditation, journaling, sleepHabit, workout, steps, healthyMeal, water] = insertedHabits;

  // Weekly targets
  await db.insert(targets).values([
    { habitId: meditation.id,  period: 'weekly', goalCount: 5  },
    { habitId: journaling.id,  period: 'weekly', goalCount: 4  },
    { habitId: sleepHabit.id,  period: 'weekly', goalCount: 7  },
    { habitId: workout.id,     period: 'weekly', goalCount: 4  },
    { habitId: steps.id,       period: 'weekly', goalCount: 70000 },
    { habitId: healthyMeal.id, period: 'weekly', goalCount: 14 },
    { habitId: water.id,       period: 'weekly', goalCount: 56 },
  ]);

  // 50 days of logs (2026-03-01 to 2026-04-19)
  // Adherence improves from ~60% early to ~85% recent to show progress in charts
  const logs: { habitId: number; date: string; completed: number; count: number }[] = [];
  const startDate = new Date('2026-03-01');

  for (let i = 0; i < 50; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const progress = i / 49;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    // Meditation (boolean)
    if (Math.random() < 0.6 + progress * 0.25)
      logs.push({ habitId: meditation.id, date, completed: 1, count: 0 });

    // Journaling (boolean, slightly less frequent)
    if (Math.random() < 0.5 + progress * 0.2)
      logs.push({ habitId: journaling.id, date, completed: 1, count: 0 });

    // Sleep (boolean, weekends slightly better)
    if (Math.random() < (isWeekend ? 0.8 : 0.55) + progress * 0.15)
      logs.push({ habitId: sleepHabit.id, date, completed: 1, count: 0 });

    // Workout (boolean, skip Sundays often)
    if (d.getDay() !== 0 && Math.random() < 0.55 + progress * 0.2)
      logs.push({ habitId: workout.id, date, completed: 1, count: 0 });

    // Steps (count 4000–12000, improving over time)
    const stepCount = Math.floor(4000 + Math.random() * 8000 + progress * 2000);
    logs.push({ habitId: steps.id, date, completed: stepCount >= 8000 ? 1 : 0, count: stepCount });

    // Healthy meals (count 0–3)
    const meals = Math.floor(Math.random() < 0.15 ? 0 : 1 + Math.random() * 2 + progress);
    logs.push({ habitId: healthyMeal.id, date, completed: meals >= 2 ? 1 : 0, count: meals });

    // Water glasses (count 4–10)
    const glasses = Math.min(Math.floor(4 + Math.random() * 6 + progress * 2), 10);
    logs.push({ habitId: water.id, date, completed: glasses >= 8 ? 1 : 0, count: glasses });
  }

  await db.insert(habitLogs).values(logs);
}
