import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { db } from '@/db/client';
import { categories, habits, targets } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { eq } from 'drizzle-orm';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Category = { id: number; name: string; colour: string; icon: string };
type Period = 'weekly' | 'monthly';
type HabitType = 'boolean' | 'count';

function SectionLabel({ text }: { text: string }) {
  return <ThemedText style={styles.label}>{text}</ThemedText>;
}

function OptionPill<T extends string | number>({ value, selected, label, colour, onPress, scheme }: {
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

function CategoryOption({ category, selected, scheme, onPress }: {
  category: Category;
  selected: boolean;
  scheme: 'light' | 'dark';
  onPress: (id: number) => void;
}) {
  const borderColor = selected
    ? category.colour
    : scheme === 'dark'
      ? '#3A3D3E'
      : '#D1D5DB';
  const backgroundColor = selected
    ? category.colour + '18'
    : scheme === 'dark'
      ? '#151718'
      : '#FFFFFF';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';

  return (
    <TouchableOpacity
      style={[
        styles.categoryOption,
        { borderColor, backgroundColor },
      ]}
      onPress={() => onPress(category.id)}
      activeOpacity={0.8}
    >
      <View style={[styles.categoryBadge, { backgroundColor: category.colour + '22' }]}>
        <Text style={styles.categoryBadgeText}>{category.icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={styles.categoryOptionTitle}>{category.name}</ThemedText>
        <ThemedText style={[styles.categoryOptionSub, { color: muted }]}>
          {selected ? 'Selected' : 'Tap to choose'}
        </ThemedText>
      </View>
      {selected ? <Text style={[styles.categoryCheck, { color: category.colour }]}>✓</Text> : null}
    </TouchableOpacity>
  );
}

export default function AddHabitScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { habitId: habitIdParam } = useLocalSearchParams<{ habitId?: string }>();
  const editingId = habitIdParam ? Number(habitIdParam) : null;

  const tint = Colors[scheme].tint;
  const cardBg = scheme === 'dark' ? '#1E2022' : '#F8F9FA';
  const inputBg = scheme === 'dark' ? '#151718' : '#fff';
  const borderCol = scheme === 'dark' ? '#3A3D3E' : '#D1D5DB';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';

  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>('weekly');
  const [habitType, setHabitType] = useState<HabitType>('boolean');
  const [goalCount, setGoalCount] = useState('');

  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState<{ name?: string; category?: string; goal?: string }>({});

  useEffect(() => {
    navigation.setOptions({ title: editingId ? 'Edit habit' : 'Add habit' });
  }, [navigation, editingId]);

  useEffect(() => {
    async function init() {
      const cats = await db.select().from(categories).where(eq(categories.userId, user!.id));
      setCategoryList(cats);
      setLoadingCats(false);

      if (editingId) {
        const [habit] = await db.select().from(habits).where(eq(habits.id, editingId));
        if (habit) {
          setName(habit.name);
          setSelectedCategory(habit.categoryId);
          setHabitType(habit.type as HabitType);
        }
        const [target] = await db.select().from(targets).where(eq(targets.habitId, editingId));
        if (target) {
          setPeriod(target.period as Period);
          setGoalCount(String(target.goalCount));
        }
      }
    }
    init();
  }, [editingId]);

  function validate(): boolean {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Habit name is required.';
    if (selectedCategory === null) e.category = 'Please choose a category.';
    if (goalCount !== '') {
      const n = Number(goalCount);
      if (!Number.isInteger(n) || n < 1) e.goal = 'Goal must be a whole number of 1 or more.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editingId) {
        await db
          .update(habits)
          .set({ categoryId: selectedCategory!, name: name.trim(), type: habitType })
          .where(eq(habits.id, editingId));

        await db.delete(targets).where(eq(targets.habitId, editingId));
        if (goalCount !== '') {
          await db.insert(targets).values({
            habitId: editingId,
            period,
            goalCount: Number(goalCount),
          });
        }
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const [inserted] = await db
          .insert(habits)
          .values({
            userId: user!.id,
            categoryId: selectedCategory!,
            name: name.trim(),
            type: habitType,
            createdAt: today,
          })
          .returning();

        if (goalCount !== '') {
          await db.insert(targets).values({
            habitId: inserted.id,
            period,
            goalCount: Number(goalCount),
          });
        }
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
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <SectionLabel text="Habit name" />
          <TextInput
            style={[
              styles.input,
              { backgroundColor: inputBg, borderColor: errors.name ? '#EF4444' : borderCol, color: Colors[scheme].text },
            ]}
            placeholder="e.g. Morning run"
            placeholderTextColor={muted}
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined })); }}
            maxLength={60}
            returnKeyType="done"
          />
          {errors.name && <ThemedText style={styles.errorText}>{errors.name}</ThemedText>}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <SectionLabel text="Category" />
          {loadingCats ? (
            <ActivityIndicator color={tint} />
          ) : (
            <View style={styles.categoryList}>
              {categoryList.map((cat) => (
                <CategoryOption
                  key={cat.id}
                  category={cat}
                  selected={selectedCategory === cat.id}
                  scheme={scheme}
                  onPress={(id) => {
                    setSelectedCategory(id);
                    setErrors((e) => ({ ...e, category: undefined }));
                  }}
                />
              ))}
            </View>
          )}
          {errors.category && <ThemedText style={styles.errorText}>{errors.category}</ThemedText>}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <SectionLabel text="Metric type" />
          <View style={styles.pillRow}>
            <OptionPill
              value="boolean"
              selected={habitType === 'boolean'}
              label="Done / not done"
              colour={selectedCat?.colour ?? tint}
              onPress={setHabitType}
              scheme={scheme}
            />
            <OptionPill
              value="count"
              selected={habitType === 'count'}
              label="Numeric count"
              colour={selectedCat?.colour ?? tint}
              onPress={setHabitType}
              scheme={scheme}
            />
          </View>
          <ThemedText style={[styles.hint, { color: muted }]}>
            {habitType === 'count'
              ? 'Use this for habits you measure with a number, like glasses, steps or meals.'
              : 'Use this for habits you simply complete or skip.'}
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <SectionLabel text="Target (optional)" />

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

          <View style={styles.goalRow}>
            <TextInput
              style={[
                styles.goalInput,
                { backgroundColor: inputBg, borderColor: errors.goal ? '#EF4444' : borderCol, color: Colors[scheme].text },
              ]}
              placeholder={period === 'weekly' ? 'e.g. 5' : 'e.g. 20'}
              placeholderTextColor={muted}
              value={goalCount}
              // Only allow numeric input and update error state on change
              onChangeText={(t) => { setGoalCount(t.replace(/[^0-9]/g, '')); setErrors((e) => ({ ...e, goal: undefined })); }}
              keyboardType="number-pad"
              maxLength={4}
            />
            <ThemedText style={[styles.goalUnit, { color: muted }]}>
              {`days per ${period === 'weekly' ? 'week' : 'month'}`}
            </ThemedText>
          </View>
          {errors.goal && <ThemedText style={styles.errorText}>{errors.goal}</ThemedText>}
          {goalCount === '' && (
            <ThemedText style={[styles.hint, { color: muted }]}>
              Leave blank to track without a target.
            </ThemedText>
          )}
        </View>

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
            <Text style={styles.saveBtnText}>{editingId ? 'Save changes' : 'Save habit'}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingTop: 16 },
  card: { borderRadius: 6, padding: 14, marginBottom: 12, gap: 12 },
  label: { fontSize: 13, fontWeight: '600', opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5 },

  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillText: { fontSize: 14, fontWeight: '500' },
  categoryList: { gap: 10 },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryBadge: {
    width: 40,
    height: 40,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadgeText: { fontSize: 18 },
  categoryOptionTitle: { fontSize: 15, fontWeight: '700' },
  categoryOptionSub: { fontSize: 12 },
  categoryCheck: { fontSize: 18, fontWeight: '700' },

  hint: { fontSize: 12, lineHeight: 18 },
  errorText: { fontSize: 12, color: '#EF4444' },

  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    width: 90,
    textAlign: 'center',
  },
  goalUnit: { fontSize: 14, flex: 1 },

  saveBtn: {
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
