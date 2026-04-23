import { ThemedText } from '@/components/themed-text';
import { EmptyState, FilterChip, SectionHeader, HabitCard as UiHabitCard, appColors, muted, softSurface } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { db } from '@/db/client';
import { categories, habitLogs, habits } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LogRow = {
  logId: number;
  habitId: number;
  habitName: string;
  habitType: 'boolean' | 'count';
  categoryId: number;
  categoryName: string;
  categoryColour: string;
  categoryIcon: string;
  date: string;
  completed: number;
  count: number;
  notes: string | null;
};

type HabitGroup = {
  habitId: number;
  habitName: string;
  categoryId: number;
  categoryName: string;
  categoryColour: string;
  categoryIcon: string;
  logs: LogRow[];
};

type CategoryGroup = {
  categoryId: number;
  categoryName: string;
  categoryColour: string;
  categoryIcon: string;
  habitGroups: HabitGroup[];
};

type Filters = {
  from: string;
  to: string;
  completedOnly: boolean | null;
};

const emptyFilters: Filters = { from: '', to: '', completedOnly: null };

function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// Returns true if value is in YYYY-MM-DD format and is a valid date
function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isDone(log: LogRow): boolean {
  return log.habitType === 'count' ? log.count > 0 : log.completed === 1;
}

// Returns the unit of measurement for a given habit name
function metricUnit(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('water')) return 'glasses';
  if (lower.includes('step')) return 'steps';
  if (lower.includes('meal')) return 'meals';
  return 'count';
}

function metricSummary(log: LogRow): string {
  if (log.habitType === 'count') {
    if (log.count <= 0) return `0 ${metricUnit(log.habitName)}`;
    return `${log.count} ${metricUnit(log.habitName)}`;
  }

  return log.completed === 1 ? 'Completed' : 'Skipped';
}

function groupLogs(logs: LogRow[]): CategoryGroup[] {
  const catMap = new Map<number, CategoryGroup>();

  for (const log of logs) {
    if (!catMap.has(log.categoryId)) {
      catMap.set(log.categoryId, {
        categoryId: log.categoryId,
        categoryName: log.categoryName,
        categoryColour: log.categoryColour,
        categoryIcon: log.categoryIcon,
        habitGroups: [],
      });
    }

    const category = catMap.get(log.categoryId)!;
    let habitGroup = category.habitGroups.find((habit) => habit.habitId === log.habitId);

    if (!habitGroup) {
      habitGroup = {
        habitId: log.habitId,
        habitName: log.habitName,
        categoryId: log.categoryId,
        categoryName: log.categoryName,
        categoryColour: log.categoryColour,
        categoryIcon: log.categoryIcon,
        logs: [],
      };
      category.habitGroups.push(habitGroup);
    }

    habitGroup.logs.push(log);
  }

  return Array.from(catMap.values());
}

function getHabitStats(group: HabitGroup) {
  const total = group.logs.length;
  const doneCount = group.logs.filter(isDone).length;
  const lastLog = group.logs[0];
  const lastDate = lastLog ? formatDisplayDate(lastLog.date) : 'None';
  const lastDone = lastLog ? isDone(lastLog) : false;

  let streak = 0;
  for (const log of group.logs) {
    if (isDone(log)) streak++;
    else break;
  }

  return { total, doneCount, lastDate, lastDone, streak };
}

function LogActions({ log, colour, onEdit, onDelete }: {
  log: LogRow;
  colour: string;
  onEdit: (log: LogRow) => void;
  onDelete: (log: LogRow) => void;
}) {
  return (
    <View style={styles.logActions}>
      <TouchableOpacity
        style={[styles.smallBtn, { borderColor: colour + '66' }]}
        onPress={() => onEdit(log)}
        hitSlop={8}
      >
        <Text style={[styles.smallBtnText, { color: colour }]}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.smallBtn, { borderColor: appColors.danger + '55' }]}
        onPress={() => onDelete(log)}
        hitSlop={8}
      >
        <Text style={[styles.smallBtnText, { color: appColors.danger }]}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

function LogRowItem({ log, scheme, isLast, onDelete, onEdit }: {
  log: LogRow;
  scheme: 'light' | 'dark';
  isLast: boolean;
  onDelete: (log: LogRow) => void;
  onEdit: (log: LogRow) => void;
}) {
  const done = isDone(log);

  return (
    <View
      style={[
        styles.logRow,
        { backgroundColor: softSurface(scheme) },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#00000018' },
      ]}
    >
      <View style={styles.logInfo}>
        <ThemedText style={styles.logDate}>{formatDisplayDate(log.date)}</ThemedText>
        <Text style={[styles.logStatus, { color: done ? log.categoryColour : muted(scheme) }]}>
          {metricSummary(log)}
        </Text>
        {log.notes ? (
          <ThemedText style={[styles.logNotes, { color: muted(scheme) }]}>{log.notes}</ThemedText>
        ) : null}
      </View>
      <LogActions log={log} colour={log.categoryColour} onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}

function LogHabitCard({ group, isOpen, scheme, onToggle, onDelete, onEdit }: {
  group: HabitGroup;
  isOpen: boolean;
  scheme: 'light' | 'dark';
  onToggle: () => void;
  onDelete: (log: LogRow) => void;
  onEdit: (log: LogRow) => void;
}) {
  const { total, doneCount, lastDate, lastDone, streak } = getHabitStats(group);
  const rate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <UiHabitCard
      name={group.habitName}
      icon={group.categoryIcon}
      category={`${lastDate} · ${lastDone ? 'Logged' : 'Not logged'}`}
      colour={group.categoryColour}
      scheme={scheme}
      onPress={onToggle}
      right={<ThemedText style={[styles.chevron, { color: muted(scheme) }]}>{isOpen ? 'Close' : 'Open'}</ThemedText>}
      footer={
        <View style={styles.cardStats}>
          <ThemedText style={styles.cardRate}>{rate}%</ThemedText>
          <ThemedText style={[styles.cardStatSub, { color: muted(scheme) }]}>
            {doneCount}/{total} completed{streak > 0 ? `  ·  ${streak}-day streak` : ''}
          </ThemedText>
        </View>
      }
    >
      {isOpen ? (
        <View style={styles.logList}>
          {group.logs.map((log, index) => (
            <LogRowItem
              key={log.logId}
              log={log}
              scheme={scheme}
              isLast={index === group.logs.length - 1}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </View>
      ) : null}
    </UiHabitCard>
  );
}

function CategoryPillBar({
  groups,
  selected,
  scheme,
  onSelect,
}: {
  groups: CategoryGroup[];
  selected: number | null;
  scheme: 'light' | 'dark';
  onSelect: (id: number | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      <FilterChip
        label="All"
        scheme={scheme}
        selected={selected === null}
        onPress={() => onSelect(null)}
      />
      {groups.map((group) => {
        const active = selected === group.categoryId;
        return (
          <FilterChip
            key={group.categoryId}
            label={group.categoryName}
            icon={group.categoryIcon}
            scheme={scheme}
            selected={active}
            colour={group.categoryColour}
            onPress={() => onSelect(active ? null : group.categoryId)}
          />
        );
      })}
    </ScrollView>
  );
}

function FilterModal({ visible, current, scheme, onApply, onClear, onClose }: {
  visible: boolean;
  current: Filters;
  scheme: 'light' | 'dark';
  onApply: (filters: Filters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);
  const [completedOnly, setCompletedOnly] = useState<boolean | null>(current.completedOnly);

  const bg = scheme === 'dark' ? '#1C1C1E' : '#fff';
  const inputBg = scheme === 'dark' ? '#2C2C2E' : '#F2F2F7';
  const textColour = scheme === 'dark' ? '#fff' : '#11181C';
  const mutedColour = muted(scheme);

  useEffect(() => {
    setFrom(current.from);
    setTo(current.to);
    setCompletedOnly(current.completedOnly);
  }, [current]);

  function handleApply() {
    if (from && !isValidDate(from)) {
      Alert.alert('Invalid date', 'From date must be YYYY-MM-DD format.');
      return;
    }
    if (to && !isValidDate(to)) {
      Alert.alert('Invalid date', 'To date must be YYYY-MM-DD format.');
      return;
    }

    onApply({ from, to, completedOnly });
    onClose();
  }

  function handleClear() {
    setFrom('');
    setTo('');
    setCompletedOnly(null);
    onClear();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: bg }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.modalLink}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: textColour }]}>Filter Logs</Text>
          <TouchableOpacity onPress={handleApply} hitSlop={10}>
            <Text style={[styles.modalLink, styles.modalLinkStrong]}>Apply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: mutedColour }]}>Date range</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColour }]}
              placeholder="From (YYYY-MM-DD)"
              placeholderTextColor={mutedColour}
              value={from}
              onChangeText={setFrom}
              keyboardType="numbers-and-punctuation"
            />
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColour }]}
              placeholder="To (YYYY-MM-DD)"
              placeholderTextColor={mutedColour}
              value={to}
              onChangeText={setTo}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: mutedColour }]}>Status</Text>
            <View style={styles.filterRow}>
              <FilterChip label="All" scheme={scheme} selected={completedOnly === null} onPress={() => setCompletedOnly(null)} />
              <FilterChip label="Completed" scheme={scheme} selected={completedOnly === true} colour={appColors.success} onPress={() => setCompletedOnly(true)} />
              <FilterChip label="Skipped" scheme={scheme} selected={completedOnly === false} colour={appColors.danger} onPress={() => setCompletedOnly(false)} />
            </View>
          </View>

          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Text style={styles.clearText}>Clear filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function EditModal({
  log,
  scheme,
  onSave,
  onClose,
}: {
  log: LogRow | null;
  scheme: 'light' | 'dark';
  onSave: (values: { logId: number; completed: boolean; count: number; notes: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [completed, setCompleted] = useState(false);
  const [count, setCount] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const bg = scheme === 'dark' ? '#1C1C1E' : '#fff';
  const textColour = scheme === 'dark' ? '#fff' : '#11181C';
  const mutedColour = muted(scheme);

  useEffect(() => {
    if (log) {
      setCompleted(log.completed === 1);
      setCount(String(log.count));
      setNotes(log.notes ?? '');
    }
  }, [log]);

  if (!log) return null;

  async function handleSave() {
    if (!log) return;
    setSaving(true);
    try {
      const nextCount = Number(count.replace(/[^0-9]/g, '')) || 0;
      await onSave({
        logId: log.logId,
        completed: log.habitType === 'count' ? nextCount > 0 : completed,
        count: log.habitType === 'count' ? nextCount : 0,
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={!!log} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: bg }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.modalLink}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: textColour }]}>Edit Log</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={10}>
            {saving ? (
              <ActivityIndicator color={appColors.tint} />
            ) : (
              <Text style={[styles.modalLink, styles.modalLinkStrong]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.modalBody}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: mutedColour }]}>Habit</Text>
            <Text style={[styles.editValue, { color: textColour }]}>
              {log.categoryIcon} {log.habitName}
            </Text>
            <Text style={[styles.editSub, { color: mutedColour }]}>
              {formatDisplayDate(log.date)}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: mutedColour }]}>
              {log.habitType === 'count' ? 'Metric' : 'Status'}
            </Text>
            {log.habitType === 'count' ? (
              <View style={styles.metricEditRow}>
                <TextInput
                  style={[styles.input, styles.metricEditInput, { backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#F2F2F7', color: textColour }]}
                  value={count}
                  onChangeText={(text) => setCount(text.replace(/[^0-9]/g, '') || '0')}
                  keyboardType="number-pad"
                />
                <Text style={[styles.editSub, { color: mutedColour }]}>{metricUnit(log.habitName)}</Text>
              </View>
            ) : (
              <View style={styles.filterRow}>
                <FilterChip
                  label="Completed"
                  scheme={scheme}
                  selected={completed}
                  colour={appColors.success}
                  onPress={() => setCompleted(true)}
                />
                <FilterChip
                  label="Skipped"
                  scheme={scheme}
                  selected={!completed}
                  colour={appColors.danger}
                  onPress={() => setCompleted(false)}
                />
              </View>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: mutedColour }]}>Notes</Text>
            <TextInput
              style={[styles.input, { backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#F2F2F7', color: textColour }]}
              placeholder="Optional note"
              placeholderTextColor={mutedColour}
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function LogsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const bg = Colors[scheme].background;
  const inputBg = scheme === 'dark' ? '#2C2C2E' : '#F2F2F7';
  const textColour = scheme === 'dark' ? '#fff' : '#11181C';

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filterVisible, setFilterVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<LogRow | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [openHabitIds, setOpenHabitIds] = useState<Set<number>>(new Set());

  const activeFilterCount =
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.completedOnly !== null ? 1 : 0);

  const loadLogs = useCallback(async (query: string, activeFilters: Filters) => {
    setLoading(true);
    try {
      const conditions = [eq(habits.userId, user!.id)];
      if (activeFilters.from && isValidDate(activeFilters.from)) conditions.push(gte(habitLogs.date, activeFilters.from));
      if (activeFilters.to && isValidDate(activeFilters.to)) conditions.push(lte(habitLogs.date, activeFilters.to));
      if (activeFilters.completedOnly === true) conditions.push(eq(habitLogs.completed, 1));
      if (activeFilters.completedOnly === false) conditions.push(eq(habitLogs.completed, 0));

      const rows = await db
        .select({
          logId: habitLogs.id,
          habitId: habits.id,
          habitName: habits.name,
          habitType: habits.type,
          categoryId: categories.id,
          categoryName: categories.name,
          categoryColour: categories.colour,
          categoryIcon: categories.icon,
          date: habitLogs.date,
          completed: habitLogs.completed,
          count: habitLogs.count,
          notes: habitLogs.notes,
        })
        .from(habitLogs)
        .innerJoin(habits, eq(habitLogs.habitId, habits.id))
        .innerJoin(categories, eq(habits.categoryId, categories.id))
        .where(and(...conditions))
        .orderBy(categories.name, habits.name, desc(habitLogs.date));

      const searchTerm = query.trim().toLowerCase();
      const filteredRows = searchTerm.length === 0
        ? rows
        : rows.filter((row) =>
            row.habitName.toLowerCase().includes(searchTerm) ||
            row.categoryName.toLowerCase().includes(searchTerm) ||
            (row.notes ?? '').toLowerCase().includes(searchTerm)
          );

      setLogs(filteredRows as LogRow[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadLogs('', emptyFilters); }, [loadLogs]);

  function toggleHabit(habitId: number) {
    setOpenHabitIds((prev) => {
      const next = new Set(prev);
      if (next.has(habitId)) next.delete(habitId);
      else next.add(habitId);
      return next;
    });
  }

  function handleSearch(text: string) {
    setSearch(text);
    loadLogs(text, filters);
  }

  function handleApplyFilters(nextFilters: Filters) {
    setFilters(nextFilters);
    loadLogs(search, nextFilters);
  }

  function handleClearFilters() {
    setFilters(emptyFilters);
    setSearch('');
    loadLogs('', emptyFilters);
  }

  function handleDelete(log: LogRow) {
    Alert.alert(
      'Delete log?',
      `Remove the log for "${log.habitName}" on ${formatDisplayDate(log.date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await db.delete(habitLogs).where(eq(habitLogs.id, log.logId));
            setLogs((prev) => prev.filter((item) => item.logId !== log.logId));
          },
        },
      ]
    );
  }

  async function handleEditSave(values: { logId: number; completed: boolean; count: number; notes: string }) {
    await db
      .update(habitLogs)
      .set({
        completed: values.completed ? 1 : 0,
        count: values.count,
        notes: values.notes.trim() || null,
      })
      .where(eq(habitLogs.id, values.logId));

    setLogs((prev) =>
      prev.map((log) =>
        log.logId === values.logId
          ? {
              ...log,
              completed: values.completed ? 1 : 0,
              count: values.count,
              notes: values.notes.trim() || null,
            }
          : log
      )
    );
  }

  function filterSummary(): string | null {
    const parts: string[] = [];
    if (filters.from) parts.push(`from ${filters.from}`);
    if (filters.to) parts.push(`to ${filters.to}`);
    if (filters.completedOnly === true) parts.push('completed only');
    if (filters.completedOnly === false) parts.push('skipped only');
    if (search.trim()) parts.push(`"${search.trim()}"`);
    return parts.length > 0 ? `Showing: ${parts.join(' · ')}` : null;
  }

  const summary = filterSummary();
  const allGroups = groupLogs(logs);
  const visibleGroups = selectedCategoryId === null
    ? allGroups
    : allGroups.filter((group) => group.categoryId === selectedCategoryId);
  const visibleHabits = visibleGroups.reduce((count, group) => count + group.habitGroups.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderText}>
            <ThemedText style={styles.pageTitle}>Habit Logs</ThemedText>
            <ThemedText style={[styles.pageSubtitle, { color: muted(scheme) }]}>
              {visibleHabits} {visibleHabits === 1 ? 'habit' : 'habits'}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => router.push('/categories')}
            activeOpacity={0.8}
            accessibilityLabel="Manage categories"
          >
            <Text style={styles.manageText}>Categories</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: inputBg, color: textColour }]}
            placeholder="Search"
            placeholderTextColor={muted(scheme)}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: activeFilterCount > 0 ? appColors.tint : inputBg }]}
            onPress={() => setFilterVisible(true)}
            accessibilityLabel="Open log filters"
          >
            <Text style={[styles.filterText, { color: activeFilterCount > 0 ? '#fff' : textColour }]}>
              {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
            </Text>
          </TouchableOpacity>
        </View>

        {!loading && allGroups.length > 0 ? (
          <CategoryPillBar
            groups={allGroups}
            selected={selectedCategoryId}
            scheme={scheme}
            onSelect={setSelectedCategoryId}
          />
        ) : null}

        {summary ? (
          <View style={styles.summaryBanner}>
            <Text style={styles.summaryText}>{summary}</Text>
            <TouchableOpacity onPress={handleClearFilters} hitSlop={8}>
              <Text style={styles.summaryClear}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.loadingSpinner} color={appColors.tint} />
        ) : visibleGroups.length === 0 ? (
          <EmptyState
            title="Nothing here"
            message={
              summary || selectedCategoryId !== null
                ? 'Try adjusting your filters.'
                : 'Complete a check-in and your logs will appear here.'
            }
            scheme={scheme}
            action={
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={
                  summary || selectedCategoryId !== null
                    ? () => { handleClearFilters(); setSelectedCategoryId(null); }
                    : () => router.push('/check-in')
                }
              >
                <Text style={styles.emptyActionText}>
                  {summary || selectedCategoryId !== null ? 'Clear filters' : 'Log today'}
                </Text>
              </TouchableOpacity>
            }
          />
        ) : (
          visibleGroups.map((group) => {
            const totalLogs = group.habitGroups.reduce((count, habit) => count + habit.logs.length, 0);
            const doneLogs = group.habitGroups.reduce(
              (count, habit) => count + habit.logs.filter(isDone).length,
              0
            );

            return (
              <View key={group.categoryId}>
                <SectionHeader
                  title={group.categoryName}
                  icon={group.categoryIcon}
                  colour={group.categoryColour}
                  scheme={scheme}
                  rightText={`${doneLogs}/${totalLogs} logs`}
                />
                {group.habitGroups.map((habitGroup) => (
                  <LogHabitCard
                    key={habitGroup.habitId}
                    group={habitGroup}
                    isOpen={openHabitIds.has(habitGroup.habitId)}
                    scheme={scheme}
                    onToggle={() => toggleHabit(habitGroup.habitId)}
                    onDelete={handleDelete}
                    onEdit={(log) => setEditingLog(log)}
                  />
                ))}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <FilterModal
        visible={filterVisible}
        current={filters}
        scheme={scheme}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        onClose={() => setFilterVisible(false)}
      />

      <EditModal
        log={editingLog}
        scheme={scheme}
        onSave={handleEditSave}
        onClose={() => setEditingLog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  pageHeaderText: { flex: 1 },
  pageTitle: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  pageSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  manageBtn: {
    borderWidth: 1,
    borderColor: appColors.tint,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  manageText: { color: appColors.tint, fontSize: 14, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  searchInput: {
    flex: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  filterBtn: {
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterText: { fontSize: 13, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2, marginBottom: 6 },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
    backgroundColor: appColors.tint + '20',
  },
  summaryText: { color: appColors.tint, fontSize: 13, flex: 1 },
  summaryClear: { color: appColors.tint, fontWeight: '700', fontSize: 13 },
  loadingSpinner: { marginTop: 40 },
  emptyAction: {
    borderWidth: 1,
    borderColor: appColors.tint + '66',
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyActionText: { color: appColors.tint, fontWeight: '700' },
  chevron: { fontSize: 12, fontWeight: '700' },
  cardStats: { gap: 2 },
  cardRate: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  cardStatSub: { fontSize: 12, lineHeight: 17 },
  logList: { gap: 0 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 10,
  },
  logInfo: { flex: 1, gap: 2 },
  logDate: { fontSize: 13, fontWeight: '600' },
  logStatus: { fontSize: 12 },
  logNotes: { fontSize: 12, lineHeight: 17 },
  logActions: { flexDirection: 'row', gap: 7 },
  smallBtn: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700' },
  sheet: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E55',
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalLink: { color: appColors.tint, fontSize: 16 },
  modalLinkStrong: { fontWeight: '700' },
  modalBody: { padding: 20, gap: 20 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  input: { borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  metricEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricEditInput: { width: 88, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 8 },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: appColors.danger + '55',
  },
  clearText: { color: appColors.danger, fontSize: 15, fontWeight: '700' },
  editValue: { fontSize: 18, fontWeight: '700' },
  editSub: { fontSize: 13 },
});
