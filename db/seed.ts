import { db } from './client';
import { tasks } from './schema';

export async function seedTasksIfEmpty() {
  const existing = await db.select().from(tasks);
  if (existing.length > 0) return;

  await db.insert(tasks).values([
    { name: 'Morning Run', category: 'Fitness', date: '2024-01-01', count: 1 },
    { name: 'Read', category: 'Learning', date: '2024-01-01', count: 2 },
    { name: 'Meal Prep', category: 'Health', date: '2024-01-02', count: 1 },
  ]);
}
