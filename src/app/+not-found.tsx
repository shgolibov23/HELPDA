import { router } from 'expo-router';

import { EmptyState } from '@/components/States';
import { Screen } from '@/components/Screen';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState icon="compass-outline" title="Sahifa topilmadi" message="Bunday sahifa mavjud emas." actionLabel="Bosh sahifaga" onAction={() => router.replace('/')} />
    </Screen>
  );
}
