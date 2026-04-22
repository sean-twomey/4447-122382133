import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { db } from '@/db/client';
import { categories, habitLogs, habits } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { and, eq } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Types 
type HabitEntry = {
  id: number;
  name: string;
  type: 'boolean' | 'count';
  categoryColour: string;
  categoryIcon: string;
  completed: boolean;
  count: number;
  logExists: boolean;
};

// Helpers 
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate() {
  return new Date().toLocaleDateString('en-IE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

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
        hitSlop={10}
      >
        <ThemedText style={[stepper.btnText, { color: colour }]}>−</ThemedText>
      </TouchableOpacity>
      <ThemedText style={stepper.value}>{value}</ThemedText>
      <TouchableOpacity
        style={[stepper.btn, { backgroundColor: colour, borderColor: colour }]}
        onPress={onIncrement}
        hitSlop={10}
      >
        <ThemedText style={[stepper.btnText, { color: '#fff' }]}>+</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const stepper = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 20, lineHeight: 22, fontWeight: '600' },
  value: { fontSize: 20, fontWeight: '700', minWidth: 32, textAlign: 'center' },
});

// Habit Row 
function HabitRow({
  entry,
  scheme,
  onToggle,
  onCount,
}: {
  entry: HabitEntry;
  scheme: 'light' | 'dark';
  onToggle: (id: number) => void;
  onCount: (id: number, n: number) => void;
}) {
  const cardBg = scheme === 'dark' ? '#1E1E1E' : '#F7F6F4';
  const { id, name, type, categoryColour, categoryIcon, completed, count } = entry;

  return (
    <View style={[row.card, { backgroundColor: cardBg }]}>
      {/* Left colour accent */}
      <View style={[row.accent, { backgroundColor: completed ? categoryColour : categoryColour + '44' }]} />

      <View style={row.body}>
        {/* Icon + name */}
        <View style={row.top}>
          <View style={[row.iconChip, { backgroundColor: categoryColour + '18' }]}>
            <ThemedText style={row.icon}>{categoryIcon}</ThemedText>
          </View>
          <ThemedText style={[row.name, completed && row.nameDone]}>{name}</ThemedText>
        </View>

        {/* Control */}
        {type === 'boolean' ? (
          <TouchableOpacity
            style={[
              row.checkbox,
              completed
                ? { backgroundColor: categoryColour, borderColor: categoryColour }
                : { borderColor: categoryColour + '66' },
            ]}
            onPress={() => onToggle(id)}
            hitSlop={8}
          >
            {completed && <ThemedText style={row.tick}>✓</ThemedText>}
          </TouchableOpacity>
        ) : (
          <View style={row.countWrap}>
            <ThemedText style={[row.glasses, { color: categoryColour }]}>
              {count} / 16 glasses
            </ThemedText>
            <CountStepper
              value={count}
              colour={categoryColour}
              onDecrement={() => onCount(id, Math.max(0, count - 1))}
              onIncrement={() => onCount(id, count + 1)}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  accent: { width: 5 },
  body: {
    flex: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  top: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  name: { fontSize: 15, fontWeight: '600', flex: 1 },
  nameDone: { opacity: 0.4 },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { color: '#fff', fontSize: 15, fontWeight: '800' },
  countWrap: { alignItems: 'flex-end', gap: 6 },
  glasses: { fontSize: 12, fontWeight: '600' },
});

// Check-In Screen 

export default function CheckInScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const btnColour = '#0a7ea4';

  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load habits + today's logs 
  async function loadTodayState() {
    setLoading(true);
    const today = todayString();

    const rows = await db
      .select({
        habitId: habits.id,
        habitName: habits.name,
        habitType: habits.type,
        categoryColour: categories.colour,
        categoryIcon: categories.icon,
      })
      .from(habits)
      .innerJoin(categories, eq(habits.categoryId, categories.id))
      .orderBy(categories.name, habits.name);

    const todayLogs = await db
      .select()
      .from(habitLogs)
      .where(eq(habitLogs.date, today));

    const built: HabitEntry[] = rows.map((r) => {
      const log = todayLogs.find((l) => l.habitId === r.habitId);
      return {
        id: r.habitId,
        name: r.habitName,
        type: r.habitType as 'boolean' | 'count',
        categoryColour: r.categoryColour,
        categoryIcon: r.categoryIcon,
        completed: (log?.completed ?? 0) === 1,
        count: log?.count ?? 0,
        logExists: !!log,
      };
    });

    setEntries(built);
    setLoading(false);
  }

  useEffect(() => { loadTodayState(); }, []);

  // Local state helpers 
  function toggleBoolean(id: number) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  }

  function updateCount(id: number, n: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, count: n, completed: n > 0 } : e
      )
    );
  }

  // Save, insert or update per habit
  async function handleSave() {
    setSaving(true);
    const today = todayString();
    try {
      for (const entry of entries) {
        if (entry.logExists) {
          // update, log already exists for today
          await db
            .update(habitLogs)
            .set({ completed: entry.completed ? 1 : 0, count: entry.count })
            .where(
              and(
                eq(habitLogs.habitId, entry.id),
                eq(habitLogs.date, today)
              )
            );
        } else {
          // insert, no log yet for today
          await db.insert(habitLogs).values({
            habitId: entry.id,
            date: today,
            completed: entry.completed ? 1 : 0,
            count: entry.count,
          });
        }
      }

      // Reload from db so the screen reflects what was actually persisted
      await loadTodayState();
      Alert.alert("Saved!", "Today's progress has been logged.");
    } catch (e) {
      Alert.alert('Error', 'Could not save. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  // Calculate summary totals for header
  const doneCount = entries.filter((e) => e.completed).length;
  const allDone = doneCount === entries.length && entries.length > 0;

  // Show loading state while habits are being fetched from the database
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors[scheme].background }}>
        <ActivityIndicator size="large" color={btnColour} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors[scheme].background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.title}>Todays Check-In</ThemedText>
        <ThemedText style={styles.date}>{formatDate()}</ThemedText>
      </View>

      {/* Progress summary */}
      <View style={[styles.summary, { backgroundColor: allDone ? '#2D6A4F' : scheme === 'dark' ? '#1E1E1E' : '#F0EDE8' }]}>
        <ThemedText style={[styles.summaryText, allDone && { color: '#fff' }]}>
          {doneCount} of {entries.length} habits completed
        </ThemedText>
        {allDone && (
          <ThemedText style={styles.perfectDay}>Perfect Day 🏆</ThemedText>
        )}
      </View>

      {/* Habit list */}
      {entries.map((entry) => (
        <HabitRow
          key={entry.id}
          entry={entry}
          scheme={scheme}
          onToggle={toggleBoolean}
          onCount={updateCount}
        />
      ))}

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: btnColour }, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save Todays Progress</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Styles 
const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 24 },

  header: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  date: { fontSize: 14, opacity: 0.55, marginTop: 4 },

  summary: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 4,
  },
  summaryText: { fontSize: 15, fontWeight: '600' },
  perfectDay: { color: '#fff', fontSize: 13, fontWeight: '700' },

  saveBtn: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
