import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ApplicationsAdmin } from '@/components/admin/ApplicationsAdmin';
import { BusinessesAdmin } from '@/components/admin/BusinessesAdmin';
import { ReportsAdmin } from '@/components/admin/ReportsAdmin';
import { ServicesAdmin } from '@/components/admin/ServicesAdmin';
import { UsersAdmin } from '@/components/admin/UsersAdmin';
import { Chip } from '@/components/Card';
import { Screen, ScreenHeader } from '@/components/Screen';
import { EmptyState } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';

type Section = 'applications' | 'users' | 'businesses' | 'services' | 'reports';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'applications', label: 'Arizalar' },
  { key: 'users', label: 'Foydalanuvchilar' },
  { key: 'businesses', label: 'Bizneslar' },
  { key: 'services', label: 'Xizmatlar' },
  { key: 'reports', label: 'Hisobot' },
];

export default function AdminScreen() {
  const { user } = useAuth();
  const [section, setSection] = useState<Section>('applications');
  const [refreshKey, setRefreshKey] = useState(0);

  if (user?.role !== 'admin') {
    return (
      <Screen scroll={false} padded={false}>
        <ScreenHeader title={t('tabAdmin')} back={false} />
        <EmptyState icon="lock-closed-outline" title="Ruxsat yo‘q" message="Bu bo‘lim faqat adminlar uchun." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title="Admin paneli" back={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        {SECTIONS.map((s) => (
          <Chip key={s.key} label={s.label} selected={section === s.key} onPress={() => setSection(s.key)} />
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 16 }}>
        {section === 'applications' ? <ApplicationsAdmin onChanged={() => setRefreshKey((k) => k + 1)} /> : null}
        {section === 'users' ? <UsersAdmin /> : null}
        {section === 'businesses' ? <BusinessesAdmin /> : null}
        {section === 'services' ? <ServicesAdmin /> : null}
        {section === 'reports' ? <ReportsAdmin refreshKey={refreshKey} /> : null}
      </View>
    </Screen>
  );
}
