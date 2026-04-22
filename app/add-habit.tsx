import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { db } from '@/db/client';
import { categories, habits, targets } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { id: number; name: string; colour: string; icon: string };
type HabitType = 'boolean' | 'count';
type Period = 'weekly' | 'monthly';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <ThemedText style={styles.label}>{text}</ThemedText>;
}

function OptionPill<T extends string | number>({
  value,
  selected,
  label,
  colour,
  onPress,
  scheme,
}: {
  value: T;
  selected: boolean;
  label: string;
  colour: string;
  onPress: (v: T) => void;
  scheme: 'light' | 'dark';
}) {
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        selected
          ? { backgroundColor: colour, borderColor: colour }
          : {
              borderColor: scheme === 'dark' ? '#3A3D3E' : '#D1D5DB',
              backgroundColor: 'transparent',
            },
      ]}
      onPress={() => onPress(value)}
      activeOpacity={0.75}
    >
      <ThemedText
        style={[
          styles.pillText,
          { color: selected ? '#fff' : scheme === 'dark' ? '#E5E7EB' : '#111827' },
        ]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

// ─── Add Habit Screen ─────────────────────────────────────────────────────────

export default function AddHabitScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const tint = Colors[scheme].tint;
  const cardBg = scheme === 'dark' ? '#1E2022' : '#F8F9FA';
  const inputBg = scheme === 'dark' ? '#151718' : '#fff';
  const borderCol = scheme === 'dark' ? '#3A3D3E' : '#D1D5DB';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';

  // ── Form state ──
  const [name, setName] = useState('');
  const [habitType, setHabitType] = useState<HabitType>('boolean');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>('weekly');
  const [goalCount, setGoalCount] = useState('');

  // ── Data ──
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Validation errors ──
  const [errors, setErrors] = useState<{ name?: string; category?: string; goal?: string }>({});

  useEffect(() => {
    db.select().from(categories).then((rows) => {
      setCategoryList(rows);
      setLoadingCats(false);
    });
  }, []);

  // ── Validation ──
  function validate(): boolean {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Habit name is required.';
    if (selectedCategory === null) e.category = 'Please choose a category.';
    if (goalCount !== '') {
      const n = Number(goalCount);
      if (!Number.isInteger(n) || n < 1) e.goal = 'Goal must be a whole number ≥ 1.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Save ──
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // INSERT habit — clearly demonstrating CREATE
      const [inserted] = await db
        .insert(habits)
        .values({
          userId: 1,
          categoryId: selectedCategory!,
          name: name.trim(),
          type: habitType,
          createdAt: today,
        })
        .returning();

      // INSERT target if a goal was supplied
      if (goalCount !== '') {
        await db.insert(targets).values({
          habitId: inserted.id,
          period,
          goalCount: Number(goalCount),
        });
      }

      router.back();
    } catch (e) {
      Alert.alert('Error', 'Could not save habit. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const selectedCat = categoryList.find((c) => c.id === selectedCategory);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors[scheme].background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Habit Name ── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <SectionLabel text="Habit name" />
          <TextInput
            style={[
              styles.input,
              { backgroundColor: inputBg, borderColor: errors.name ? '#EF4444' : borderCol, color: Colors[scheme].text },
            ]}
            placeholder="e.g. Morning Run"
            placeholderTextColor={muted}
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined })); }}
            maxLength={60}
            returnKeyType="done"
          />
          {errors.name && <ThemedText style={styles.errorText}>{errors.name}</ThemedText>}
        </View>

        {/* ── Category ── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <SectionLabel text="Category" />
          {loadingCats ? (
            <ActivityIndicator color={tint} />
          ) : (
            <View style={styles.pillRow}>
              {categoryList.map((cat) => (
                <OptionPill
                  key={cat.id}
                  value={cat.id}
                  selected={selectedCategory === cat.id}
                  label={`${cat.icon} ${cat.name}`}
                  colour={cat.colour}
                  onPress={(id) => { setSelectedCategory(id); setErrors((e) => ({ ...e, category: undefined })); }}
                  scheme={scheme}
                />
              ))}
            </View>
          )}
          {errors.category && <ThemedText style={styles.errorText}>{errors.category}</ThemedText>}
        </View>

        {/* ── Habit Type ── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <SectionLabel text="Habit type" />
          <View style={styles.pillRow}>
            <OptionPill
              value="boolean"
              selected={habitType === 'boolean'}
              label="✓  Done / Not done"
              colour={selectedCat?.colour ?? tint}
              onPress={setHabitType}
              scheme={scheme}
            />
            <OptionPill
              value="count"
              selected={habitType === 'count'}
              label="# Count-based"
              colour={selectedCat?.colour ?? tint}
              onPress={setHabitType}
              scheme={scheme}
            />
          </View>
          <ThemedText style={[styles.hint, { color: muted }]}>
            {habitType === 'boolean'
              ? 'Mark as complete once per day (e.g. Meditate, Journal).'
              : 'Log a number each day (e.g. Glasses of water, Steps).'}
          </ThemedText>
        </View>

        {/* ── Target ── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <SectionLabel text="Target (optional)" />

          {/* Period toggle */}
          <View style={styles.pillRow}>
            <OptionPill
              value="weekly"
              selected={period === 'weekly'}
              label="Weekly"
              colour={selectedCat?.colour ?? tint}
              onPress={setPeriod}
              scheme={scheme}
            />
            <OptionPill
              value="monthly"
              selected={period === 'monthly'}
              label="Monthly"
              colour={selectedCat?.colour ?? tint}
              onPress={setPeriod}
              scheme={scheme}
            />
          </View>

          {/* Goal number */}
          <View style={styles.goalRow}>
            <TextInput
              style={[
                styles.goalInput,
                { backgroundColor: inputBg, borderColor: errors.goal ? '#EF4444' : borderCol, color: Colors[scheme].text },
              ]}
              placeholder={period === 'weekly' ? 'e.g. 5' : 'e.g. 20'}
              placeholderTextColor={muted}
              value={goalCount}
              onChangeText={(t) => { setGoalCount(t.replace(/[^0-9]/g, '')); setErrors((e) => ({ ...e, goal: undefined })); }}
              keyboardType="number-pad"
              maxLength={4}
            />
            <ThemedText style={[styles.goalUnit, { color: muted }]}>
              {habitType === 'boolean'
                ? `days per ${period === 'weekly' ? 'week' : 'month'}`
                : `times per ${period === 'weekly' ? 'week' : 'month'}`}
            </ThemedText>
          </View>
          {errors.goal && <ThemedText style={styles.errorText}>{errors.goal}</ThemedText>}
          {goalCount === '' && (
            <ThemedText style={[styles.hint, { color: muted }]}>
              Leave blank to track without a target.
            </ThemedText>
          )}
        </View>

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: selectedCat?.colour ?? tint },
            saving && { opacity: 0.6 },
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Habit</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 16 },

  card: { borderRadius: 16, padding: 16, marginBottom: 12, gap: 12 },

  label: { fontSize: 13, fontWeight: '600', opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5 },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillText: { fontSize: 14, fontWeight: '500' },

  hint: { fontSize: 12, lineHeight: 18 },
  errorText: { fontSize: 12, color: '#EF4444' },

  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    width: 90,
    textAlign: 'center',
  },
  goalUnit: { fontSize: 14, flex: 1 },

  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
