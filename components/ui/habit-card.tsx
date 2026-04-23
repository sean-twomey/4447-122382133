import { ThemedText } from '@/components/themed-text';
import { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CategoryBadge } from './category-badge';
import { AppScheme, divider, muted, surface } from './shared';

type HabitCardProps = {
  name: string;
  scheme: AppScheme;
  colour: string;
  icon?: string;
  category?: string;
  completed?: boolean;
  onPress?: () => void;
  onToggle?: () => void;
  right?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  accessibilityLabel?: string;
};

export function HabitCard({
  name,
  scheme,
  colour,
  icon,
  category,
  completed,
  onPress,
  onToggle,
  right,
  children,
  footer,
  accessibilityLabel,
}: HabitCardProps) {
  const Body = onPress ? TouchableOpacity : View;

  return (
    <View
      style={[styles.card, { backgroundColor: surface(scheme) }, completed && styles.completed]}
      accessibilityLabel={accessibilityLabel ?? name}
    >
      <View style={[styles.accent, { backgroundColor: completed ? colour : colour + '55' }]} />
      <View style={styles.main}>
        <Body
          style={styles.header}
          onPress={onPress}
          activeOpacity={0.75}
          accessibilityRole={onPress ? 'button' : undefined}
        >
          <CategoryBadge icon={icon} colour={colour} compact />
          <View style={styles.titleBlock}>
            <ThemedText style={[styles.name, completed && styles.nameDone]}>{name}</ThemedText>
            {category ? (
              <ThemedText style={[styles.category, { color: muted(scheme) }]}>{category}</ThemedText>
            ) : null}
          </View>
          {right ? right : null}
          {onToggle ? (
            <TouchableOpacity
              onPress={onToggle}
              hitSlop={8}
              style={[
                styles.checkbox,
                completed
                  ? { backgroundColor: colour, borderColor: colour }
                  : { borderColor: colour + '77' },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!completed }}
              accessibilityLabel={`Mark ${name} ${completed ? 'incomplete' : 'complete'}`}
            >
              {completed ? <ThemedText style={styles.tick}>✓</ThemedText> : null}
            </TouchableOpacity>
          ) : null}
        </Body>
        {children ? <View style={styles.content}>{children}</View> : null}
        {footer ? <View style={[styles.footer, { borderTopColor: divider(scheme) }]}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 6,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00000012',
  },
  completed: { opacity: 0.78 },
  accent: { width: 4 },
  main: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
  },
  titleBlock: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  nameDone: { opacity: 0.5 },
  category: { fontSize: 12, lineHeight: 16 },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { color: '#fff', fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: 13, paddingBottom: 13, gap: 8 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
});
