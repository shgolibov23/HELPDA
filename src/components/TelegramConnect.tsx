import { useEffect } from 'react';
import { AppState, Linking, Text, View } from 'react-native';

import { telegramApi } from '@/api/endpoints';
import { useFetch } from '@/hooks/useFetch';
import { typo } from '@/theme';

import { Button } from './Button';
import { Badge, Card } from './Card';
import { useDialog } from './DialogProvider';

/** Ariza natijasi Telegram'ga ham kelishi uchun hisobni botga ulash. Bot sozlanmagan bo'lsa ko'rinmaydi. */
export function TelegramConnect() {
  const dialog = useDialog();
  const { data, silentReload } = useFetch(() => telegramApi.status(), []);

  // Telegram'dan ilovaga qaytganda holatni yangilaymiz
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') silentReload();
    });
    return () => sub.remove();
  }, [silentReload]);

  if (!data || !data.configured) return null;

  const connect = async () => {
    try {
      const { url } = await dialog.withLoading(() => telegramApi.link(), 'Havola tayyorlanmoqda...');
      await Linking.openURL(url);
    } catch (e) {
      await dialog.error(e, 'Telegram’ni ulab bo‘lmadi');
    }
  };

  return (
    <Card>
      <View style={{ gap: 8 }}>
        <Text style={typo.h3}>Telegram bildirishnomasi</Text>
        {data.linked ? (
          <>
            <Badge label="Telegram ulangan" tone="success" icon="checkmark-circle" />
            <Text style={typo.small}>Ariza natijasi (tasdiq yoki rad etish sababi) Telegram’ga ham yuboriladi.</Text>
          </>
        ) : (
          <>
            <Text style={typo.small}>
              Ariza natijasini Telegram’da oling. Tugmani bosing, botda “Start” ni bosing va ilovaga qayting.
            </Text>
            <Button title="Telegram’ni ulash" icon="paper-plane-outline" variant="secondary" small onPress={connect} />
          </>
        )}
      </View>
    </Card>
  );
}
