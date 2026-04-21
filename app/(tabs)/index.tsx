import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';


const Theme = {
  // Hero banner
  heroBgLight:   '#1C1C1E',
  heroBgDark:    '#141414',
  heroAccent:    '#C9A84C',
  heroAccentDim: '#C9A84C66',
  heroText:      '#F5F0E8',
  heroTextDim:   '#F5F0E899',

  // Completion / success
  green:         '#2D6A4F',
  greenLight:    '#2D6A4F18',

  // Card surfaces
  cardBgLight:   '#F7F6F4',
  cardBgDark:    '#1E1E1E',

  // Stat cards
  statBgLight:   '#EFEDE9',
  statBgDark:    '#252525',

  // Muted text
  mutedLight:    '#6B6560',
  mutedDark:     '#9A9590',

  // Dividers
  dividerLight:  '#E8E5E0',
  dividerDark:   '#2C2C2C',

  // Category accent colours 
  exercise:  '#3A7D5A',
  hydration: '#2E6E8E',
  nutrition: '#B07D3A',
  mind:      '#6B5B8A',
};

// Static challenge config

const CHALLENGE_START = new Date('2026-03-01');
const CHALLENGE_DAYS = 75;

function getDayNumber(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(CHALLENGE_START);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(diff + 1, CHALLENGE_DAYS));
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// Static tasks

type Task = {
  id: number;
  name: string;
  categoryName: string;
  categoryColour: string;
  categoryIcon: string;
  completed: boolean;
  streak: number;
  weeklyDone: number;
  weeklyGoal: number;
};

const INITIAL_TASKS: Task[] = [
  {
    id: 1,
    name: 'Workout 1 (45 min)',
    categoryName: 'Exercise',
    categoryColour: Theme.exercise,
    categoryIcon: '🏃',
    completed: false,
    streak: 12,
    weeklyDone: 4,
    weeklyGoal: 7,
  },
  {
    id: 2,
    name: 'Workout 2 — Outdoor (45 min)',
    categoryName: 'Exercise',
    categoryColour: Theme.exercise,
    categoryIcon: '🏃',
    completed: false,
    streak: 12,
    weeklyDone: 4,
    weeklyGoal: 7,
  },
  {
    id: 3,
    name: 'Drink 1 Gallon of Water',
    categoryName: 'Hydration',
    categoryColour: Theme.hydration,
    categoryIcon: '💧',
    completed: false,
    streak: 18,
    weeklyDone: 5,
    weeklyGoal: 7,
  },
  {
    id: 4,
    name: 'Follow Diet Plan',
    categoryName: 'Nutrition',
    categoryColour: Theme.nutrition,
    categoryIcon: '🥗',
    completed: false,
    streak: 9,
    weeklyDone: 5,
    weeklyGoal: 7,
  },
  {
    id: 5,
    name: 'No Alcohol or Cheat Meals',
    categoryName: 'Nutrition',
    categoryColour: Theme.nutrition,
    categoryIcon: '🥗',
    completed: false,
    streak: 9,
    weeklyDone: 5,
    weeklyGoal: 7,
  },
  {
    id: 6,
    name: 'Read 10 Pages of Nonfiction',
    categoryName: 'Mindfulness',
    categoryColour: Theme.mind,
    categoryIcon: '📖',
    completed: false,
    streak: 21,
    weeklyDone: 6,
    weeklyGoal: 7,
  },
];

// Challenge Banner 

function ChallengeBanner({ dayNumber, scheme }: { dayNumber: number; scheme: 'light' | 'dark' }) {
  const remaining = Math.max(0, CHALLENGE_DAYS - dayNumber);
  const progress = dayNumber / CHALLENGE_DAYS;
  const bg = scheme === 'dark' ? Theme.heroBgDark : Theme.heroBgLight;

  return (
    <View style={[banner.container, { backgroundColor: bg }]}>
      {/* Left — day counter */}
      <View style={banner.left}>
        <ThemedText style={banner.dayLabel}>DAY</ThemedText>
        <ThemedText style={banner.dayNumber}>{dayNumber}</ThemedText>
        <ThemedText style={banner.dayOf}>of {CHALLENGE_DAYS}</ThemedText>
      </View>

      {/* Divider */}
      <View style={banner.divider} />

      {/* Centre — title + progress */}
      <View style={banner.center}>
        <ThemedText style={banner.challengeTitle}>75 HARD</ThemedText>
        <ThemedText style={banner.challengeSub}>Mental Toughness Program</ThemedText>

        {/* Gold progress bar */}
        <View style={banner.progressTrack}>
          <View style={[banner.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <ThemedText style={banner.progressLabel}>
          {Math.round(progress * 100)}% complete
        </ThemedText>
      </View>

      {/* Divider */}
      <View style={banner.divider} />

      {/* Right — days remaining */}
      <View style={banner.right}>
        <ThemedText style={banner.remainLabel}>LEFT</ThemedText>
        <ThemedText style={banner.remainNumber}>{remaining}</ThemedText>
        <ThemedText style={banner.remainLabel}>days</ThemedText>
      </View>
    </View>
  );
}

const banner = StyleSheet.create({
  container: {
    borderRadius: 18,
    padding: 22,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  divider: {
    width: 1,
    height: 52,
    backgroundColor: '#FFFFFF14',
  },
  left: { alignItems: 'center', minWidth: 40 },
  dayLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: Theme.heroAccentDim },
  dayNumber: { fontSize: 34, fontWeight: '800', lineHeight: 38, color: Theme.heroAccent },
  dayOf: { fontSize: 10, fontWeight: '500', color: Theme.heroTextDim },
  center: { flex: 1, gap: 4, alignItems: 'flex-start' },
  challengeTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 3,
    color: Theme.heroText,
  },
  challengeSub: { fontSize: 10, color: Theme.heroTextDim, marginBottom: 8, letterSpacing: 0.3 },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#FFFFFF14',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Theme.heroAccent,
    borderRadius: 2,
  },
  progressLabel: { fontSize: 10, color: Theme.heroTextDim, marginTop: 4 },
  right: { alignItems: 'center', minWidth: 40 },
  remainNumber: { fontSize: 28, fontWeight: '800', lineHeight: 32, color: Theme.heroText },
  remainLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 1, color: Theme.heroTextDim },
});

// Daily Stats 

function DailyStats({
  completed,
  total,
  streak,
  scheme,
}: {
  completed: number;
  total: number;
  streak: number;
  scheme: 'light' | 'dark';
}) { 
  const cardBg = scheme === 'dark' ? Theme.statBgDark : Theme.statBgLight;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = completed === total && total > 0;
  const muted = scheme === 'dark' ? Theme.mutedDark : Theme.mutedLight;

  return (
    <View style={stats.row}>
      <View style={[stats.card, { backgroundColor: cardBg }]}>
        <ThemedText style={stats.statValue}>{completed}/{total}</ThemedText>
        <ThemedText style={[stats.statLabel, { color: muted }]}>Done today</ThemedText>
      </View>

      <View
        style={[
          stats.card,
          stats.cardCenter,
          { backgroundColor: allDone ? Theme.green : cardBg },
        ]}
      >
        <ThemedText style={[stats.statValueLarge, allDone && { color: '#fff' }]}>
          {percentage}%
        </ThemedText>
        <ThemedText style={[stats.statLabel, { color: allDone ? '#ffffff88' : muted }]}>
          {allDone ? 'Complete' : 'Progress'}
        </ThemedText>
      </View>

      <View style={[stats.card, { backgroundColor: cardBg }]}>
        <ThemedText style={stats.statValue}>🔥 {streak}</ThemedText>
        <ThemedText style={[stats.statLabel, { color: muted }]}>Day streak</ThemedText>
      </View>
    </View>
  );
}

const stats = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  card: { flex: 1, borderRadius: 13, padding: 14, alignItems: 'center', gap: 3 },
  cardCenter: { flex: 1.2 },
  statValue: { fontSize: 17, fontWeight: '700' },
  statValueLarge: { fontSize: 21, fontWeight: '800' },
  statLabel: { fontSize: 11, textAlign: 'center' },
});

// Task Card

function TaskCard({
  task,
  onToggle,
  scheme,
}: {
  task: Task;
  onToggle: (id: number) => void;
  scheme: 'light' | 'dark';
}) {
  const cardBg = scheme === 'dark' ? Theme.cardBgDark : Theme.cardBgLight;
  const muted = scheme === 'dark' ? Theme.mutedDark : Theme.mutedLight;
  const done = task.completed;

  return (
    <TouchableOpacity
      style={[card.container, { backgroundColor: cardBg }, done && card.containerDone]}
      onPress={() => onToggle(task.id)}
      activeOpacity={0.7}
    >
      {/* Left accent bar — full colour when done, ghost when pending */}
      <View
        style={[
          card.accent,
          { backgroundColor: done ? task.categoryColour : task.categoryColour + '40' },
        ]}
      />

      <View style={card.body}>
        <View style={card.topRow}>
          {/* Icon chip */}
          <View style={[card.iconChip, { backgroundColor: task.categoryColour + '16' }]}>
            <ThemedText style={card.iconText}>{task.categoryIcon}</ThemedText>
          </View>

          <View style={card.textBlock}>
            <ThemedText style={[card.name, done && card.nameDone]}>{task.name}</ThemedText>
            <ThemedText style={[card.category, { color: muted }]}>
              {task.categoryName}
              {task.streak > 1 ? `  ·  🔥 ${task.streak}d` : ''}
            </ThemedText>
          </View>

          {/* Completion indicator */}
          <View
            style={[
              card.circle,
              done
                ? { backgroundColor: task.categoryColour, borderColor: task.categoryColour }
                : { borderColor: task.categoryColour + '55' },
            ]}
          >
            {done && <ThemedText style={card.tick}>✓</ThemedText>}
          </View>
        </View>

        {/* Weekly progress */}
        <View style={card.weeklyRow}>
          <View style={card.weeklyTrack}>
            <View
              style={[
                card.weeklyFill,
                {
                  width: `${Math.min((task.weeklyDone / task.weeklyGoal) * 100, 100)}%`,
                  backgroundColor: task.categoryColour,
                },
              ]}
            />
          </View>
          <ThemedText style={[card.weeklyLabel, { color: muted }]}>
            {task.weeklyDone}/{task.weeklyGoal} wk
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  container: {
    borderRadius: 14,
    marginBottom: 9,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  containerDone: { opacity: 0.75 },
  accent: { width: 4 },
  body: { flex: 1, padding: 14, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 19 },
  textBlock: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  nameDone: { opacity: 0.45 },
  category: { fontSize: 12, marginTop: 2 },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { color: '#fff', fontSize: 13, fontWeight: '800' },
  weeklyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weeklyTrack: {
    flex: 1,
    height: 3,
    backgroundColor: '#00000010',
    borderRadius: 2,
    overflow: 'hidden',
  },
  weeklyFill: { height: 3, borderRadius: 2 },
  weeklyLabel: { fontSize: 11 },
});

// Dashboard Screen 

export default function DashboardScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const dayNumber = getDayNumber();

  function handleToggle(id: number) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }

  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const topStreak = tasks.reduce((max, t) => Math.max(max, t.streak), 0);
  const allDone = completed === total && total > 0;
  const muted = scheme === 'dark' ? Theme.mutedDark : Theme.mutedLight;

  const sorted = [...tasks].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors[scheme].background }}
      contentContainerStyle={screen.scroll}
    >
      {/* Date + status */}
      <View style={screen.header}>
        <ThemedText style={[screen.dateLabel, { color: muted }]}>{formatDate()}</ThemedText>
        {allDone && (
          <View style={screen.donePill}>
            <ThemedText style={screen.donePillText}>All Done</ThemedText>
          </View>
        )}
      </View>

      <ChallengeBanner dayNumber={dayNumber} scheme={scheme} />

      <DailyStats completed={completed} total={total} streak={topStreak} scheme={scheme} />

      <ThemedText style={screen.sectionTitle}>{"Today's Checklist"}</ThemedText>

      {sorted.map((t) => (
        <TaskCard key={t.id} task={t} onToggle={handleToggle} scheme={scheme} />
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const screen = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 56 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateLabel: { fontSize: 13, fontWeight: '500' },
  donePill: {
    backgroundColor: Theme.green,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  donePillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.45,
    marginBottom: 12,
  },
});
