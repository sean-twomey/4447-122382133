import { ThemedText } from '@/components/themed-text';
import { ProgressRow, SectionHeader, appColors, divider, headerSurface, muted, softSurface, surface } from '@/components/ui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { db } from '@/db/client';
import { categories, habitLogs, habits, targets } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useWeather } from '@/hooks/use-weather';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const LOGO_LIGHT = require('@/assets/images/logo-light.png');
const LOGO_DARK = require('@/assets/images/logo-dark.png');
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type HabitRow = {
  id: number;
  name: string;
  categoryName: string;
  categoryColour: string;
  categoryIcon: string;
  completed: boolean;
  weeklyGoal: number | null;
  weeklyDone: number;
};

type ProgressState = {
  weeklyCompletedDays: number;
  completedDays: number;
  currentStreak: number;
  bestStreak: number;
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekStart(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return toDateString(monday);
}

function countCompleted(logs: { habitId: number; completed: number }[]) {
  const counts = new Map<number, number>();
  for (const log of logs) {
    if (log.completed !== 1) continue;
    counts.set(log.habitId, (counts.get(log.habitId) ?? 0) + 1);
  }
  return counts;
}

// Build a map of date to set of completed habitIds
function completedDayStats(
  logs: { date: string; habitId: number; completed: number }[],
  habitCount: number,
  fromDate: string,
  toDate: string
) {
  const dayMap = new Map<string, Set<number>>();
  for (const log of logs) {
    if (log.completed !== 1) continue;
    const set = dayMap.get(log.date) ?? new Set<number>();
    set.add(log.habitId);
    dayMap.set(log.date, set);
  }

  // Count how many days had all habits completed
  let completedDays = 0;
  const cursor = new Date(fromDate + 'T12:00:00');
  while (toDateString(cursor) <= toDate) {
    if ((dayMap.get(toDateString(cursor))?.size ?? 0) === habitCount) completedDays++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return { dayMap, completedDays };
}

function getCurrentStreak(
  dayMap: Map<string, Set<number>>,
  habitCount: number,
  fromDate: string,
  earliestTracked?: string
) {
  if (habitCount === 0) return 0;
  let streak = 0;
  const cursor = new Date(fromDate + 'T12:00:00');
  while (!earliestTracked || toDateString(cursor) >= earliestTracked) {
    if ((dayMap.get(toDateString(cursor))?.size ?? 0) !== habitCount) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Iterate through the tracked date range to find the longest run of consecutive days with all habits completed
function getBestStreak(
  dayMap: Map<string, Set<number>>,
  habitCount: number,
  trackedDates: string[]
) {
  if (habitCount === 0 || trackedDates.length === 0) return 0;
  let best = 0;
  let current = 0;
  const cursor = new Date(trackedDates[0] + 'T12:00:00');
  const last = trackedDates[trackedDates.length - 1];
  while (toDateString(cursor) <= last) {
    if ((dayMap.get(toDateString(cursor))?.size ?? 0) === habitCount) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return best;
}

function formatDate() {
  return new Date().toLocaleDateString('en-IE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function SummaryCard({
  summary,
  scheme,
}: {
  summary: ProgressState;
  scheme: 'light' | 'dark';
}) {
  const rows = [
    { label: 'This week', value: `${summary.weeklyCompletedDays}/7 days` },
    { label: 'Completed days', value: String(summary.completedDays) },
    { label: 'Current streak', value: `${summary.currentStreak} days` },
    { label: 'Best streak', value: `${summary.bestStreak} days` },
  ];

  return (
    <View style={[styles.panel, { backgroundColor: surface(scheme) }]}>
      <ThemedText style={styles.cardTitle}>75 Hard Progress</ThemedText>
      <View style={styles.summaryRows}>
        {rows.map((row) => (
          <View key={row.label} style={[styles.summaryRow, { borderBottomColor: divider(scheme) }]}>
            <ThemedText style={[styles.summaryLabel, { color: muted(scheme) }]}>{row.label}</ThemedText>
            <ThemedText style={styles.summaryValue}>{row.value}</ThemedText>
          </View>
        ))}
      </View>
      <ProgressRow
        done={summary.completedDays}
        goal={75}
        colour={appColors.tint}
        scheme={scheme}
        label="Days completed"
        rightText={`${summary.completedDays}/75`}
      />
    </View>
  );
}

function TodayCard({ completed, total, scheme, onCheckIn, onTargets }: {
  completed: number;
  total: number;
  scheme: 'light' | 'dark';
  onCheckIn: () => void;
  onTargets: () => void;
}) {
  const allDone = completed === total && total > 0;
  const remaining = Math.max(total - completed, 0);
  const subcopy = total === 0
    ? 'No habits added yet.'
    : allDone
      ? 'Everything is logged for today.'
      : `${remaining} ${remaining === 1 ? 'habit' : 'habits'} left today.`;

  return (
    <View style={[styles.panel, styles.checkInCard, { backgroundColor: surface(scheme) }]}>
      <View style={styles.checkInHeader}>
        <View style={styles.checkInCopy}>
          <ThemedText style={styles.cardTitle}>Today</ThemedText>
          <ThemedText style={[styles.checkInSubcopy, { color: muted(scheme) }]}>{subcopy}</ThemedText>
        </View>
        <View style={[styles.todayCountBadge, { backgroundColor: softSurface(scheme) }]}>
          <ThemedText style={[styles.todayCountValue, allDone ? { color: appColors.success } : null]}>
            {completed}/{total}
          </ThemedText>
        </View>
      </View>

      <TouchableOpacity
        style={styles.mainAction}
        onPress={onCheckIn}
        activeOpacity={0.8}
        accessibilityLabel="Open daily check-in"
      >
        <Text style={styles.mainActionText}>Complete Today&apos;s Check-In</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryAction}
        onPress={onTargets}
        activeOpacity={0.8}
        accessibilityLabel="View targets"
      >
        <Text style={[styles.secondaryActionText, { color: muted(scheme) }]}>View Targets</Text>
      </TouchableOpacity>
    </View>
  );
}

function DailyStats({ completed, total, scheme }: {
  completed: number;
  total: number;
  scheme: 'light' | 'dark';
}) {
  const allDone = completed === total && total > 0;

  return (
    <View style={[styles.inlineSummary, { borderColor: divider(scheme) }]}>
      <View>
        <ThemedText style={[styles.inlineSummaryValue, allDone ? { color: appColors.success } : null]}>
          {completed}/{total}
        </ThemedText>
        <ThemedText style={[styles.inlineSummaryLabel, { color: muted(scheme) }]}>
          habits completed today
        </ThemedText>
      </View>
      <ThemedText style={[styles.inlineSummaryStatus, { color: allDone ? appColors.success : muted(scheme) }]}>
        {allDone ? 'All done' : 'In progress'}
      </ThemedText>
    </View>
  );
}

function HabitsSection({ children, total, scheme }: {
  children: React.ReactNode;
  total: number;
  scheme: 'light' | 'dark';
}) {
  return (
    <View style={[styles.panel, styles.habitsPanel, { backgroundColor: surface(scheme) }]}>
      <SectionHeader title="Today's habits" rightText={`${total}`} scheme={scheme} />
      <View style={styles.habitsList}>{children}</View>
    </View>
  );
}

function DashboardHabit({ habit, scheme, onToggle }: {
  habit: HabitRow;
  scheme: 'light' | 'dark';
  onToggle: (id: number) => void;
}) {
  const goal = habit.weeklyGoal ?? 7;

  return (
    <TouchableOpacity
      style={[styles.habitRow, { borderBottomColor: divider(scheme) }]}
      onPress={() => onToggle(habit.id)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={habit.name}
    >
      <View style={styles.habitRowTop}>
        <View style={styles.habitMeta}>
          <View style={[styles.habitIconBadge, { backgroundColor: habit.categoryColour + '22' }]}>
            <ThemedText style={styles.habitIcon}>{habit.categoryIcon ?? '•'}</ThemedText>
          </View>
          <View style={styles.habitTextBlock}>
            <ThemedText style={[styles.habitName, habit.completed && styles.habitNameDone]}>{habit.name}</ThemedText>
            <ThemedText style={[styles.habitCategory, { color: muted(scheme) }]}>{habit.categoryName}</ThemedText>
          </View>
        </View>
        <View
          style={[
            styles.habitCheck,
            habit.completed
              ? { backgroundColor: appColors.success, borderColor: appColors.success }
              : { borderColor: divider(scheme) },
          ]}
        >
          {habit.completed ? <ThemedText style={styles.habitCheckText}>✓</ThemedText> : null}
        </View>
      </View>

      <ProgressRow
        done={habit.weeklyDone}
        goal={goal}
        colour={appColors.tint}
        scheme={scheme}
        label="This week"
        rightText={`${habit.weeklyDone}/${goal}`}
      />
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const weather = useWeather();
  const [habitsState, setHabitsState] = useState<HabitRow[]>([]);
  const [summary, setSummary] = useState<ProgressState>({
    weeklyCompletedDays: 0,
    completedDays: 0,
    currentStreak: 0,
    bestStreak: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date();
      const todayStr = toDateString(today);
      const weekStart = getWeekStart(today);
      const sixMonthsAgo = toDateString(addDays(today, -179));

      const habitRows = await db
        .select({
          habitId: habits.id,
          habitName: habits.name,
          categoryName: categories.name,
          categoryColour: categories.colour,
          categoryIcon: categories.icon,
        })
        .from(habits)
        .innerJoin(categories, eq(habits.categoryId, categories.id))
        .where(eq(habits.userId, user.id))
        .orderBy(categories.name, habits.name);

      if (habitRows.length === 0) {
        setHabitsState([]);
        setSummary({ weeklyCompletedDays: 0, completedDays: 0, currentStreak: 0, bestStreak: 0 });
        return;
      }

      const habitIds = habitRows.map((row) => row.habitId);
      const [todayLogs, weekLogs, targetRows, historyLogs] = await Promise.all([
        db
          .select({ habitId: habitLogs.habitId, completed: habitLogs.completed })
          .from(habitLogs)
          .where(and(eq(habitLogs.date, todayStr), inArray(habitLogs.habitId, habitIds))),
        db
          .select({ habitId: habitLogs.habitId, completed: habitLogs.completed })
          .from(habitLogs)
          .where(and(gte(habitLogs.date, weekStart), lte(habitLogs.date, todayStr), inArray(habitLogs.habitId, habitIds))),
        db.select().from(targets).where(inArray(targets.habitId, habitIds)),
        db
          .select({ date: habitLogs.date, habitId: habitLogs.habitId, completed: habitLogs.completed })
          .from(habitLogs)
          .where(and(gte(habitLogs.date, sixMonthsAgo), lte(habitLogs.date, todayStr), inArray(habitLogs.habitId, habitIds))),
      ]);

      const completedToday = new Set(
        todayLogs.filter((log) => log.completed === 1).map((log) => log.habitId)
      );
      const weeklyDoneByHabit = countCompleted(weekLogs);
      const weeklyGoals = new Map<number, number>();
      for (const target of targetRows) {
        if (target.period === 'weekly') weeklyGoals.set(target.habitId, target.goalCount);
      }

      setHabitsState(
        habitRows.map((row) => ({
          id: row.habitId,
          name: row.habitName,
          categoryName: row.categoryName,
          categoryColour: row.categoryColour,
          categoryIcon: row.categoryIcon,
          completed: completedToday.has(row.habitId),
          weeklyGoal: weeklyGoals.get(row.habitId) ?? null,
          weeklyDone: weeklyDoneByHabit.get(row.habitId) ?? 0,
        }))
      );

      const { dayMap, completedDays } = completedDayStats(historyLogs, habitRows.length, sixMonthsAgo, todayStr);
      const trackedDates = Array.from(dayMap.keys()).sort();
      const latestTracked = trackedDates[trackedDates.length - 1] ?? todayStr;
      const refDate = latestTracked < todayStr ? latestTracked : todayStr;
      const weeklyCompletedDays = completedDayStats(historyLogs, habitRows.length, weekStart, refDate).completedDays;

      setSummary({
        weeklyCompletedDays,
        completedDays,
        currentStreak: getCurrentStreak(dayMap, habitRows.length, refDate, trackedDates[0]),
        bestStreak: getBestStreak(dayMap, habitRows.length, trackedDates),
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadDashboard(); }, [loadDashboard]));

  async function handleToggle(habitId: number) {
    const habit = habitsState.find((item) => item.id === habitId);
    if (!habit) return;

    const today = toDateString(new Date());
    const existing = await db
      .select({ id: habitLogs.id })
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, today)));

    if (existing.length > 0) {
      await db
        .update(habitLogs)
        .set({ completed: habit.completed ? 0 : 1, count: 0 })
        .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, today)));
    } else {
      await db.insert(habitLogs).values({
        habitId,
        date: today,
        completed: habit.completed ? 0 : 1,
        count: 0,
      });
    }

    await loadDashboard();
  }

  const completed = habitsState.filter((h) => h.completed).length;
  const total = habitsState.length;
  const sorted = [...habitsState].sort((a, b) => Number(a.completed) - Number(b.completed));

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: Colors[scheme].background }]}>
        <ActivityIndicator color={Colors[scheme].tint} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors[scheme].background }}>
      <View
        style={[
          styles.pageHeader,
          {
            backgroundColor: headerSurface(scheme),
            paddingTop: insets.top + 12,
            borderBottomColor: divider(scheme),
          },
        ]}
      >
        <View style={styles.pageHeaderText}>
          <Image source={scheme === 'dark' ? LOGO_DARK : LOGO_LIGHT} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.pageSubtitleRow}>
            <ThemedText style={[styles.pageSubtitle, { color: muted(scheme) }]}>{formatDate()}</ThemedText>
            {!weather.loading && !weather.error && weather.temperature !== null && (
              <ThemedText style={[styles.pageSubtitle, { color: muted(scheme) }]}>
                {'  ·  '}{weather.temperature}°C · {weather.condition} · Cork
              </ThemedText>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')} hitSlop={12} accessibilityLabel="Profile">
          <IconSymbol name="person.circle.fill" size={26} color={muted(scheme)} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <SummaryCard summary={summary} scheme={scheme} />
        <DailyStats completed={completed} total={total} scheme={scheme} />
        <TodayCard
          completed={completed}
          total={total}
          scheme={scheme}
          onCheckIn={() => router.push('/check-in')}
          onTargets={() => router.push('/targets')}
        />

        <HabitsSection total={sorted.length} scheme={scheme}>
          {sorted.map((habit) => (
            <DashboardHabit key={habit.id} habit={habit} onToggle={handleToggle} scheme={scheme} />
          ))}
        </HabitsSection>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageHeaderText: { flex: 1 },
  headerLogo: { width: 140, height: 40, marginBottom: 4 },
  pageSubtitleRow: { flexDirection: 'row', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  pageSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  panel: {
    borderRadius: 6,
    padding: 13,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00000012',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  summaryRows: { marginBottom: 12 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryLabel: { fontSize: 13, lineHeight: 18 },
  summaryValue: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  inlineSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 10,
  },
  inlineSummaryValue: { fontSize: 18, fontWeight: '700' },
  inlineSummaryLabel: { fontSize: 12, marginTop: 2 },
  inlineSummaryStatus: { fontSize: 12, fontWeight: '700' },
  checkInCard: { paddingTop: 12 },
  checkInHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  checkInCopy: { flex: 1 },
  checkInSubcopy: { fontSize: 13, lineHeight: 18 },
  todayCountBadge: {
    minWidth: 58,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  todayCountValue: { fontSize: 14, fontWeight: '700' },
  mainAction: {
    backgroundColor: appColors.tint,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  mainActionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryAction: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  secondaryActionText: { fontSize: 13, fontWeight: '600' },
  habitsPanel: { paddingTop: 11 },
  habitsList: { marginTop: -2 },
  habitRow: {
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  habitRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  habitMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  habitIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitIcon: { fontSize: 14 },
  habitTextBlock: { flex: 1, gap: 2 },
  habitName: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  habitNameDone: { opacity: 0.55 },
  habitCategory: { fontSize: 12, lineHeight: 16 },
  habitCheck: {
    width: 26,
    height: 26,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitCheckText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
