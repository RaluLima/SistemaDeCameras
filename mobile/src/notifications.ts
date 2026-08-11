import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { EXPO_PUSH_PROJECT_ID } from './config';
import { api } from './api';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted =
      current.status === 'granted'
        ? true
        : (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return null;

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PUSH_PROJECT_ID,
    });
    await api.registerPush(token.data);
    return token.data;
  } catch (err) {
    console.warn('Falha ao registrar push:', err);
    return null;
  }
}

export function onNotificationResponse(callback: (data: Record<string, unknown>) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    callback((response.notification.request.content.data as Record<string, unknown>) ?? {});
  });
}
