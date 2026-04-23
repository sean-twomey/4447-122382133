import { HabitCard, ProgressRow, ScreenHeader, appColors, muted } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { db } from '@/db/client';
import { categories, habitLogs, habits } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { and, eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type HabitType = 'boolean' | 'count';

type HabitEntry = {
  id: number;
  name: string;
  type: HabitType;
  categoryColour: string;
  categoryIcon: string;
  completed: boolean;
  count: number;
  notes: string;
  logExists: boolean;
};

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

// Determines the appropriate unit of measurement for a habit based on its name
function metricUnit(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('water')) return 'glasses';
  if (lower.includes('step')) return 'steps';
  if (lower.includes('meal')) return 'meals';
  return 'count';
}

function metricSummary(entry: HabitEntry) {
  if (entry.type !== 'count') return undefined;
  return `${entry.count} ${metricUnit(entry.name)}`;
}

export default function CheckInScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { user } = useAuth();
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputBg = scheme === 'dark' ? '#2C2C2E' : '#F2F2F7';

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
      .where(eq(habits.userId, user!.id))
      .orderBy(categories.name, habits.name);

    const todayLogs = await db
      .select()
      .from(habitLogs)
      .where(eq(habitLogs.date, today));

    const built: HabitEntry[] = rows.map((row) => {
      const log = todayLogs.find((item) => item.habitId === row.habitId);
      const type = row.habitType as HabitType;
      const count = log?.count ?? 0;

      return {
        id: row.habitId,
        name: row.habitName,
        type,
        categoryColour: row.categoryColour,
        categoryIcon: row.categoryIcon,
        completed: type === 'count' ? count > 0 : (log?.completed ?? 0) === 1,
        count,
        notes: log?.notes ?? '',
        logExists: !!log,
      };
    });

    setEntries(built);
    setLoading(false);
  }

  useEffect(() => {
    loadTodayState();
  }, []);

// Toggles the completion state of a boolean habit entry
  function toggleEntry(id: number) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id || entry.type === 'count') return entry;
        return { ...entry, completed: !entry.completed };
      })
    );
  }

  function changeCount(id: number, nextCount: number) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        const count = Math.max(0, nextCount);
        return { ...entry, count, completed: count > 0 };
      })
    );
  }

  function changeNotes(id: number, notes: string) {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, notes } : entry))
    );
  }

  async function handleSave() {
    setSaving(true);
    const today = todayString();

    try {
      for (const entry of entries) {
        const completed = entry.type === 'count' ? entry.count > 0 : entry.completed;
        const payload = {
          completed: completed ? 1 : 0,
          count: entry.type === 'count' ? entry.count : 0,
          notes: entry.notes.trim() || null,
        };

        if (entry.logExists) {
          await db
            .update(habitLogs)
            .set(payload)
            .where(and(eq(habitLogs.habitId, entry.id), eq(habitLogs.date, today)));
        } else {
          await db.insert(habitLogs).values({
            habitId: entry.id,
            date: today,
            ...payload,
          });
        }
      }

      await loadTodayState();
      Alert.alert('Logged', "Today's habits have been saved.");
    } catch (e) {
      Alert.alert('Error', 'Could not save. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const doneCount = entries.filter((entry) => entry.completed).length;
  const allDone = doneCount === entries.length && entries.length > 0;

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: Colors[scheme].background }]}>
        <ActivityIndicator size="large" color={appColors.tint} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors[scheme].background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader title="Daily check-in" subtitle={formatDate()} scheme={scheme} />

      <ProgressRow
        done={doneCount}
        goal={entries.length}
        colour={allDone ? appColors.success : appColors.tint}
        scheme={scheme}
        label={`${doneCount} of ${entries.length} done`}
        statusText={allDone ? 'Completed' : undefined}
        statusColour={allDone ? appColors.success : undefined}
      />

      {entries.map((entry) => (
        <HabitCard
          key={entry.id}
          name={entry.name}
          icon={entry.categoryIcon}
          colour={entry.categoryColour}
          category={metricSummary(entry)}
          completed={entry.completed}
          scheme={scheme}
          onPress={entry.type === 'boolean' ? () => toggleEntry(entry.id) : undefined}
          onToggle={entry.type === 'boolean' ? () => toggleEntry(entry.id) : undefined}
        >
          {entry.type === 'count' ? (
            <View style={styles.metricBlock}>
              <Text style={[styles.metricLabel, { color: muted(scheme) }]}>Metric</Text>
              <View style={styles.metricRow}>
                <TouchableOpacity
                  style={[styles.metricBtn, { borderColor: entry.categoryColour + '66' }]}
                  onPress={() => changeCount(entry.id, entry.count - 1)}
                >
                  <Text style={[styles.metricBtnText, { color: entry.categoryColour }]}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.metricInput, { backgroundColor: inputBg, color: Colors[scheme].text }]}
                  value={String(entry.count)}
                  onChangeText={(text) => changeCount(entry.id, Number(text.replace(/[^0-9]/g, '')) || 0)}
                  keyboardType="number-pad"
                  accessibilityLabel={`${entry.name} count`}
                />
                <TouchableOpacity
                  style={[styles.metricBtn, { borderColor: entry.categoryColour + '66' }]}
                  onPress={() => changeCount(entry.id, entry.count + 1)}
                >
                  <Text style={[styles.metricBtnText, { color: entry.categoryColour }]}>+</Text>
                </TouchableOpacity>
                <Text style={[styles.metricUnit, { color: muted(scheme) }]}>{metricUnit(entry.name)}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.notesBlock}>
            <Text style={[styles.metricLabel, { color: muted(scheme) }]}>Notes</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: inputBg, color: Colors[scheme].text }]}
              value={entry.notes}
              onChangeText={(text) => changeNotes(entry.id, text)}
              placeholder="Optional note"
              placeholderTextColor={muted(scheme)}
              accessibilityLabel={`${entry.name} notes`}
            />
          </View>
        </HabitCard>
      ))}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saving]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
        accessibilityLabel="Save today's progress"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save today&apos;s log</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingTop: 20 },
  metricBlock: { gap: 8 },
  metricLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricBtnText: { fontSize: 20, fontWeight: '700' },
  metricInput: {
    minWidth: 64,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  metricUnit: { fontSize: 13, flex: 1 },
  notesBlock: { gap: 8 },
  notesInput: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: appColors.tint,
  },
  saving: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
