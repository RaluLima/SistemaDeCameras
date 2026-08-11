import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video from 'react-native-video';
import { getAuthToken } from '../api';
import { API_BASE } from '../config';
import { colors } from '../theme';

export default function RecordingsPlayerScreen({
  route,
}: {
  route: { params: { recordingId: string } };
}) {
  const { recordingId } = route.params;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const timer = setTimeout(() => {
        if (!error) setReady(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const headers = getAuthToken()
    ? { Authorization: `Bearer ${getAuthToken()}` }
    : undefined;
  const uri = `${API_BASE}/api/recordings/file/${recordingId}`;

  return (
    <View style={styles.container}>
      {!ready ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.hint}>Carregando gravação...</Text>
        </View>
      ) : null}
      <Video
        source={{ uri, headers }}
        style={styles.video}
        resizeMode="contain"
        controls
        paused={false}
        repeat={false}
        onLoad={() => setReady(true)}
        onError={() => {
          setError('Não foi possível reproduzir a gravação.');
          setReady(true);
        }}
      />
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: colors.textMuted,
    marginTop: 12,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    padding: 24,
  },
});
