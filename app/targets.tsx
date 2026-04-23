import { ThemedText } from '@/components/themed-text';
import { EmptyState, HabitCard, ProgressRow, ScreenHeader, SectionHeader, appColors, muted } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { db } from '@/db/client';
import { categories, habitLogs, habits, targets } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFocusEffect } from '@react-navigation/native';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

type Status = 'exceeded' | 'met' | 'on-track' | 'behind' | 'no-target';
type HabitRow = {
  id: number;
  name: string;
  categoryName: string;
  categoryColour: string;
  categoryIcon: string;
  weeklyGoal: number | null;
  monthlyGoal: number | null;
  weeklyDone: number;
  monthlyDone: number;
};
type CategoryGroup = {
  id: number;
  name: string;
  colour: string;
  icon: string;
  habits: HabitRow[];
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return toDateString(monday);
}

// For monthly targets compare against the calendar month not just the last 30 days.
function getMonthStart(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function countCompleted(logs: { habitId: number; completed: number }[]) {
  const counts = new Map<number, number>();

  for (const log of logs) {
    if (log.completed !== 1) continue;
    counts.set(log.habitId, (counts.get(log.habitId) ?? 0) + 1);
  }

  return counts;
}

function remainingMessage(done: number, goal: number, period: 'week' | 'month') {
  if (done > goal) return `Goal exceeded by ${done - goal}`;
  if (done === goal) return 'Goal reached';
  return `${goal - done} remaining this ${period}`;
}

function weeklyStatus(done: number, goal: number): Status {
  if (done > goal) return 'exceeded';
  if (done === goal) return 'met';

  const raw = new Date().getDay();
  const dayOfWeek = raw === 0 ? 7 : raw;
  const expected = Math.round((goal * dayOfWeek) / 7);
  return done >= expected ? 'on-track' : 'behind';
}

function monthlyStatus(done: number, goal: number): Status {
  if (done > goal) return 'exceeded';
  if (done === goal) return 'met';

  const today = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const expected = Math.round((goal * today) / daysInMonth);
  return done >= expected ? 'on-track' : 'behind';
}

function statusText(status: Status) {
  switch (status) {
    case 'exceeded':
      return 'Exceeded';
    case 'met':
      return 'Goal met';
    case 'on-track':
      return 'In range';
    case 'behind':
      return 'Remaining';
    default:
      return '';
  }
}

function statusColour(status: Status) {
  switch (status) {
    case 'exceeded':
      return appColors.info;
    case 'met':
    case 'on-track':
      return appColors.success;
    case 'behind':
      return appColors.warning;
    default:
      return appColors.mutedLight;
  }
}

function WeekPips({ done, goal, colour }: { done: number; goal: number; colour: string }) {
  return (
    <View style={styles.pipRow} accessibilityLabel={`${done} of ${goal} days this week`}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            { backgroundColor: i < done ? colour : colour + '22' },
          ]}
        />
      ))}
    </View>
  );
}

function TargetHabitCard({ habit, scheme }: { habit: HabitRow; scheme: 'light' | 'dark' }) {
  const hasWeekly = habit.weeklyGoal !== null;
  const hasMonthly = habit.monthlyGoal !== null;

  if (!hasWeekly && !hasMonthly) return null;

  const weekly = hasWeekly ? weeklyStatus(habit.weeklyDone, habit.weeklyGoal!) : 'no-target';
  const monthly = hasMonthly ? monthlyStatus(habit.monthlyDone, habit.monthlyGoal!) : 'no-target';

  return (
    <HabitCard
      name={habit.name}
      category={habit.categoryName}
      icon={habit.categoryIcon}
      colour={habit.categoryColour}
      scheme={scheme}
      accessibilityLabel={`Target card for ${habit.name}`}
    >
      {hasWeekly ? (
        <View style={styles.targetBlock}>
          <ProgressRow
            done={habit.weeklyDone}
            goal={habit.weeklyGoal!}
            colour={habit.categoryColour}
            scheme={scheme}
            label="Weekly target"
            statusText={statusText(weekly)}
            statusColour={statusColour(weekly)}
          />
          <ThemedText style={[styles.remainingText, { color: muted(scheme) }]}>
            {remainingMessage(habit.weeklyDone, habit.weeklyGoal!, 'week')}
          </ThemedText>
          <WeekPips done={habit.weeklyDone} goal={habit.weeklyGoal!} colour={habit.categoryColour} />
        </View>
      ) : null}

      {hasMonthly ? (
        <View style={styles.targetBlock}>
          <ProgressRow
            done={habit.monthlyDone}
            goal={habit.monthlyGoal!}
            colour={habit.categoryColour}
            scheme={scheme}
            label="Monthly target"
            statusText={statusText(monthly)}
            statusColour={statusColour(monthly)}
            height={7}
          />
          <ThemedText style={[styles.remainingText, { color: muted(scheme) }]}>
            {remainingMessage(habit.monthlyDone, habit.monthlyGoal!, 'month')}
          </ThemedText>
        </View>
      ) : null}
    </HabitCard>
  );
}

function CategorySection({ group, scheme }: { group: CategoryGroup; scheme: 'light' | 'dark' }) {
  const habitsWithTargets = group.habits.filter(
    (habit) => habit.weeklyGoal !== null || habit.monthlyGoal !== null
  );

  if (habitsWithTargets.length === 0) return null;

  return (
    <View>
      <SectionHeader
        title={group.name}
        icon={group.icon}
        colour={group.colour}
        scheme={scheme}
        rightText={`${habitsWithTargets.length} habits`}
      />
      {habitsWithTargets.map((habit) => (
        <TargetHabitCard key={habit.id} habit={habit} scheme={scheme} />
      ))}
    </View>
  );
}

function TargetSummary({ groups, scheme }: { groups: CategoryGroup[]; scheme: 'light' | 'dark' }) {
  const allHabits = groups.flatMap((group) => group.habits);
  const weeklyHabits = allHabits.filter((habit) => habit.weeklyGoal !== null);
  const monthlyHabits = allHabits.filter((habit) => habit.monthlyGoal !== null);

  const weeklyMet = weeklyHabits.filter((habit) => {
    const status = weeklyStatus(habit.weeklyDone, habit.weeklyGoal!);
    return status === 'met' || status === 'exceeded';
  }).length;

  const monthlyMet = monthlyHabits.filter((habit) => {
    const status = monthlyStatus(habit.monthlyDone, habit.monthlyGoal!);
    return status === 'met' || status === 'exceeded';
  }).length;

  const parts: string[] = [];
  if (weeklyHabits.length > 0) parts.push(`${weeklyMet}/${weeklyHabits.length} weekly`);
  if (monthlyHabits.length > 0) parts.push(`${monthlyMet}/${monthlyHabits.length} monthly`);

  return (
    <ThemedText style={[styles.summaryLine, { color: muted(scheme) }]}>
      Progress overview: {parts.join('  ·  ')}
    </ThemedText>
  );
}

export default function TargetsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { user } = useAuth();
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTargets = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date();
      const todayString = toDateString(today);
      const weekStart = getWeekStart(today);
      const monthStart = getMonthStart(today);

      const habitRows = await db
        .select({
          habitId: habits.id,
          habitName: habits.name,
          categoryId: categories.id,
          categoryName: categories.name,
          categoryColour: categories.colour,
          categoryIcon: categories.icon,
        })
        .from(habits)
        .innerJoin(categories, eq(habits.categoryId, categories.id))
        .where(eq(habits.userId, user.id))
        .orderBy(categories.name, habits.name);

      if (habitRows.length === 0) {
        setGroups([]);
        return;
      }

      const habitIds = habitRows.map((row) => row.habitId);
      const [weekLogs, monthLogs, targetRows] = await Promise.all([
        db
          .select({ habitId: habitLogs.habitId, completed: habitLogs.completed })
          .from(habitLogs)
          .where(
            and(
              gte(habitLogs.date, weekStart),
              lte(habitLogs.date, todayString),
              inArray(habitLogs.habitId, habitIds)
            )
          ),
        db
          .select({ habitId: habitLogs.habitId, completed: habitLogs.completed })
          .from(habitLogs)
          .where(
            and(
              gte(habitLogs.date, monthStart),
              lte(habitLogs.date, todayString),
              inArray(habitLogs.habitId, habitIds)
            )
          ),
        db.select().from(targets).where(inArray(targets.habitId, habitIds)),
      ]);

      const weeklyDoneByHabit = countCompleted(weekLogs);
      const monthlyDoneByHabit = countCompleted(monthLogs);
      const weeklyGoals = new Map<number, number>();
      const monthlyGoals = new Map<number, number>();

      for (const target of targetRows) {
        if (target.period === 'weekly') weeklyGoals.set(target.habitId, target.goalCount);
        if (target.period === 'monthly') monthlyGoals.set(target.habitId, target.goalCount);
      }

      const grouped = new Map<number, CategoryGroup>();

      for (const row of habitRows) {
        if (!grouped.has(row.categoryId)) {
          grouped.set(row.categoryId, {
            id: row.categoryId,
            name: row.categoryName,
            colour: row.categoryColour,
            icon: row.categoryIcon,
            habits: [],
          });
        }

        grouped.get(row.categoryId)!.habits.push({
          id: row.habitId,
          name: row.habitName,
          categoryName: row.categoryName,
          categoryColour: row.categoryColour,
          categoryIcon: row.categoryIcon,
          weeklyGoal: weeklyGoals.get(row.habitId) ?? null,
          monthlyGoal: monthlyGoals.get(row.habitId) ?? null,
          weeklyDone: weeklyDoneByHabit.get(row.habitId) ?? 0,
          monthlyDone: monthlyDoneByHabit.get(row.habitId) ?? 0,
        });
      }

      setGroups(Array.from(grouped.values()));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadTargets(); }, [loadTargets]));

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: Colors[scheme].background }]}>
        <ActivityIndicator size="large" color={Colors[scheme].tint} />
      </View>
    );
  }

  const hasAnyTarget = groups.some(
    (group) => group.habits.some((habit) => habit.weeklyGoal !== null || habit.monthlyGoal !== null)
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors[scheme].background }}
      contentContainerStyle={styles.scroll}
    >
      <ScreenHeader
        title="Targets"
        subtitle="Your weekly and monthly goals"
        scheme={scheme}
      />

      {hasAnyTarget ? (
        <>
          <TargetSummary groups={groups} scheme={scheme} />
          {groups.map((group) => (
            <CategorySection key={group.id} group={group} scheme={scheme} />
          ))}
        </>
      ) : (
        <EmptyState
          title="No targets set"
          message="Add a weekly or monthly target to a habit and it will appear here."
          scheme={scheme}
        />
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingTop: 20 },
  summaryLine: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  targetBlock: { gap: 8 },
  remainingText: { fontSize: 12, lineHeight: 17 },
  pipRow: { flexDirection: 'row', gap: 4 },
  pip: { width: 14, height: 14, borderRadius: 3 },
});
