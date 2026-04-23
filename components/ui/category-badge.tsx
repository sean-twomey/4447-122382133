import { ThemedText } from '@/components/themed-text';
import { StyleSheet, View } from 'react-native';

type CategoryBadgeProps = {
  icon?: string;
  label?: string;
  colour: string;
  compact?: boolean;
};

export function CategoryBadge({ icon, label, colour, compact }: CategoryBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colour + '18' },
        compact && styles.compact,
      ]}
      accessibilityLabel={label ? `Category ${label}` : 'Category'}
    >
      {icon ? <ThemedText style={styles.icon}>{icon}</ThemedText> : null}
      {label ? <ThemedText style={[styles.label, { color: colour }]}>{label}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 32,
    borderRadius: 5,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  compact: { width: 32, height: 32, paddingHorizontal: 0 },
  icon: { fontSize: 15 },
  label: { fontSize: 12, fontWeight: '700' },
});
