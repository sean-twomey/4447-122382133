import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { seedIfEmpty } from '@/db/seed';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const [ready, setReady] = useState(false);

  // Seed the database with demo data if it's empty, then show the app
  useEffect(() => {
    seedIfEmpty()
      .then(() => setReady(true))
      .catch(console.error);
  }, []);

  // Show a loading indicator while seeding the database, which should be fast but can take a moment on first launch
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors[colorScheme].background }}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen
          name="add-habit"
          options={{
            title: 'Add Habit',
            presentation: 'card',
            headerBackTitle: 'Habits',
            headerTintColor: Colors[colorScheme].tint,
          }}
        />
        <Stack.Screen
          name="habit/[id]"
          options={{
            title: '',
            presentation: 'card',
            headerBackTitle: 'Habits',
            headerTintColor: Colors[colorScheme].tint,
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
