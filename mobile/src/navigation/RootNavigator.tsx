import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth';
import { colors } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import CamerasScreen from '../screens/CamerasScreen';
import RecordingsScreen from '../screens/RecordingsScreen';
import RecordingsPlayerScreen from '../screens/RecordingsPlayerScreen';
import LiveScreen from '../screens/LiveScreen';
import LivePlayerScreen from '../screens/LivePlayerScreen';
import AlertsScreen from '../screens/AlertsScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Cameras: undefined;
  Recordings: undefined;
  RecordingsPlayer: { recordingId: string };
  Live: undefined;
  LivePlayer: { cameraId: string; cameraName: string };
  Alerts: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Início', headerShown: false }}
            />
            <Stack.Screen
              name="Cameras"
              component={CamerasScreen}
              options={{ title: 'Câmeras' }}
            />
            <Stack.Screen
              name="Recordings"
              component={RecordingsScreen}
              options={{ title: 'Gravações' }}
            />
            <Stack.Screen
              name="RecordingsPlayer"
              component={RecordingsPlayerScreen}
              options={{ title: 'Gravação' }}
            />
            <Stack.Screen name="Live" component={LiveScreen} options={{ title: 'Ao Vivo' }} />
            <Stack.Screen
              name="LivePlayer"
              component={LivePlayerScreen}
              options={{ title: 'Ao Vivo' }}
            />
            <Stack.Screen name="Alerts" component={AlertsScreen} options={{ title: 'Alertas' }} />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
