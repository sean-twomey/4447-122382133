import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import type { ThemePreference } from '@/context/theme';
import { useTheme } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { exportHabitLogsCsv } from '@/utils/export-csv';
import { sendHabitReminder } from '@/utils/notifications';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { preference, setPreference } = useTheme();
  const { user, logout, deleteProfile } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isDark = scheme === 'dark';
  const cardBg = isDark ? '#1E1E1E' : '#F7F6F4';
  const muted = isDark ? '#9A9590' : '#6B6560';
  const divider = isDark ? '#2C2C2C' : '#E8E5E0';

  async function handleSendReminder() {
    const sent = await sendHabitReminder();
    if (!sent) {
      Alert.alert('Permission Denied', 'Enable notifications in Settings to use this feature.');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportHabitLogsCsv();
    } catch {
      Alert.alert('Export Failed', 'Could not export habit logs.');
    } finally {
      setExporting(false);
    }
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        // Call logout _layout.tsx useEffect detects user = null and redirects
        onPress: () => logout(),
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all habit data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const result = await deleteProfile();
            setDeleting(false);
            if (result?.error) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.scroll}
    >
      {/* Avatar + email */}
      <View style={s.avatarSection}>
        <View style={[s.avatar, { backgroundColor: colors.tint + '22' }]}>
          <Text style={[s.avatarInitial, { color: colors.tint }]}>
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={[s.email, { color: colors.text }]}>{user?.email}</Text>
        <Text style={[s.memberLabel, { color: muted }]}>Signed in</Text>
      </View>

      {/* Account */}
      <Text style={[s.sectionLabel, { color: muted }]}>Account</Text>
      <View style={[s.card, { backgroundColor: cardBg }]}>
        <View style={[s.row, { borderBottomColor: divider, borderBottomWidth: 1 }]}>
          <Text style={[s.rowLabel, { color: colors.text }]}>Email</Text>
          <Text style={[s.rowValue, { color: muted }]} numberOfLines={1}>{user?.email}</Text>
        </View>
        <View style={s.row}>
          <Text style={[s.rowLabel, { color: colors.text }]}>User ID</Text>
          <Text style={[s.rowValue, { color: muted }]}>#{user?.id}</Text>
        </View>
      </View>

      {/* Appearance */}
      <Text style={[s.sectionLabel, { color: muted }]}>Appearance</Text>
      <View style={[s.card, { backgroundColor: cardBg }]}>
        {(['light', 'dark'] as ThemePreference[]).map((option, i, arr) => {
          const label = option === 'dark' ? 'Dark' : 'Light';
          const active = preference === option;
          return (
            <Pressable
              key={option}
              style={[
                s.row,
                i < arr.length - 1 && { borderBottomColor: divider, borderBottomWidth: 1 },
              ]}
              onPress={() => setPreference(option)}
            >
              <Text style={[s.rowLabel, { color: colors.text }]}>{label}</Text>
              {active && <Text style={{ color: colors.tint, fontSize: 18 }}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      {/* Reminders */}
      <Text style={[s.sectionLabel, { color: muted }]}>Reminders</Text>
      <View style={[s.card, { backgroundColor: cardBg }]}>
        <Pressable style={s.row} onPress={handleSendReminder}>
          <Text style={[s.rowLabel, { color: colors.tint }]}>Send daily reminder</Text>
        </Pressable>
      </View>

      {/* Data */}
      <Text style={[s.sectionLabel, { color: muted }]}>Data</Text>
      <View style={[s.card, { backgroundColor: cardBg }]}>
        <Pressable style={s.row} onPress={handleExport} disabled={exporting}>
          {exporting
            ? <ActivityIndicator color={colors.tint} />
            : <Text style={[s.rowLabel, { color: colors.tint }]}>Export log history</Text>
          }
        </Pressable>
      </View>

      {/* Session */}
      <Text style={[s.sectionLabel, { color: muted }]}>Session</Text>
      <View style={[s.card, { backgroundColor: cardBg }]}>
        <Pressable style={s.row} onPress={handleLogout}>
          <Text style={[s.rowLabel, { color: colors.tint }]}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={[s.sectionLabel, { color: muted }]}>Delete data</Text>
      <View style={[s.card, { backgroundColor: cardBg }]}>
        <Pressable style={s.row} onPress={handleDeleteAccount} disabled={deleting}>
          {deleting
            ? <ActivityIndicator color="#C0392B" />
            : <Text style={[s.rowLabel, { color: '#C0392B' }]}>Delete account and data</Text>
          }
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 16, paddingTop: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInitial: { fontSize: 28, fontWeight: '700' },
  email: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  memberLabel: { fontSize: 13 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },
  card: { borderRadius: 6, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 14, maxWidth: '55%', textAlign: 'right' },
});
