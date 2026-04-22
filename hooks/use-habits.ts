import { db } from '@/db/client';
import { categories, habitLogs, habits, targets } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { useCallback, useEffect, useState } from 'react';

// Loads all habits with their category, today's log, weekly/monthly progress, and streak in a single hook.
export type HabitRow = {
  id: number;
  name: string;
  type: 'boolean' | 'count';
  categoryId: number;
  categoryName: string;
  categoryColour: string;
  categoryIcon: string;
  completed: boolean;
  count: number;
  weeklyGoal: number | null;
  monthlyGoal: number | null;
  weeklyDone: number;
  monthlyDone: number;
  streak: number;
};

// Groups habits by category for easier rendering in the UI
export type CategoryGroup = {
  id: number;
  name: string;
  colour: string;
  icon: string;
  habits: HabitRow[];
};

// Helper functions to format dates and calculate week/month start dates
function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Returns the date string for the Monday of the week of the given date
function getMondayOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return toDateString(mon);
}

// Returns the date string for the first day of the month of the given date
function getMonthStart(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Returns the date string for the last day of the month of the given date
export function useHabits() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load habits and their logs
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const today = toDateString(new Date());
      const weekStart = getMondayOfWeek(new Date());
      const monthStart = getMonthStart(new Date());

      // All habits joined with their category
      const rows = await db
        .select({
          habitId: habits.id,
          habitName: habits.name,
          habitType: habits.type,
          categoryId: categories.id,
          categoryName: categories.name,
          categoryColour: categories.colour,
          categoryIcon: categories.icon,
        })
        .from(habits)
        .innerJoin(categories, eq(habits.categoryId, categories.id))
        .orderBy(categories.name, habits.name);

      if (rows.length === 0) {
        setGroups([]);
        return;
      }

      // Today's logs (single query)
      const todayLogs = await db
        .select()
        .from(habitLogs)
        .where(eq(habitLogs.date, today));

      // This week logs (for weekly progress)
      const weekLogs = await db
        .select({ habitId: habitLogs.habitId, completed: habitLogs.completed })
        .from(habitLogs)
        .where(and(gte(habitLogs.date, weekStart), lte(habitLogs.date, today)));

      // This month logs (for monthly progress)
      const monthLogs = await db
        .select({ habitId: habitLogs.habitId, completed: habitLogs.completed })
        .from(habitLogs)
        .where(and(gte(habitLogs.date, monthStart), lte(habitLogs.date, today)));

      // All targets
      const allTargets = await db.select().from(targets);

      // Streak: all completed logs up to today, per habit
      const allDoneLogs = await db
        .select({ habitId: habitLogs.habitId, date: habitLogs.date })
        .from(habitLogs)
        .where(and(eq(habitLogs.completed, 1), lte(habitLogs.date, today)));

      // Pre group done dates by habit for efficient streak calculation
      const doneDatesByHabit = new Map<number, Set<string>>();
      for (const l of allDoneLogs) {
        if (!doneDatesByHabit.has(l.habitId)) doneDatesByHabit.set(l.habitId, new Set());
        doneDatesByHabit.get(l.habitId)!.add(l.date);
      }

      // Calculate streak by scanning backwards from yesterday until we find a day that wasn't completed
      function streakFor(habitId: number): number {
        const doneSet = doneDatesByHabit.get(habitId);
        if (!doneSet) return 0;
        let streak = 0;
        const cursor = new Date();
        cursor.setDate(cursor.getDate() - 1); // start from yesterday
        while (doneSet.has(toDateString(cursor))) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }
        if (doneSet.has(today)) streak++; // count today if done
        return streak;
      }

      // Build grouped structure
      const catMap = new Map<number, CategoryGroup>();

      for (const r of rows) {
        if (!catMap.has(r.categoryId)) {
          catMap.set(r.categoryId, {
            id: r.categoryId,
            name: r.categoryName,
            colour: r.categoryColour,
            icon: r.categoryIcon,
            habits: [],
          });
        }

        // Find today's log for this habit to get completion status and count
        const todayLog = todayLogs.find((l) => l.habitId === r.habitId);
        const weeklyTarget = allTargets.find(
          (t) => t.habitId === r.habitId && t.period === 'weekly'
        );
        const monthlyTarget = allTargets.find(
          (t) => t.habitId === r.habitId && t.period === 'monthly'
        );

        const weeklyDone = weekLogs.filter(
          (l) => l.habitId === r.habitId && l.completed === 1
        ).length;
        const monthlyDone = monthLogs.filter(
          (l) => l.habitId === r.habitId && l.completed === 1
        ).length;

        // Push habit with all its info into the correct category group
        catMap.get(r.categoryId)!.habits.push({
          id: r.habitId,
          name: r.habitName,
          type: r.habitType as 'boolean' | 'count',
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          categoryColour: r.categoryColour,
          categoryIcon: r.categoryIcon,
          completed: (todayLog?.completed ?? 0) === 1,
          count: todayLog?.count ?? 0,
          weeklyGoal: weeklyTarget?.goalCount ?? null,
          monthlyGoal: monthlyTarget?.goalCount ?? null,
          weeklyDone,
          monthlyDone,
          streak: streakFor(r.habitId),
        });
      }

      setGroups(Array.from(catMap.values()));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle a boolean habit or upsert a count habit
  const upsertLog = useCallback(
    async (habitId: number, completed: boolean, count: number) => {
      const today = toDateString(new Date());
      const existing = await db
        .select({ id: habitLogs.id })
        .from(habitLogs)
        .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, today)));

      if (existing.length > 0) {
        await db
          .update(habitLogs)
          .set({ completed: completed ? 1 : 0, count })
          .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, today)));
      } else {
        await db.insert(habitLogs).values({
          habitId,
          date: today,
          completed: completed ? 1 : 0,
          count,
        });
      }
      await load();
    },
    [load]
  );

  // Initial load and reload function
  useEffect(() => { load(); }, [load]);

  return { groups, loading, error, reload: load, upsertLog };
}
