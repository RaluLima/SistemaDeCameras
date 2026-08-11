import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { api } from '../api';
import { Camera } from '../types';
import { colors } from '../theme';

export default function CamerasScreen() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .cameras()
      .then(setCameras)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function toggle(camera: Camera, field: 'recordingEnabled' | 'aiMonitoringEnabled', value: boolean) {
    const previous = camera;
    const optimistic = cameras.map((c) =>
      c.id === camera.id ? { ...c, [field]: value } : c
    );
    setCameras(optimistic);
    try {
      await api.updateCamera(camera.id, { [field]: value });
    } catch (e) {
      setCameras(cameras.map((c) => (c.id === camera.id ? previous : c)));
      Alert.alert('Erro', (e as Error).message);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={cameras}
      keyExtractor={(c) => c.id}
      ListEmptyComponent={<Text style={styles.empty}>Nenhuma câmera cadastrada</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={[styles.status, item.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {item.type} · Retenção {item.retentionDays} dias
            {item.streamUrl ? ' · stream configurado' : ' · sem stream'}
          </Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Gravação</Text>
            <Switch
              value={item.recordingEnabled}
              onValueChange={(v) => toggle(item, 'recordingEnabled', v)}
              trackColor={{ true: colors.success }}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Monitoramento com IA</Text>
            <Switch
              value={item.aiMonitoringEnabled}
              onValueChange={(v) => toggle(item, 'aiMonitoringEnabled', v)}
              trackColor={{ true: colors.success }}
            />
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
  },
  status: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusActive: {
    backgroundColor: colors.success,
  },
  statusInactive: {
    backgroundColor: colors.warning,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 14,
  },
});
