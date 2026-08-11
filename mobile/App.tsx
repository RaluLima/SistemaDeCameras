/**
 * App entry: provider de autenticação, navegação e push.
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth';
import RootNavigator from './src/navigation/RootNavigator';
import { configureNotifications, onNotificationResponse } from './src/notifications';

export default function App() {
  useEffect(() => {
    configureNotifications();
    const sub = onNotificationResponse((data) => {
      console.log('Notificação tocada:', data);
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
