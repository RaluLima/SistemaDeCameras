import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Alert } from '../types';
import { colors, formatDate } from '../theme';

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError(null);
      api
        .alerts()
        .then(setAlerts)
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    }, [])
  );

  async function markRead(id: string) {
    try {
      await api.markAlertRead(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, processed: true } : a)));
    } catch {
      // mantem estado atual
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
      data={alerts}
      keyExtractor={(a) => a.id}
      ListEmptyComponent={<Text style={styles.empty}>Nenhum alerta</Text>}
      renderItem={({ item }) => (
        <View
          style={[
            styles.card,
            !item.processed && styles.cardUnread,
            item.type === 'INTRUSION' && styles.cardIntrusion,
          ]}
        >
          <View style={styles.row}>
            <Text style={[styles.type, !item.processed && styles.typeUnread]}>
              {item.type}
            </Text>
            {!item.processed ? <View style={styles.dot} /> : null}
          </View>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.meta}>
            {item.camera?.name ?? 'Câmera'} · {formatDate(item.timestamp)}
          </Text>
          {!item.processed ? (
            <TouchableOpacity style={styles.readButton} onPress={() => markRead(item.id)}>
              <Text style={styles.readButtonText}>Marcar como lido</Text>
            </TouchableOpacity>
          ) : null}
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
  cardUnread: {
    borderColor: colors.primary,
  },
  cardIntrusion: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  type: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  typeUnread: {
    color: colors.primary,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  description: {
    color: colors.text,
    fontSize: 15,
    marginTop: 8,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  readButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  readButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
