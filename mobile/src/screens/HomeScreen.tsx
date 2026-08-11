import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth';
import { registerPushToken } from '../notifications';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<Nav>();
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useEffect(() => {
    registerPushToken()
      .then((t) =>
        t ? setPushStatus('Notificações ativadas') : setPushStatus('Notificações não ativadas')
      )
      .catch(() => setPushStatus('Falha ao ativar notificações'));
  }, []);

  const links: { title: string; subtitle: string; to: 'Cameras' | 'Recordings' | 'Live' | 'Alerts' }[] = [
    { title: '📷 Câmeras', subtitle: 'Gerenciar câmeras e modos', to: 'Cameras' },
    { title: '🎥 Gravações', subtitle: 'Assistir gravações', to: 'Recordings' },
    { title: '📡 Ao Vivo', subtitle: 'Câmeras em tempo real', to: 'Live' },
    { title: '🔔 Alertas', subtitle: 'Alertas de segurança', to: 'Alerts' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {user?.name}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, user?.plan === 'PAID' ? styles.badgePaid : styles.badgeFree]}>
            <Text style={styles.badgeText}>{user?.plan === 'PAID' ? 'PLANO PAGO' : 'PLANO GRATUITO'}</Text>
          </View>
          {user?.role === 'ADMIN' ? (
            <View style={[styles.badge, styles.badgeAdmin]}>
              <Text style={styles.badgeText}>ADMIN</Text>
            </View>
          ) : null}
        </View>
      </View>

      {pushStatus ? <Text style={styles.pushStatus}>{pushStatus}</Text> : null}

      {links.map((link) => (
        <TouchableOpacity
          key={link.to}
          style={styles.card}
          onPress={() => navigation.navigate(link.to)}
        >
          <Text style={styles.cardTitle}>{link.title}</Text>
          <Text style={styles.cardSubtitle}>{link.subtitle}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={styles.logout}
        onPress={() => {
          signOut();
        }}
      >
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
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
  header: {
    marginBottom: 16,
  },
  greeting: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  badgePaid: {
    backgroundColor: colors.success,
  },
  badgeFree: {
    backgroundColor: colors.warning,
  },
  badgeAdmin: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  pushStatus: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  logout: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '600',
  },
});
