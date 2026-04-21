import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, } from 'react-native';

// Theme colors

const Theme = {
  green:        '#2D6A4F',
  cardBgLight:  '#F7F6F4',
  cardBgDark:   '#1E1E1E',
  statBgLight:  '#EFEDE9',
  statBgDark:   '#252525',
  mutedLight:   '#6B6560',
  mutedDark:    '#9A9590',
  dividerLight: '#E8E5E0',
  dividerDark:  '#2C2C2C',
  exercise:     '#3A7D5A',
  hydration:    '#2E6E8E',
  nutrition:    '#B07D3A',
  mind:         '#6B5B8A',
};

// Static tasks

type HabitRow = {
  id: number;
  name: string;
  type: 'boolean' | 'count';
  completed: boolean;
  count: number;
  streak: number;
  weeklyDone: number;
  weeklyGoal: number;
};

type CategoryGroup = {
  id: number;
  name: string;
  colour: string;
  icon: string;
  habits: HabitRow[];
};

// Hardcoded initial data
const INITIAL_GROUPS: CategoryGroup[] = [
  {
    id: 1,
    name: 'Exercise',
    colour: Theme.exercise,
    icon: '🏃',
    habits: [
      { id: 1, name: 'Workout 1 (45 min)', type: 'boolean', completed: false, count: 0, streak: 12, weeklyDone: 4, weeklyGoal: 7 },
      { id: 2, name: 'Workout 2 — Outdoor (45 min)', type: 'boolean', completed: false, count: 0, streak: 12, weeklyDone: 4, weeklyGoal: 7 },
    ],
  },
  {
    id: 2,
    name: 'Hydration',
    colour: Theme.hydration,
    icon: '💧',
    habits: [
      { id: 3, name: 'Drink 1 Gallon of Water', type: 'count', completed: false, count: 0, streak: 18, weeklyDone: 5, weeklyGoal: 7 },
    ],
  },
  {
    id: 3,
    name: 'Nutrition',
    colour: Theme.nutrition,
    icon: '🥗',
    habits: [
      { id: 4, name: 'Follow Diet Plan', type: 'boolean', completed: false, count: 0, streak: 9, weeklyDone: 5, weeklyGoal: 7 },
      { id: 5, name: 'No Alcohol or Cheat Meals', type: 'boolean', completed: false, count: 0, streak: 9, weeklyDone: 5, weeklyGoal: 7 },
    ],
  },
  {
    id: 4,
    name: 'Mindfulness',
    colour: Theme.mind,
    icon: '📖',
    habits: [
      { id: 6, name: 'Read 10 Pages of Nonfiction', type: 'boolean', completed: false, count: 0, streak: 21, weeklyDone: 6, weeklyGoal: 7 },
    ],
  },
];

// Progress Bar 
function ProgressBar({ done, goal, colour }: { done: number; goal: number; colour: string }) {
  const pct = goal > 0 ? Math.min(done / goal, 1) : 0;
  return (
    <View style={bar.track}>
      <View style={[bar.fill, { width: `${pct * 100}%`, backgroundColor: colour }]} />
    </View>
  );
}

const bar = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: '#00000010', overflow: 'hidden', flex: 1 },
  fill: { height: 4, borderRadius: 2 },
});

// Count Stepper 
function CountStepper({
  value,
  colour,
  onDecrement,
  onIncrement,
}: {
  value: number;
  colour: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={stepper.row}>
      <TouchableOpacity
        style={[stepper.btn, { borderColor: colour + '88' }]}
        onPress={onDecrement}
        hitSlop={8}
      >
        <ThemedText style={[stepper.btnText, { color: colour }]}>−</ThemedText>
      </TouchableOpacity>
      <ThemedText style={stepper.value}>{value}</ThemedText>
      <TouchableOpacity
        style={[stepper.btn, { borderColor: colour, backgroundColor: colour }]}
        onPress={onIncrement}
        hitSlop={8}
      >
        <ThemedText style={[stepper.btnText, { color: '#fff' }]}>+</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const stepper = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 17, lineHeight: 20, fontWeight: '600' },
  value: { fontSize: 17, fontWeight: '700', minWidth: 26, textAlign: 'center' },
});

function RuleRow({ habit, colour, scheme, onToggle, onCount, isLast }: {
  habit: HabitRow;
  colour: string;
  scheme: 'light' | 'dark';
  onToggle: (id: number) => void;
  onCount: (id: number, newCount: number) => void;
  isLast: boolean;
}) {
  const muted = scheme === 'dark' ? Theme.mutedDark : Theme.mutedLight;
  const divider = scheme === 'dark' ? Theme.dividerDark : Theme.dividerLight;

  return (
    <View
      style={[
        row.container,
        !isLast && { borderBottomColor: divider, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={row.info}>
        <View style={row.nameRow}>
          <ThemedText style={[row.name, habit.completed && row.nameDone]}>
            {habit.name}
          </ThemedText>
          {habit.streak > 0 && (
            <ThemedText style={[row.streak, { color: colour }]}>
              🔥 {habit.streak}
            </ThemedText>
          )}
        </View>
        <View style={row.targetRow}>
          <ProgressBar done={habit.weeklyDone} goal={habit.weeklyGoal} colour={colour} />
          <ThemedText style={[row.targetLabel, { color: muted }]}>
            {habit.weeklyDone}/{habit.weeklyGoal} wk
          </ThemedText>
        </View>
      </View>

      {habit.type === 'boolean' ? (
        <TouchableOpacity
          onPress={() => onToggle(habit.id)}
          style={[
            row.checkbox,
            habit.completed
              ? { backgroundColor: colour, borderColor: colour }
              : { borderColor: colour + '66' },
          ]}
          hitSlop={8}
        >
          {habit.completed && <ThemedText style={row.checkMark}>✓</ThemedText>}
        </TouchableOpacity>
      ) : (
        <CountStepper
          value={habit.count}
          colour={colour}
          onDecrement={() => onCount(habit.id, Math.max(0, habit.count - 1))}
          onIncrement={() => onCount(habit.id, habit.count + 1)}
        />
      )}
    </View>
  );
}

const row = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  info: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '500', flex: 1 },
  nameDone: { opacity: 0.4 },
  streak: { fontSize: 11, fontWeight: '600' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetLabel: { fontSize: 11, minWidth: 48 },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// Rule Group Card 

function RuleGroup({
  group,
  scheme,
  onToggle,
  onCount,
}: {
  group: CategoryGroup;
  scheme: 'light' | 'dark';
  onToggle: (id: number) => void;
  onCount: (id: number, count: number) => void;
}) {
  const cardBg = scheme === 'dark' ? Theme.cardBgDark : Theme.cardBgLight;
  const muted = scheme === 'dark' ? Theme.mutedDark : Theme.mutedLight;
  const done = group.habits.filter((h) => h.completed).length;
  const total = group.habits.length;
  const allDone = done === total;

  return (
    <View style={[grp.card, { backgroundColor: cardBg }]}>
      {/* Header */}
      <View style={grp.header}>
        <View style={grp.titleRow}>
          <View style={[grp.iconDot, { backgroundColor: group.colour }]}>
            <ThemedText style={grp.dotIcon}>{group.icon}</ThemedText>
          </View>
          <ThemedText style={grp.groupName}>{group.name}</ThemedText>
        </View>

        <View style={grp.headerRight}>
          <ThemedText style={[grp.count, { color: muted }]}>{done}/{total}</ThemedText>
          {allDone && (
            <View style={[grp.doneBadge, { backgroundColor: Theme.green }]}>
              <ThemedText style={grp.doneBadgeText}>✓</ThemedText>
            </View>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <ProgressBar done={done} goal={total} colour={group.colour} />

      {/* Habit rows */}
      {group.habits.map((habit, i) => (
        <RuleRow
          key={habit.id}
          habit={habit}
          colour={group.colour}
          scheme={scheme}
          onToggle={onToggle}
          onCount={onCount}
          isLast={i === group.habits.length - 1}
        />
      ))}
    </View>
  );
}

const grp = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconDot: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotIcon: { fontSize: 16 },
  groupName: { fontSize: 15, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontSize: 13, fontWeight: '600' },
  doneBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

// Challenge Screen

export default function ChallengeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [groups, setGroups] = useState<CategoryGroup[]>(INITIAL_GROUPS);
  const muted = scheme === 'dark' ? Theme.mutedDark : Theme.mutedLight;

  function handleToggle(habitId: number) {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        habits: g.habits.map((h) =>
          h.id === habitId ? { ...h, completed: !h.completed } : h
        ),
      }))
    );
  }

  function handleCount(habitId: number, newCount: number) {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        habits: g.habits.map((h) =>
          h.id === habitId ? { ...h, count: newCount, completed: newCount > 0 } : h
        ),
      }))
    );
  }

  const totalHabits = groups.reduce((s, g) => s + g.habits.length, 0);
  const doneHabits = groups.reduce((s, g) => s + g.habits.filter((h) => h.completed).length, 0);
  const allDone = doneHabits === totalHabits && totalHabits > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors[scheme].background }}
      contentContainerStyle={styles.scroll}
    >
      {/* Summary line */}
      <View style={styles.summaryRow}>
        <ThemedText style={[styles.summaryText, { color: muted }]}>
          {doneHabits} of {totalHabits} rules completed today
        </ThemedText>
        {allDone && (
          <View style={styles.allDonePill}>
            <ThemedText style={styles.allDoneText}>Perfect Day</ThemedText>
          </View>
        )}
      </View>

      {groups.map((group) => (
        <RuleGroup
          key={group.id}
          group={group}
          scheme={scheme}
          onToggle={handleToggle}
          onCount={handleCount}
        />
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 12 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryText: { fontSize: 13 },
  allDonePill: {
    backgroundColor: Theme.green,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  allDoneText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
