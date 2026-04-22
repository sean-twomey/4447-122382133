import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { db } from '@/db/client';
import { categories, habitLogs, habits } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Types 
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
};

// One habit section is habit card and its log rows
type HabitGroup = {
  habitId: number;
  habitName: string;
  habitType: 'boolean' | 'count';
  categoryId: number;
  categoryName: string;
  categoryColour: string;
  categoryIcon: string;
  logs: LogRow[]; // newest first
};

// One category section is category header and its habit cards
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
  completedOnly: boolean | null; // null = all, true = completed, false = skipped
};

const empty_filters: Filters = { from: '', to: '', completedOnly: null };

// Helpers 
function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// validation to catch  date format issues before hitting the DB
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

// Check if a log entry is marked as done
function isDone(log: LogRow): boolean {
  return log.completed === 1 || log.count > 0;
}

// Build category, habit two-level grouping from a flat list of logs.
function buildGroups(logs: LogRow[]): CategoryGroup[] {
  const catMap = new Map<number, CategoryGroup>();

  for (const log of logs) {
    // Ensure category bucket exists
    if (!catMap.has(log.categoryId)) {
      catMap.set(log.categoryId, {
        categoryId: log.categoryId,
        categoryName: log.categoryName,
        categoryColour: log.categoryColour,
        categoryIcon: log.categoryIcon,
        habitGroups: [],
      });
    }
    const cat = catMap.get(log.categoryId)!;

    // Ensure habit bucket exists inside the category
    let habitGroup = cat.habitGroups.find((h) => h.habitId === log.habitId);
    if (!habitGroup) {
      habitGroup = {
        habitId: log.habitId,
        habitName: log.habitName,
        habitType: log.habitType as 'boolean' | 'count',
        categoryId: log.categoryId,
        categoryName: log.categoryName,
        categoryColour: log.categoryColour,
        categoryIcon: log.categoryIcon,
        logs: [],
      };
      cat.habitGroups.push(habitGroup);
    }

    habitGroup.logs.push(log);
  }

  return Array.from(catMap.values());
}

// Derived stats shown in the collapsed habit card header
function habitStats(group: HabitGroup) {
  const total = group.logs.length;
  const doneCount = group.logs.filter(isDone).length;
  const lastLog = group.logs[0]; // newest first from DB order
  const lastDate = lastLog ? formatDisplayDate(lastLog.date) : '—';
  const lastDone = lastLog ? isDone(lastLog) : false;

  // Simple streak, count consecutive done days from the most recent log
  let streak = 0;
  for (const l of group.logs) {
    if (isDone(l)) streak++;
    else break;
  }

  return { total, doneCount, lastDate, lastDone, streak };
}

// Habit Card
function HabitCard({ group, isOpen, scheme, onToggle, onDelete, onEdit }: {
  group: HabitGroup;
  isOpen: boolean;
  scheme: 'light' | 'dark';
  onToggle: () => void;
  onDelete: (log: LogRow) => void;
  onEdit: (log: LogRow) => void;
}) {
  const cardBg = scheme === 'dark' ? '#1E1E1E' : '#F7F6F4';
  const rowBg = scheme === 'dark' ? '#252525' : '#EEECEA';
  const divider = scheme === 'dark' ? '#2C2C2C' : '#E0DDD8';
  const muted = scheme === 'dark' ? '#9A9590' : '#6B6560';
  const colour = group.categoryColour;

  const { total, doneCount, lastDate, lastDone, streak } = habitStats(group);
  const rate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <View style={[habitCard.container, { backgroundColor: cardBg }]}>
      {/* Colour accent bar */}
      <View style={[habitCard.accent, { backgroundColor: colour }]} />

      <View style={{ flex: 1 }}>
        {/* Collapsed header, always visible */}
        <TouchableOpacity
          style={habitCard.header}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          {/* Icon chip */}
          <View style={[habitCard.iconChip, { backgroundColor: colour + '18' }]}>
            <Text style={habitCard.iconText}>{group.categoryIcon}</Text>
          </View>

          {/* Name + last log */}
          <View style={{ flex: 1, gap: 3 }}>
            <ThemedText style={habitCard.habitName}>{group.habitName}</ThemedText>
            <ThemedText style={[habitCard.lastLog, { color: muted }]}>
              Last: {lastDate} ·{' '}
              <Text style={{ color: lastDone ? colour : '#FF453A' }}>
                {lastDone ? 'Completed' : 'Skipped'}
              </Text>
            </ThemedText>
          </View>

          {/* Chevron */}
          <Text style={[habitCard.chevron, { color: muted }]}>
            {isOpen ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {/* Stats row, always visible */}
        <View style={[habitCard.statsRow, { borderTopColor: divider }]}>
          <StatPill label="Total" value={String(total)} colour={colour} />
          <StatPill label="Done" value={`${doneCount}/${total}`} colour={colour} />
          <StatPill label="Rate" value={`${rate}%`} colour={colour} />
          <StatPill label="Streak" value={`🔥 ${streak}`} colour={colour} />
        </View>

        {/* Expanded log rows */}
        {isOpen && (
          <View style={{ borderTopWidth: 1, borderTopColor: divider }}>
            {group.logs.map((log, i) => {
              const done = isDone(log);
              const statusText =
                log.habitType === 'boolean'
                  ? done ? '✓ Completed' : '✗ Skipped'
                  : `${log.count} logged`;
              const isLast = i === group.logs.length - 1;

              return (
                <View
                  key={log.logId}
                  style={[
                    habitCard.logRow,
                    { backgroundColor: rowBg },
                    !isLast && { borderBottomWidth: 1, borderBottomColor: divider },
                  ]}
                >
                  {/* Date + status */}
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText style={habitCard.logDate}>
                      {formatDisplayDate(log.date)}
                    </ThemedText>
                    <Text style={[habitCard.logStatus, { color: done ? colour : muted }]}>
                      {statusText}
                    </Text>
                  </View>

                  {/* Edit / Delete */}
                  <View style={habitCard.logActions}>
                    <TouchableOpacity
                      style={[habitCard.logBtn, { borderColor: colour + '66' }]}
                      onPress={() => onEdit(log)}
                      hitSlop={8}
                    >
                      <Text style={[habitCard.logBtnText, { color: colour }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[habitCard.logBtn, { borderColor: '#FF453A44' }]}
                      onPress={() => onDelete(log)}
                      hitSlop={8}
                    >
                      <Text style={[habitCard.logBtnText, { color: '#FF453A' }]}>Del</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

function StatPill({ label, value, colour }: { label: string; value: string; colour: string }) {
  return (
    <View style={habitCard.statPill}>
      <Text style={[habitCard.statValue, { color: colour }]}>{value}</Text>
      <Text style={habitCard.statLabel}>{label}</Text>
    </View>
  );
}

const habitCard = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  accent: { width: 5 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 19 },
  habitName: { fontSize: 15, fontWeight: '700' },
  lastLog: { fontSize: 12 },
  chevron: { fontSize: 11, paddingLeft: 4 },

  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
  },
  statPill: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 14, fontWeight: '700' },
  statLabel: { fontSize: 10, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.4 },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 12,
  },
  logDate: { fontSize: 13, fontWeight: '500' },
  logStatus: { fontSize: 12 },
  logActions: { flexDirection: 'row', gap: 7 },
  logBtn: {
    borderWidth: 1.5,
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  logBtnText: { fontSize: 12, fontWeight: '600' },
});

// Category Section Header 
function CategoryHeader({ group, scheme }: { group: CategoryGroup; scheme: 'light' | 'dark' }) {
  const muted = scheme === 'dark' ? '#9A9590' : '#6B6560';
  const totalLogs = group.habitGroups.reduce((n, h) => n + h.logs.length, 0);
  const doneLogs  = group.habitGroups.reduce(
    (n, h) => n + h.logs.filter(isDone).length, 0
  );

  return (
    <View style={catHeader.row}>
      <View style={[catHeader.dot, { backgroundColor: group.categoryColour }]} />
      <Text style={catHeader.icon}>{group.categoryIcon}</Text>
      <ThemedText style={catHeader.name}>{group.categoryName}</ThemedText>
      <ThemedText style={[catHeader.count, { color: muted }]}>
        {doneLogs}/{totalLogs} logs
      </ThemedText>
    </View>
  );
}

const catHeader = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  icon: { fontSize: 16 },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  count: { fontSize: 12 },
});

// Category Pill Bar 
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
  const inactiveBg   = scheme === 'dark' ? '#2C2C2E' : '#F2F2F7';
  const inactiveText = scheme === 'dark' ? '#fff'    : '#11181C';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={pillBar.row}
    >
      <TouchableOpacity
        style={[pillBar.pill, { backgroundColor: selected === null ? '#0a7ea4' : inactiveBg }]}
        onPress={() => onSelect(null)}
      >
        <Text style={[pillBar.pillText, { color: selected === null ? '#fff' : inactiveText }]}>
          All
        </Text>
      </TouchableOpacity>

      {groups.map((g) => {
        const active = selected === g.categoryId;
        return (
          <TouchableOpacity
            key={g.categoryId}
            style={[pillBar.pill, { backgroundColor: active ? g.categoryColour : inactiveBg }]}
            onPress={() => onSelect(active ? null : g.categoryId)}
          >
            <Text style={pillBar.pillIcon}>{g.categoryIcon}</Text>
            <Text style={[pillBar.pillText, { color: active ? '#fff' : inactiveText }]}>
              {g.categoryName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const pillBar = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillIcon: { fontSize: 14 },
  pillText: { fontSize: 13, fontWeight: '600' },
});

// Filter Modal
function FilterModal({ visible, current, scheme, onApply, onClear, onClose, }: {
  visible: boolean;
  current: Filters;
  scheme: 'light' | 'dark';
  onApply: (f: Filters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);
  const [completedOnly, setCompletedOnly] = useState<boolean | null>(current.completedOnly);

  const bg = scheme === 'dark' ? '#1C1C1E' : '#fff';
  const inputBg = scheme === 'dark' ? '#2C2C2E' : '#F2F2F7';
  const textColour = scheme === 'dark' ? '#fff' : '#11181C';
  const muted = scheme === 'dark' ? '#9A9590' : '#6B6560';
  const tint = '#0a7ea4';

  // Reset local state to current filters when modal is opened, so it reflects any changes made since last opened
  useEffect(() => {
    setFrom(current.from);
    setTo(current.to);
    setCompletedOnly(current.completedOnly);
  }, [current]);

  // Validate inputs, then pass back up to parent to apply and close modal
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

  // Clear local state and pass up to parent to clear filters and close modal
  function handleClear() {
    setFrom('');
    setTo('');
    setCompletedOnly(null);
    onClear();
    onClose();
  }

  // Reusable button for the 3 status filter options, highlights if active
  function StatusBtn({ label, value }: { label: string; value: boolean | null }) {
    const active = completedOnly === value;
    return (
      <TouchableOpacity
        style={[filterModal.statusBtn, { backgroundColor: active ? tint : inputBg }]}
        onPress={() => setCompletedOnly(value)}
      >
        <Text style={{ color: active ? '#fff' : textColour, fontWeight: '600', fontSize: 14 }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[filterModal.sheet, { backgroundColor: bg }]}>
        <View style={filterModal.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={{ color: tint, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[filterModal.title, { color: textColour }]}>Filter Logs</Text>
          <TouchableOpacity onPress={handleApply} hitSlop={10}>
            <Text style={{ color: tint, fontSize: 16, fontWeight: '700' }}>Apply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={[filterModal.label, { color: muted }]}>DATE RANGE</Text>
            <TextInput
              style={[filterModal.input, { backgroundColor: inputBg, color: textColour }]}
              placeholder="From (YYYY-MM-DD)"
              placeholderTextColor={muted}
              value={from}
              onChangeText={setFrom}
              keyboardType="numbers-and-punctuation"
            />
            <TextInput
              style={[filterModal.input, { backgroundColor: inputBg, color: textColour }]}
              placeholder="To (YYYY-MM-DD)"
              placeholderTextColor={muted}
              value={to}
              onChangeText={setTo}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[filterModal.label, { color: muted }]}>STATUS</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatusBtn label="All" value={null} />
              <StatusBtn label="✓ Completed" value={true} />
              <StatusBtn label="✗ Skipped" value={false} />
            </View>
          </View>

          <TouchableOpacity style={filterModal.clearBtn} onPress={handleClear}>
            <Text style={{ color: '#FF453A', fontSize: 15, fontWeight: '600' }}>Clear All Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const filterModal = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E55',
  },
  title: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  input: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  statusBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FF453A55',
  },
});

// Edit Modal 
function EditModal({
  log,
  scheme,
  onSave,
  onClose,
}: {
  log: LogRow | null;
  scheme: 'light' | 'dark';
  onSave: (logId: number, completed: boolean, count: number) => Promise<void>;
  onClose: () => void;
}) {
  const [completed, setCompleted] = useState(false);
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const bg = scheme === 'dark' ? '#1C1C1E' : '#fff';
  const inputBg = scheme === 'dark' ? '#2C2C2E' : '#F2F2F7';
  const textColour = scheme === 'dark' ? '#fff' : '#11181C';
  const muted = scheme === 'dark' ? '#9A9590' : '#6B6560';
  const tint = '#0a7ea4';

  // When a new log is loaded into the modal, reset local state to match the log's current values
  useEffect(() => {
    if (log) {
      setCompleted(log.completed === 1);
      setCount(log.count);
    }
  }, [log]);

  if (!log) return null;

  // Validate inputs, then pass back up to parent to save changes and close modal
  async function handleSave() {
    if (!log) return;
    setSaving(true);
    try {
      await onSave(log.logId, completed, count);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={!!log} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[editModal.sheet, { backgroundColor: bg }]}>
        <View style={editModal.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={{ color: tint, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[editModal.title, { color: textColour }]}>Edit Log</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={10}>
            {saving
              ? <ActivityIndicator color={tint} />
              : <Text style={{ color: tint, fontSize: 16, fontWeight: '700' }}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ padding: 24, gap: 20 }}>
          <View style={{ gap: 4 }}>
            <Text style={[editModal.label, { color: muted }]}>HABIT</Text>
            <Text style={[editModal.value, { color: textColour }]}>
              {log.categoryIcon} {log.habitName}
            </Text>
            <Text style={[editModal.sub, { color: muted }]}>
              {formatDisplayDate(log.date)}
            </Text>
          </View>

          {log.habitType === 'boolean' && (
            <View style={{ gap: 8 }}>
              <Text style={[editModal.label, { color: muted }]}>STATUS</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {([true, false] as const).map((val) => (
                  <TouchableOpacity
                    key={String(val)}
                    style={[
                      editModal.toggle,
                      { backgroundColor: completed === val ? (val ? '#2D6A4F' : '#FF453A') : inputBg },
                    ]}
                    onPress={() => setCompleted(val)}
                  >
                    <Text style={{ color: completed === val ? '#fff' : textColour, fontWeight: '600', fontSize: 15 }}>
                      {val ? '✓ Completed' : '✗ Skipped'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {log.habitType === 'count' && (
            <View style={{ gap: 8 }}>
              <Text style={[editModal.label, { color: muted }]}>COUNT</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity
                  style={[editModal.stepBtn, { borderColor: log.categoryColour + '88' }]}
                  onPress={() => setCount((c) => Math.max(0, c - 1))}
                  hitSlop={10}
                >
                  <Text style={{ fontSize: 22, color: log.categoryColour, fontWeight: '600' }}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={[editModal.countInput, { backgroundColor: inputBg, color: textColour }]}
                  value={String(count)}
                  onChangeText={(t) => setCount(Math.max(0, Number(t.replace(/[^0-9]/g, ''))))}
                  keyboardType="number-pad"
                  textAlign="center"
                />
                <TouchableOpacity
                  style={[editModal.stepBtn, { backgroundColor: log.categoryColour, borderColor: log.categoryColour }]}
                  onPress={() => setCount((c) => c + 1)}
                  hitSlop={10}
                >
                  <Text style={{ fontSize: 22, color: '#fff', fontWeight: '600' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const editModal = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E55',
  },
  title: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  value: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 13 },
  toggle: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countInput: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
});

// Main Screen 
export default function LogsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const bg = Colors[scheme].background;
  const muted = scheme === 'dark' ? '#9A9590' : '#6B6560';
  const inputBg = scheme === 'dark' ? '#2C2C2E' : '#F2F2F7';
  const tint = '#0a7ea4';

  // States
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(empty_filters);
  const [filterVisible, setFilterVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<LogRow | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  // Track which habit cards are open by habitId
  const [openHabitIds, setOpenHabitIds] = useState<Set<number>>(new Set());

  // Count how many filters are active to show in the filter button badge
  const activeFilterCount =
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.completedOnly !== null ? 1 : 0);

  // Toggle habit card open state
  function toggleHabit(habitId: number) {
    setOpenHabitIds((prev) => {
      const next = new Set(prev);
      next.has(habitId) ? next.delete(habitId) : next.add(habitId);
      return next;
    });
  }

  // Query logs from the DB with optional search and filters, then update state
  const loadLogs = useCallback(async (s: string, f: Filters) => {
    setLoading(true);
    try {
      const conditions = [];
      if (f.from && isValidDate(f.from)) conditions.push(gte(habitLogs.date, f.from));
      if (f.to && isValidDate(f.to)) conditions.push(lte(habitLogs.date, f.to));
      if (f.completedOnly === true) conditions.push(eq(habitLogs.completed, 1));
      if (f.completedOnly === false) conditions.push(eq(habitLogs.completed, 0));

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
        })
        .from(habitLogs)
        .innerJoin(habits, eq(habitLogs.habitId, habits.id))
        .innerJoin(categories, eq(habits.categoryId, categories.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(categories.name, habits.name, desc(habitLogs.date));

      // Apply search filter client-side since it involves multiple fields and partial matching
      const searchTerm = s.trim().toLowerCase();
      const filteredRows =
        searchTerm.length === 0
          ? rows
          : rows.filter((row) =>
              row.habitName.toLowerCase().includes(searchTerm) ||
              row.categoryName.toLowerCase().includes(searchTerm)
            );

      setLogs(filteredRows as LogRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load logs on mount with no filters
  useEffect(() => { loadLogs('', empty_filters); }, []);

  // Handlers for search, filter apply/clear, delete log, and edit log save, which all update state and DB as needed
  function handleSearch(text: string) {
    setSearch(text);
    loadLogs(text, filters);
  }

  // When filters are applied from the modal, update state and reload logs with new filters
  function handleApplyFilters(f: Filters) {
    setFilters(f);
    loadLogs(search, f);
  }

  // When filters are cleared from the modal, reset filter state and reload logs with no filters
  function handleClearFilters() {
    setFilters(empty_filters);
    setSearch('');
    loadLogs('', empty_filters);
  }

  // Confirm then delete log from DB, and update state to remove it from the list
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
            setLogs((prev) => prev.filter((l) => l.logId !== log.logId));
          },
        },
      ]
    );
  }

  // Save edits to the log in the DB, then update state to reflect the changes
  async function handleEditSave(logId: number, completed: boolean, count: number) {
    await db
      .update(habitLogs)
      .set({ completed: completed ? 1 : 0, count })
      .where(eq(habitLogs.id, logId));

    setLogs((prev) =>
      prev.map((l) =>
        l.logId === logId ? { ...l, completed: completed ? 1 : 0, count } : l
      )
    );
  }

  // Build a summary string of the active filters to show in the banner, or return null if no filters are active
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
  const allGroups = buildGroups(logs);

  const visibleGroups =
    selectedCategoryId === null
      ? allGroups
      : allGroups.filter((g) => g.categoryId === selectedCategoryId);

  const visibleHabits = visibleGroups.reduce((n, g) => n + g.habitGroups.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={screen.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={screen.header}>
          <ThemedText style={screen.title}>Log History</ThemedText>
          <ThemedText style={[screen.sub, { color: muted }]}>
            {visibleHabits} {visibleHabits === 1 ? 'habit' : 'habits'}
          </ThemedText>
        </View>

        {/* Search + filter */}
        <View style={screen.searchRow}>
          <TextInput
            style={[screen.searchInput, { backgroundColor: inputBg, color: scheme === 'dark' ? '#fff' : '#11181C' }]}
            placeholder="Search habits…"
            placeholderTextColor={muted}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <TouchableOpacity
            style={[screen.filterBtn, { backgroundColor: activeFilterCount > 0 ? tint : inputBg }]}
            onPress={() => setFilterVisible(true)}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: activeFilterCount > 0 ? '#fff' : (scheme === 'dark' ? '#fff' : '#11181C') }}>
              {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category pill bar */}
        {!loading && allGroups.length > 0 && (
          <View style={{ marginBottom: 4 }}>
            <CategoryPillBar
              groups={allGroups}
              selected={selectedCategoryId}
              scheme={scheme}
              onSelect={setSelectedCategoryId}
            />
          </View>
        )}

        {/* Filter summary banner */}
        {summary ? (
          <View style={[screen.summaryBanner, { backgroundColor: tint + '22' }]}>
            <Text style={{ color: tint, fontSize: 13, flex: 1 }}>{summary}</Text>
            <TouchableOpacity onPress={handleClearFilters} hitSlop={8}>
              <Text style={{ color: tint, fontWeight: '700', fontSize: 13 }}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Content */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={tint} />
        ) : visibleGroups.length === 0 ? (
          <View style={screen.empty}>
            <Text style={screen.emptyIcon}>📋</Text>
            <ThemedText style={screen.emptyTitle}>No logs found</ThemedText>
            <ThemedText style={[screen.emptySub, { color: muted }]}>
              {summary || selectedCategoryId !== null
                ? 'Try adjusting or clearing your filters.'
                : 'Complete your daily check-in to see logs here.'}
            </ThemedText>
            {summary || selectedCategoryId !== null ? (
              <TouchableOpacity
                style={[screen.actionBtn, { borderColor: tint + '55' }]}
                onPress={() => { handleClearFilters(); setSelectedCategoryId(null); }}
              >
                <Text style={{ color: tint, fontWeight: '600' }}>Clear Filters</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[screen.actionBtn, { borderColor: tint + '55' }]}
                onPress={() => router.push('/check-in')}
              >
                <Text style={{ color: tint, fontWeight: '600' }}>Go to Check-In</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          visibleGroups.map((group) => (
            <View key={group.categoryId}>
              <CategoryHeader group={group} scheme={scheme} />
              {group.habitGroups.map((habitGroup) => (
                <HabitCard
                  key={habitGroup.habitId}
                  group={habitGroup}
                  isOpen={openHabitIds.has(habitGroup.habitId)}
                  scheme={scheme}
                  onToggle={() => toggleHabit(habitGroup.habitId)}
                  onDelete={handleDelete}
                  onEdit={(l) => setEditingLog(l)}
                />
              ))}
            </View>
          ))
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

// Styles 

const screen = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 24 },
  header: { marginBottom: 16, gap: 4 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  sub: { fontSize: 13 },

  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  searchInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  filterBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
    paddingHorizontal: 20,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actionBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
});
