import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AuthLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors[colorScheme].background } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
