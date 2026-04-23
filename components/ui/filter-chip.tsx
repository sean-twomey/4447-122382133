import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AppScheme, softSurface } from './shared';

type FilterChipProps = {
  label: string;
  scheme: AppScheme;
  selected?: boolean;
  colour?: string;
  icon?: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function FilterChip({ label, scheme, selected, colour = '#0A6B7D', icon, onPress, accessibilityLabel }: FilterChipProps) {
  const textColour = selected ? '#fff' : scheme === 'dark' ? '#fff' : '#11181C';

  return (
    <TouchableOpacity
      style={[styles.chip, { backgroundColor: selected ? colour : softSurface(scheme) }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.text, { color: textColour }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  icon: { fontSize: 13 },
  text: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
