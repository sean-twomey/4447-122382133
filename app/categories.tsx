import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { db } from '@/db/client';
import { categories, habitLogs, habits, targets } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const PRESET_COLOURS = [
  '#3A7D5A', '#2E6E8E', '#B07D3A', '#6B5B8A',
  '#C0392B', '#27AE60', '#8E44AD', '#D35400',
  '#1A6B8A', '#7D3C98', '#117A65', '#B7950B',
];

const PRESET_ICONS = [ '🏃', '💧', '🥗', '📖', '💪', '😴', '💊', '📝' ];

type Category = { id: number; name: string; colour: string; icon: string };
type ViewMode = 'habits' | 'categories';
type HabitItem = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  categoryColour: string;
  categoryIcon: string;
  completed: boolean;
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
  habits: HabitItem[];
};

type FormState = {
  name: string;
  colour: string;
  icon: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  colour: PRESET_COLOURS[0],
  icon: PRESET_ICONS[0],
};

// Utility functions for date formatting and habit log counting
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

// Component for rendering section titles with captions
function SectionTitle({ title, caption }: { title: string; caption: string }) {
  return (
    <View style={{ gap: 4 }}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <ThemedText style={styles.sectionCaption}>{caption}</ThemedText>
    </View>
  );
}

function SegmentedControl({
  value,
  onChange,
  scheme,
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
  scheme: 'light' | 'dark';
}) {
  const track = scheme === 'dark' ? '#24272A' : '#EFEFEF';
  const active = Colors[scheme].tint;
  const inactiveText = scheme === 'dark' ? '#A8AFB4' : '#5F686D';

  return (
    <View style={[segmented.track, { backgroundColor: track }]}>
      {(['habits', 'categories'] as ViewMode[]).map((item) => {
        const activeTab = value === item;
        return (
          <TouchableOpacity
            key={item}
            style={[
              segmented.tab,
              activeTab && { backgroundColor: active },
            ]}
            onPress={() => onChange(item)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                segmented.tabText,
                { color: activeTab ? '#fff' : inactiveText },
              ]}
            >
              {item === 'habits' ? 'Habits' : 'Categories'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const segmented = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

function ActionButton({ label, onPress, variant, scheme }: {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'secondary';
  scheme: 'light' | 'dark';
}) {
  const tint = Colors[scheme].tint;
  const border = scheme === 'dark' ? '#303438' : '#D9DEE2';
  const backgroundColor = variant === 'primary' ? tint : 'transparent';
  const color = variant === 'primary' ? '#fff' : Colors[scheme].text;

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        variant === 'secondary' && { borderWidth: 1.5, borderColor: border },
        { backgroundColor },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.actionButtonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ColourPicker({ selected, onSelect }: {
  selected: string;
  onSelect: (c: string) => void;
}) {
  return (
    <View style={picker.grid}>
      {PRESET_COLOURS.map((colour) => (
        <TouchableOpacity
          key={colour}
          style={[
            picker.swatch,
            { backgroundColor: colour },
            selected === colour && picker.swatchSelected,
          ]}
          onPress={() => onSelect(colour)}
          accessibilityState={{ selected: selected === colour }}
        />
      ))}
    </View>
  );
}

function IconPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (icon: string) => void;
}) {
  return (
    <View style={picker.iconGrid}>
      {PRESET_ICONS.map((icon) => (
        <TouchableOpacity
          key={icon}
          style={[picker.iconCell, selected === icon && picker.iconCellSelected]}
          onPress={() => onSelect(icon)}
          accessibilityState={{ selected: selected === icon }}
        >
          <Text style={picker.iconText}>{icon}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const picker = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 4 },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#11181C',
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconCell: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000008',
  },
  iconCellSelected: {
    borderWidth: 2,
    borderColor: '#00000022',
    backgroundColor: '#00000014',
  },
  iconText: { fontSize: 18 },
});

function CategoryForm({ initial, onSave, onCancel, saving, scheme }: {
  initial: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  saving: boolean;
  scheme: 'light' | 'dark';
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [nameError, setNameError] = useState('');
  const inputBg = scheme === 'dark' ? '#151718' : '#fff';
  const border = scheme === 'dark' ? '#3A3D3E' : '#D1D5DB';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1B1D1F' : '#F6F6F6';

  // Utility function to update form state and clear name error when name changes
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'name') setNameError('');
  }

  // Validate form fields and set error messages if validation fails
  function handleSave() {
    if (!form.name.trim()) {
      setNameError('Name is required.');
      return;
    }
    onSave({ ...form, name: form.name.trim() });
  }

  return (
    <View style={[styles.panel, { backgroundColor: cardBg }]}>
      <View style={styles.previewRow}>
        <View style={[styles.previewChip, { backgroundColor: form.colour + '1F' }]}>
          <Text style={styles.previewIcon}>{form.icon}</Text>
          <ThemedText style={styles.previewName}>
            {form.name.trim() || 'Category name'}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.formLabel, { color: muted }]}>Name</ThemedText>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: inputBg,
            borderColor: nameError ? '#EF4444' : border,
            color: Colors[scheme].text,
          },
        ]}
        placeholder="e.g. Fitness"
        placeholderTextColor={muted}
        value={form.name}
        onChangeText={(value) => set('name', value)}
        maxLength={30}
      />
      {nameError ? <ThemedText style={styles.errorText}>{nameError}</ThemedText> : null}

      <ThemedText style={[styles.formLabel, { color: muted }]}>Colour</ThemedText>
      <ColourPicker selected={form.colour} onSelect={(colour) => set('colour', colour)} />

      <ThemedText style={[styles.formLabel, { color: muted }]}>Icon</ThemedText>
      <IconPicker selected={form.icon} onSelect={(icon) => set('icon', icon)} />

      <View style={styles.inlineActionRow}>
        <ActionButton label="Cancel" onPress={onCancel} variant="secondary" scheme={scheme} />
        <ActionButton
          label={saving ? 'Saving...' : 'Save category'}
          onPress={handleSave}
          variant="primary"
          scheme={scheme}
        />
      </View>
    </View>
  );
}

function CategoryCard({ category, habitCount, scheme, onEdit, onDelete }: {
  category: Category;
  habitCount: number;
  scheme: 'light' | 'dark';
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cardBg = scheme === 'dark' ? '#1B1D1F' : '#F6F6F6';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';

  return (
    <View style={[styles.categoryCard, { backgroundColor: cardBg }]}>
      <View style={[styles.categoryAccent, { backgroundColor: category.colour }]} />
      <View style={[styles.categoryIconChip, { backgroundColor: category.colour + '18' }]}>
        <Text style={styles.categoryIcon}>{category.icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
        <ThemedText style={[styles.categoryMeta, { color: muted }]}>
          {habitCount} habit{habitCount === 1 ? '' : 's'}
        </ThemedText>
      </View>
      <TouchableOpacity onPress={onEdit} hitSlop={8} style={styles.textAction}>
        <Text style={[styles.textActionLabel, { color: Colors[scheme].tint }]}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.textAction}>
        <Text style={[styles.textActionLabel, { color: '#EF4444' }]}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatTarget(habit: HabitItem) {
  if (habit.weeklyGoal) return `${habit.weeklyDone}/${habit.weeklyGoal} this week`;
  if (habit.monthlyGoal) return `${habit.monthlyDone}/${habit.monthlyGoal} this month`;
  return 'Tracking with no target';
}

function HabitLine({ habit, scheme, onEdit, onDelete }: {
  habit: HabitItem;
  scheme: 'light' | 'dark';
  onEdit: () => void;
  onDelete: () => void;
}) {
  const divider = scheme === 'dark' ? '#2C2C2C' : '#E8E5E0';
  const muted = scheme === 'dark' ? '#9A9590' : '#6B6560';
  const statusColour = habit.completed ? habit.categoryColour : muted;

  return (
    <View style={[styles.habitRow, { borderTopColor: divider }]}>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.habitNameRow}>
          <ThemedText style={styles.habitName}>{habit.name}</ThemedText>
          <Text style={[styles.statusPill, { color: statusColour }]}>
            {habit.completed ? 'Done today' : 'Open today'}
          </Text>
        </View>
        <ThemedText style={[styles.habitMeta, { color: muted }]}>
          {formatTarget(habit)}
        </ThemedText>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity onPress={onEdit} hitSlop={8}>
          <Text style={[styles.textActionLabel, { color: Colors[scheme].tint }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} hitSlop={8}>
          <Text style={[styles.textActionLabel, { color: '#EF4444' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HabitGroup({ group, scheme, onEditHabit, onDeleteHabit }: {
  group: CategoryGroup;
  scheme: 'light' | 'dark';
  onEditHabit: (habitId: number) => void;
  onDeleteHabit: (habitId: number, habitName: string) => void;
}) {
  const cardBg = scheme === 'dark' ? '#1B1D1F' : '#F6F6F6';
  const muted = scheme === 'dark' ? '#A8AFB4' : '#5F686D';
  const completedCount = group.habits.filter((habit) => habit.completed).length;

  return (
    <View style={[styles.panel, { backgroundColor: cardBg }]}>
      <View style={styles.groupHeader}>
        <View style={styles.groupTitleRow}>
          <View style={[styles.groupIconChip, { backgroundColor: group.colour }]}>
            <Text style={styles.groupIcon}>{group.icon}</Text>
          </View>
          <View style={{ gap: 3 }}>
            <ThemedText style={styles.groupTitle}>{group.name}</ThemedText>
            <ThemedText style={[styles.groupSubtitle, { color: muted }]}>
              {group.habits.length} habit{group.habits.length === 1 ? '' : 's'} · {completedCount} done today
            </ThemedText>
          </View>
        </View>
      </View>

      {group.habits.map((habit) => (
        <HabitLine
          key={habit.id}
          habit={habit}
          scheme={scheme}
          onEdit={() => onEditHabit(habit.id)}
          onDelete={() => onDeleteHabit(habit.id, habit.name)}
        />
      ))}
    </View>
  );
}

// Main screen component for managing categories and habits
export default function CategoriesScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { user } = useAuth();
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const [viewMode, setViewMode] = useState<ViewMode>('habits');
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [habitCounts, setHabitCounts] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  // Load initial data for the screen
  const loadScreen = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date();
      const todayString = toDateString(today);
      const weekStart = getWeekStart(today);
      const monthStart = getMonthStart(today);

      const [categoryRows, habitRows] = await Promise.all([
        db.select().from(categories).where(eq(categories.userId, user.id)),
        db
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
          .orderBy(categories.name, habits.name),
      ]);

      setCategoryList(categoryRows.sort((a, b) => a.name.localeCompare(b.name)));

      // Count habits per category for display in category list
      const counts = new Map<number, number>();
      for (const habit of habitRows) {
        counts.set(habit.categoryId, (counts.get(habit.categoryId) ?? 0) + 1);
      }
      setHabitCounts(counts);

      // If no habits, skip loading logs and targets
      if (habitRows.length === 0) {
        setGroups([]);
        return;
      }

      // Get habit IDs for loading logs and targets
      const habitIds = habitRows.map((row) => row.habitId);
      const [todayLogs, weekLogs, monthLogs, targetRows] = await Promise.all([
        db
          .select({ habitId: habitLogs.habitId, completed: habitLogs.completed })
          .from(habitLogs)
          .where(and(eq(habitLogs.date, todayString), inArray(habitLogs.habitId, habitIds))),
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

      const completedToday = new Set(
        todayLogs.filter((log) => log.completed === 1).map((log) => log.habitId)
      );
      const weeklyDoneByHabit = countCompleted(weekLogs);
      const monthlyDoneByHabit = countCompleted(monthLogs);
      const weeklyGoals = new Map<number, number>();
      const monthlyGoals = new Map<number, number>();

      for (const target of targetRows) {
        if (target.period === 'weekly') weeklyGoals.set(target.habitId, target.goalCount);
        if (target.period === 'monthly') monthlyGoals.set(target.habitId, target.goalCount);
      }

      const grouped = new Map<number, CategoryGroup>();

      // Group habits by category and attach log and target info for display in the habits view
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

        // Find the category group for this habit and add the habit with its log and target info
        grouped.get(row.categoryId)!.habits.push({
          id: row.habitId,
          name: row.habitName,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          categoryColour: row.categoryColour,
          categoryIcon: row.categoryIcon,
          completed: completedToday.has(row.habitId),
          weeklyGoal: weeklyGoals.get(row.habitId) ?? null,
          monthlyGoal: monthlyGoals.get(row.habitId) ?? null,
          weeklyDone: weeklyDoneByHabit.get(row.habitId) ?? 0,
          monthlyDone: monthlyDoneByHabit.get(row.habitId) ?? 0,
        });
      }

      setGroups(Array.from(grouped.values()));
    } catch {
      Alert.alert('Error', 'Could not load habits and categories.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [loadScreen])
  );

  async function refreshAll() {
    await loadScreen();
  }

  function handleOpenAddHabit() {
    if (categoryList.length === 0) {
      Alert.alert('Add a category first', 'Create a category before adding your first habit.');
      return;
    }

    router.push('/add-habit');
  }

  function handleEditHabit(habitId: number) {
    router.push({ pathname: '/add-habit', params: { habitId } });
  }

  // Show confirmation alert before deleting a habit and if confirmed delete the habit along with its targets and logs from the database
  function handleDeleteHabit(habitId: number, habitName: string) {
    Alert.alert(
      'Delete habit',
      `Delete "${habitName}"? This removes its targets and log history too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.delete(targets).where(eq(targets.habitId, habitId));
              await db.delete(habitLogs).where(eq(habitLogs.habitId, habitId));
              await db.delete(habits).where(eq(habits.id, habitId));
              await refreshAll();
            } catch {
              Alert.alert('Error', 'Could not delete habit.');
            }
          },
        },
      ]
    );
  }

  // Function to add a new category
  async function handleAddCategory(form: FormState) {
    if (!user) return;

    setSavingCategory(true);
    try {
      await db.insert(categories).values({
        userId: user.id,
        name: form.name,
        colour: form.colour,
        icon: form.icon,
      });
      setAddingCategory(false);
      await loadScreen();
    } catch {
      Alert.alert('Error', 'Could not save category.');
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleEditCategory(id: number, form: FormState) {
    setSavingCategory(true);
    try {
      await db
        .update(categories)
        .set({ name: form.name, colour: form.colour, icon: form.icon })
        .where(eq(categories.id, id));
      setEditingCategoryId(null);
      await refreshAll();
    } catch {
      Alert.alert('Error', 'Could not update category.');
    } finally {
      setSavingCategory(false);
    }
  }

  function handleDeleteCategory(category: Category) {
    const count = habitCounts.get(category.id) ?? 0;

    if (count > 0) {
      Alert.alert(
        'Cannot delete category',
        `"${category.name}" still has ${count} habit${count === 1 ? '' : 's'} in it. Move or delete those habits first.`,
      );
      return;
    }

    Alert.alert(
      'Delete category',
      `Delete "${category.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.delete(categories).where(eq(categories.id, category.id));
              await loadScreen();
            } catch {
              Alert.alert('Error', 'Could not delete category.');
            }
          },
        },
      ]
    );
  }

  const totalHabits = groups.reduce((sum, group) => sum + group.habits.length, 0);
  const activeToday = groups.reduce(
    (sum, group) => sum + group.habits.filter((habit) => habit.completed).length,
    0
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors[scheme].background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <SectionTitle
          title="Habits & Categories"
          caption="Add, edit, or delete habits and categories."
        />

        <ThemedText style={[styles.metaLine, { color: muted }]}>
          {totalHabits} habit{totalHabits !== 1 ? 's' : ''}  ·  {categoryList.length} categor{categoryList.length !== 1 ? 'ies' : 'y'}  ·  {activeToday} done today
        </ThemedText>

        <SegmentedControl value={viewMode} onChange={setViewMode} scheme={scheme} />

        {viewMode === 'habits' ? (
          <View style={styles.section}>
            <SectionTitle
              title="Habits"
              caption="Current habits grouped by category."
            />

            <View style={styles.inlineActionRow}>
              <ActionButton label="Add habit" onPress={handleOpenAddHabit} variant="primary" scheme={scheme} />
              <ActionButton
                label="Edit Categories"
                onPress={() => setViewMode('categories')}
                variant="secondary"
                scheme={scheme}
              />
            </View>

            {loading ? (
              <View style={styles.emptyState}>
                <ThemedText style={[styles.emptyBody, { color: muted }]}>Loading habits...</ThemedText>
              </View>
            ) : groups.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>No habits yet</ThemedText>
                <ThemedText style={[styles.emptyBody, { color: muted }]}>
                  Add your first habit and it will show here.
                </ThemedText>
              </View>
            ) : (
              groups.map((group) => (
                <HabitGroup
                  key={group.id}
                  group={group}
                  scheme={scheme}
                  onEditHabit={handleEditHabit}
                  onDeleteHabit={handleDeleteHabit}
                />
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <SectionTitle
              title="Categories"
              caption="Categories help keep the habit list easy to scan."
            />

            {!addingCategory && (
              <View style={styles.inlineActionRow}>
                <ActionButton
                  label="Add category"
                  onPress={() => {
                    setEditingCategoryId(null);
                    setAddingCategory(true);
                  }}
                  variant="primary"
                  scheme={scheme}
                />
                <ActionButton
                  label="Back to Habits"
                  onPress={() => setViewMode('habits')}
                  variant="secondary"
                  scheme={scheme}
                />
              </View>
            )}

            {addingCategory && (
              <CategoryForm
                initial={EMPTY_FORM}
                onSave={handleAddCategory}
                onCancel={() => setAddingCategory(false)}
                saving={savingCategory}
                scheme={scheme}
              />
            )}

            {loading ? (
              <View style={styles.emptyState}>
                <ThemedText style={[styles.emptyBody, { color: muted }]}>Loading categories...</ThemedText>
              </View>
            ) : categoryList.length === 0 && !addingCategory ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>No categories yet</ThemedText>
                <ThemedText style={[styles.emptyBody, { color: muted }]}>
                  Create a category before adding habits.
                </ThemedText>
              </View>
            ) : (
              categoryList.map((category) =>
                editingCategoryId === category.id ? (
                  <CategoryForm
                    key={category.id}
                    initial={{
                      name: category.name,
                      colour: category.colour,
                      icon: category.icon,
                    }}
                    onSave={(form) => handleEditCategory(category.id, form)}
                    onCancel={() => setEditingCategoryId(null)}
                    saving={savingCategory}
                    scheme={scheme}
                  />
                ) : (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    habitCount={habitCounts.get(category.id) ?? 0}
                    scheme={scheme}
                    onEdit={() => {
                      setAddingCategory(false);
                      setEditingCategoryId(category.id);
                    }}
                    onDelete={() => handleDeleteCategory(category)}
                  />
                )
              )
            )}
          </View>
        )}

        <View style={{ height: 36 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    paddingTop: 16,
    gap: 14,
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sectionCaption: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.75,
  },
  metaLine: { fontSize: 13, lineHeight: 18 },
  actionButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  panel: {
    borderRadius: 6,
    padding: 16,
    gap: 14,
  },
  previewRow: {
    alignItems: 'flex-start',
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  previewIcon: { fontSize: 18 },
  previewName: { fontSize: 15, fontWeight: '700' },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: -6,
  },
  inlineActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    gap: 12,
    overflow: 'hidden',
    paddingRight: 6,
  },
  categoryAccent: {
    width: 5,
    alignSelf: 'stretch',
  },
  categoryIconChip: {
    width: 42,
    height: 42,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  categoryIcon: { fontSize: 20 },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
  },
  categoryMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  textAction: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  textActionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  groupHeader: {
    paddingBottom: 2,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupIconChip: {
    width: 40,
    height: 40,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIcon: {
    fontSize: 20,
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  groupSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  habitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  habitName: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusPill: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  habitMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  rowActions: {
    gap: 10,
    alignItems: 'flex-end',
    minWidth: 52,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
});
