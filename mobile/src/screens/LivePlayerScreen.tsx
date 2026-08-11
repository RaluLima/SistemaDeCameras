import React, { useState } from 'react';
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

export default function LivePlayerScreen({
  route,
}: {
  route: { params: { cameraId: string; cameraName: string } };
}) {
  const { cameraId, cameraName } = route.params;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = getAuthToken()
    ? { Authorization: `Bearer ${getAuthToken()}` }
    : undefined;
  const uri = `${API_BASE}/api/live/${cameraId}/index.m3u8`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{cameraName}</Text>
        <Text style={styles.subtitle}>Ao vivo · HLS</Text>
      </View>
      {!ready && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.hint}>Conectando ao stream...</Text>
        </View>
      ) : null}
      {!error ? (
        <Video
          source={{ uri, headers }}
          style={styles.video}
          resizeMode="contain"
          controls
          paused={false}
          repeat
          onLoad={() => setReady(true)}
          onError={() => {
            setError(
              'Não foi possível reproduzir o stream ao vivo.\nVerifique se o servidor HLS (LIVE_BASE_URL) está configurado.'
            );
            setReady(true);
          }}
        />
      ) : null}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {Platform.OS === 'ios' ? (
        <Text style={styles.note}>
          No iOS, o HLS pode não incluir o token de autenticação nos segmentos.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
    lineHeight: 22,
  },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    padding: 12,
  },
});
