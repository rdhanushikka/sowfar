import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<void> {
  const alreadySetup = await AsyncStorage.getItem('sowfar:notifSetup');
  if (alreadySetup) return;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });

  if (status === 'granted') {
    await scheduleDailyReminder();
    await AsyncStorage.setItem('sowfar:notifSetup', '1');
  }
}

export async function scheduleDailyReminder(hour = 20, minute = 0): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'How was your day?',
      body: 'Take a few minutes before bed to reflect.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
