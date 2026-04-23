import * as Notifications from 'expo-notifications';

export async function sendHabitReminder(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Habit Reminder',
      body: "Your habits are not going to log themselves.",
      sound: true,
    },
    trigger: null, 
  });

  return true;
}
