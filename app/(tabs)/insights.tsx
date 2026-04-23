import { ThemedText } from '@/components/themed-text';
import { ProgressRow, divider, headerSurface, muted, surface } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { db } from '@/db/client';
import { categories, habitLogs, habits } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFocusEffect } from '@react-navigation/native';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const accent = '#2D6A4F';
const chart_height = 120;

type HabitWeekProgress = {
  habitId: number;
  name: string;
  colour: string;
  completedDays: number;
  targetDays: number;
};

type RecentMissedDay = {
  date: string;
  label: string;
  missedHabits: string[];
};

type WeekProgress = {
  weekStart: string;
  completedDays: number;
};

type ProgressState = {
  completedDays: number;
  currentStreak: number;
  bestStreak: number;
  thisWeekCompletedDays: number;
  weeklyCompletion: WeekProgress[];
  habitProgress: HabitWeekProgress[];
  recentMissedDays: RecentMissedDay[];
};

type TrackedHabit = {
  habitId: number;
  name: string;
  colour: string;
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
  return addDays(date, diff);
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(date + 'T12:00:00'));
}

function getCompletedDayMap(logs: { date: string; habitId: number; completed: number }[]) {
  const dayMap = new Map<string, Set<number>>();
  for (const log of logs) {
    if (log.completed !== 1) continue;
    const set = dayMap.get(log.date) ?? new Set<number>();
    set.add(log.habitId);
    dayMap.set(log.date, set);
  }
  return dayMap;
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

function getWeeklyCompletion( dayMap: Map<string, Set<number>>, habitCount: number, endDate: string, weeks = 6) {
  const currentWeekStart = getWeekStart(new Date(endDate + 'T12:00:00'));
  const rows: WeekProgress[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStartDate = addDays(currentWeekStart, -7 * i);
    let completedDays = 0;

    for (let d = 0; d < 7; d++) {
      const date = toDateString(addDays(weekStartDate, d));
      if (date > endDate) break;
      if ((dayMap.get(date)?.size ?? 0) === habitCount) completedDays++;
    }

    rows.push({ weekStart: toDateString(weekStartDate), completedDays });
  }

  return rows;
}

function Section({ title, subtitle, children, scheme }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scheme: 'light' | 'dark';
}) {
  return (
    <View style={[styles.section, { backgroundColor: surface(scheme), borderColor: divider(scheme) }]}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        {subtitle ? <ThemedText style={[styles.sectionSubtitle, { color: muted(scheme) }]}>{subtitle}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

function SummaryItem({ label, value, scheme }: { label: string; value: string; scheme: 'light' | 'dark' }) {
  return (
    <View style={[styles.summaryItem, { borderBottomColor: divider(scheme) }]}>
      <ThemedText style={styles.summaryValue}>{value}</ThemedText>
      <ThemedText style={[styles.summaryLabel, { color: muted(scheme) }]}>{label}</ThemedText>
    </View>
  );
}

function SummaryCard({ data, scheme }: { data: ProgressState; scheme: 'light' | 'dark' }) {
  return (
    <Section title="Progress overview" subtitle="Weekly completion and streaks" scheme={scheme}>
      <View style={styles.summaryGrid}>
        <SummaryItem label="This week" value={`${data.thisWeekCompletedDays}/7`} scheme={scheme} />
        <SummaryItem label="Current streak" value={`${data.currentStreak} days`} scheme={scheme} />
        <SummaryItem label="Best streak" value={`${data.bestStreak} days`} scheme={scheme} />
        <SummaryItem label="Completed days" value={String(data.completedDays)} scheme={scheme} />
      </View>
    </Section>
  );
}

function WeeklyChart({ weeks, scheme }: { weeks: WeekProgress[]; scheme: 'light' | 'dark' }) {
  const trackColour = scheme === 'dark' ? '#24272A' : '#E9ECEF';

  return (
    <Section title="Weekly completion" subtitle="Completed days over the last 6 weeks" scheme={scheme}>
      <View style={styles.chartRow}>
        {weeks.map((week, index) => {
          const barHeight = week.completedDays === 0 ? 0 : Math.max((week.completedDays / 7) * chart_height, 6);
          return (
            <View key={week.weekStart} style={styles.chartColumn}>
              <View style={styles.chartValueBox}>
                <ThemedText style={styles.chartValue}>{week.completedDays}</ThemedText>
              </View>
              <View style={[styles.chartTrack, { backgroundColor: trackColour, height: chart_height }]}>
                <View style={[styles.chartBar, { backgroundColor: accent, height: barHeight }]} />
              </View>
              <ThemedText style={[styles.chartLabel, { color: muted(scheme) }]}>{`Week ${index + 1}`}</ThemedText>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

function HabitProgress({ habits: habitList, scheme }: { habits: HabitWeekProgress[]; scheme: 'light' | 'dark' }) {
  return (
    <Section title="Habit progress" subtitle="Completed days out of 7 this week" scheme={scheme}>
      <View style={styles.progressList}>
        {habitList.map((habit) => (
          <View key={habit.habitId} style={styles.progressItem}>
            <ProgressRow
              done={habit.completedDays}
              goal={habit.targetDays}
              colour={habit.colour}
              scheme={scheme}
              label={habit.name}
              rightText={`${habit.completedDays}/${habit.targetDays}`}
              height={8}
            />
          </View>
        ))}
      </View>
    </Section>
  );
}

function MissedDayRow({ item, scheme }: { item: RecentMissedDay; scheme: 'light' | 'dark' }) {
  return (
    <View style={[styles.missedRow, { borderBottomColor: divider(scheme) }]}>
      <ThemedText style={styles.missedDate}>{item.label}</ThemedText>
      <ThemedText style={[styles.missedHabitText, { color: muted(scheme) }]}>
        {item.missedHabits.join(' + ')}
      </ThemedText>
    </View>
  );
}

function MissedDays({ items, scheme }: { items: RecentMissedDay[]; scheme: 'light' | 'dark' }) {
  return (
    <Section
      title="Recent missed days"
      subtitle={items.length > 0 ? 'Latest tracked days that were not fully completed' : 'No recent missed days'}
      scheme={scheme}
    >
      {items.length > 0 ? (
        <View style={styles.missedList}>
          {items.map((item) => (
            <MissedDayRow key={item.date} item={item} scheme={scheme} />
          ))}
        </View>
      ) : (
        <ThemedText style={[styles.emptyText, { color: muted(scheme) }]}>
          Recent tracked days have all been completed.
        </ThemedText>
      )}
    </Section>
  );
}

export default function InsightsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ProgressState>({
    completedDays: 0,
    currentStreak: 0,
    bestStreak: 0,
    thisWeekCompletedDays: 0,
    weeklyCompletion: [],
    habitProgress: [],
    recentMissedDays: [],
  });
  const [loading, setLoading] = useState(true);

  const loadInsights = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date();
      const todayStr = toDateString(today);
      const sixMonthsAgo = toDateString(addDays(today, -179));

      const trackedHabits: TrackedHabit[] = await db
        .select({ habitId: habits.id, name: habits.name, colour: categories.colour })
        .from(habits)
        .innerJoin(categories, eq(habits.categoryId, categories.id))
        .where(eq(habits.userId, user.id));

      if (trackedHabits.length === 0) {
        setData({ completedDays: 0, currentStreak: 0, bestStreak: 0, thisWeekCompletedDays: 0, weeklyCompletion: [], habitProgress: [], recentMissedDays: [] });
        return;
      }

      const habitIds = trackedHabits.map((h) => h.habitId);
      const logs = await db
        .select({ date: habitLogs.date, habitId: habitLogs.habitId, completed: habitLogs.completed })
        .from(habitLogs)
        .where(and(gte(habitLogs.date, sixMonthsAgo), lte(habitLogs.date, todayStr), inArray(habitLogs.habitId, habitIds)));

      const dayMap = getCompletedDayMap(logs);
      const trackedDates = Array.from(dayMap.keys()).sort();
      const latestTracked = trackedDates[trackedDates.length - 1] ?? todayStr;
      const refDate = latestTracked < todayStr ? latestTracked : todayStr;
      const weekStart = toDateString(getWeekStart(new Date(refDate + 'T12:00:00')));
      const weeklyCompletion = getWeeklyCompletion(dayMap, trackedHabits.length, refDate, 6);

      // Build habit progress for the current week
      const weekCounts = new Map<number, number>();
      for (const log of logs) {
        if (log.completed !== 1 || log.date < weekStart || log.date > refDate) continue;
        weekCounts.set(log.habitId, (weekCounts.get(log.habitId) ?? 0) + 1);
      }
      const habitProgress: HabitWeekProgress[] = trackedHabits.map((h) => ({
        habitId: h.habitId,
        name: h.name.replace(/\s*\(.*?\)/g, '').trim(),
        colour: h.colour,
        completedDays: weekCounts.get(h.habitId) ?? 0,
        targetDays: 7,
      }));

      // Find up to 4 recent days that weren't fully completed
      const recentMissedDays: RecentMissedDay[] = [...trackedDates]
        .reverse()
        .filter((date) => (dayMap.get(date)?.size ?? 0) !== trackedHabits.length)
        .slice(0, 4)
        .map((date) => {
          const done = dayMap.get(date) ?? new Set<number>();
          return {
            date,
            label: formatShortDate(date),
            missedHabits: trackedHabits
              .filter((h) => !done.has(h.habitId))
              .map((h) => h.name.replace(/\s*\(.*?\)/g, '').trim()),
          };
        });

      setData({
        completedDays: trackedDates.filter((d) => (dayMap.get(d)?.size ?? 0) === trackedHabits.length).length,
        currentStreak: getCurrentStreak(dayMap, trackedHabits.length, refDate, trackedDates[0]),
        bestStreak: getBestStreak(dayMap, trackedHabits.length, trackedDates),
        thisWeekCompletedDays: weeklyCompletion[weeklyCompletion.length - 1]?.completedDays ?? 0,
        weeklyCompletion,
        habitProgress,
        recentMissedDays,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadInsights(); }, [loadInsights]));

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: Colors[scheme].background }]}>
        <ActivityIndicator size="large" color={Colors[scheme].tint} />
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
        <ThemedText style={styles.pageTitle}>Insights</ThemedText>
        <ThemedText style={[styles.pageSubtitle, { color: muted(scheme) }]}>
          {data.thisWeekCompletedDays === 0
            ? 'No completed days yet this week.'
            : `${data.thisWeekCompletedDays} of 7 days have been fully completed this week.`}
        </ThemedText>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <SummaryCard data={data} scheme={scheme} />
        <WeeklyChart weeks={data.weeklyCompletion} scheme={scheme} />
        <HabitProgress habits={data.habitProgress} scheme={scheme} />
        <MissedDays items={data.recentMissedDays} scheme={scheme} />
        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageHeader: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  pageSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 4, maxWidth: 320 },
  scroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 12 },
  section: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: { marginBottom: 12, gap: 3 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: accent },
  sectionSubtitle: { fontSize: 12, lineHeight: 16 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 14,
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '47%',
    paddingBottom: 8,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryValue: { fontSize: 18, lineHeight: 23, fontWeight: '700' },
  summaryLabel: { fontSize: 12, lineHeight: 16 },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 2,
  },
  chartColumn: { flex: 1, alignItems: 'center', gap: 8 },
  chartValueBox: { minHeight: 18, alignItems: 'center', justifyContent: 'center' },
  chartValue: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: accent },
  chartTrack: {
    width: '100%',
    maxWidth: 34,
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: { width: '100%', borderRadius: 5 },
  chartLabel: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
  progressList: { gap: 12 },
  progressItem: { gap: 4 },
  missedList: { gap: 8 },
  missedRow: { paddingBottom: 9, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  missedDate: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  missedHabitText: { fontSize: 13, lineHeight: 18 },
  emptyText: { fontSize: 13, lineHeight: 18 },
});
