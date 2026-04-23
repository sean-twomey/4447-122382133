import { ThemedText } from '@/components/themed-text';
import { StyleSheet, View } from 'react-native';
import { AppScheme, muted } from './shared';

type ProgressRowProps = {
  done: number;
  goal: number;
  colour: string;
  scheme: AppScheme;
  label?: string;
  rightText?: string;
  statusText?: string;
  statusColour?: string;
  height?: number;
};

export function ProgressRow({
  done,
  goal,
  colour,
  scheme,
  label,
  rightText,
  statusText,
  statusColour,
  height = 6,
}: ProgressRowProps) {
  const pct = goal > 0 ? Math.min(done / goal, 1) : 0;
  const text = rightText ?? `${done}/${goal}`;

  return (
    <View style={styles.wrap} accessibilityLabel={`${label ?? 'Progress'} ${done} of ${goal}`}>
      <View style={styles.top}>
        {label ? <ThemedText style={[styles.label, { color: muted(scheme) }]}>{label}</ThemedText> : null}
        <ThemedText style={[styles.count, { color: muted(scheme) }]}>{text}</ThemedText>
        {statusText ? (
          <ThemedText style={[styles.status, { color: statusColour ?? colour }]}>{statusText}</ThemedText>
        ) : null}
      </View>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: colour, height, borderRadius: height / 2 },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontSize: 11, fontWeight: '600' },
  count: { fontSize: 11 },
  status: { fontSize: 11, fontWeight: '700' },
  track: { backgroundColor: '#00000012', overflow: 'hidden' },
  fill: {},
});
