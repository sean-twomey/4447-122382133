import { ThemedText } from '@/components/themed-text';
import { StyleSheet, View } from 'react-native';
import { AppScheme, muted } from './shared';

type SectionHeaderProps = {
  title: string;
  scheme: AppScheme;
  icon?: string;
  rightText?: string;
  colour?: string;
};

export function SectionHeader({ title, scheme, icon, rightText }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      {icon ? <ThemedText style={styles.icon}>{icon}</ThemedText> : null}
      <ThemedText style={[styles.title, { color: muted(scheme) }]}>{title}</ThemedText>
      {rightText ? (
        <ThemedText style={[styles.right, { color: muted(scheme) }]}>{rightText}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  icon: { fontSize: 15 },
  title: { flex: 1, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  right: { fontSize: 12, lineHeight: 16 },
});
