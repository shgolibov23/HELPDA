import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { marketplaceApi } from '@/api/endpoints';
import { DialogProvider } from '@/components/DialogProvider';
import { LoadingView } from '@/components/States';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { colors } from '@/theme';

const PUSH_TOKEN_KEY = 'helpda_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function Root() {
  const { loading, user } = useAuth();
  const { mode, ready, consumeReopen } = useTheme();
  const first = useRef(true);

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    let active = true;
    const register = async () => {
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
          console.warn('Push sozlanmadi: EAS projectId app.json ga kiritilmagan.');
          return;
        }
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'HELPDA',
            importance: AndroidImportance.DEFAULT,
          });
        }
        let permission = await Notifications.getPermissionsAsync();
        if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
        if (permission.status !== 'granted') return;

        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!active) return;
        await marketplaceApi.registerPushToken(token, Platform.OS);
        await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
      } catch (error) {
        console.warn('Push bildirishnomalarini sozlab bo‘lmadi:', error);
      }
    };
    void register();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const orderId = data?.order_id;
      if (typeof orderId === 'number' && data?.kind === 'chat') {
        router.push(`/order-chat/${orderId}`);
      } else {
        router.push('/notifications');
      }
    });
    return () => subscription.remove();
  }, []);

  // Mavzu o'zgarganda navigatsiya qayta quriladi; foydalanuvchini sozlamalarga qaytaramiz
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (consumeReopen()) {
      const id = setTimeout(() => router.push('/settings'), 250);
      return () => clearTimeout(id);
    }
  }, [mode, consumeReopen]);

  if (loading || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <LoadingView />
      </View>
    );
  }
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack key={mode} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DialogProvider>
          <AuthProvider>
            <Root />
          </AuthProvider>
        </DialogProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
