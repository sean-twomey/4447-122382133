import { ThemedText } from '@/components/themed-text';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppScheme, muted } from './shared';

type EmptyStateProps = {
  title: string;
  message: string;
  scheme: AppScheme;
  icon?: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, scheme, icon, action }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {icon ? <ThemedText style={styles.icon}>{icon}</ThemedText> : null}
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText style={[styles.message, { color: muted(scheme) }]}>{message}</ThemedText>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 20,
    gap: 9,
  },
  icon: { fontSize: 24 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  message: { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 280 },
  action: { marginTop: 10 },
});
