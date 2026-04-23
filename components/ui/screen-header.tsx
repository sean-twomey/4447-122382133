import { ThemedText } from '@/components/themed-text';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppScheme, muted } from './shared';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  scheme: AppScheme;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, scheme, right }: ScreenHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textBlock}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.subtitle, { color: muted(scheme) }]}>{subtitle}</ThemedText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  textBlock: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  right: { flexShrink: 0 },
});
