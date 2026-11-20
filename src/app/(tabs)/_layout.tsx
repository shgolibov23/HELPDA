import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import { colors } from '@/theme';

function tabIcon(active: IconName, inactive: IconName) {
  const TabIcon = ({ color, focused }: { color: ColorValue | null; focused: boolean }) => (
    <Icon name={focused ? active : inactive} size={24} color={color} />
  );
  TabIcon.displayName = `TabIcon(${active})`;
  return TabIcon;
}

export default function TabLayout() {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.greenMid,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabHome'), tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="search" options={{ title: t('tabSearch'), tabBarIcon: tabIcon('search', 'search-outline') }} />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t('tabFavorites'),
          tabBarIcon: tabIcon('heart', 'heart-outline'),
          href: role === 'business' || role === 'admin' ? null : undefined,
        }}
      />
      <Tabs.Screen name="orders" options={{ title: t('tabOrders'), tabBarIcon: tabIcon('receipt', 'receipt-outline') }} />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabBusiness'),
          tabBarIcon: tabIcon('storefront', 'storefront-outline'),
          href: role === 'business' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('tabAdmin'),
          tabBarIcon: tabIcon('shield-checkmark', 'shield-checkmark-outline'),
          href: role === 'admin' ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: t('tabProfile'), tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tabs>
  );
}
