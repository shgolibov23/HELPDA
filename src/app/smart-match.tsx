import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { marketplaceApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { colors, typo } from '@/theme';
import { formatPrice } from '@/utils/format';
import type { MatchResult } from '@/types';

export default function SmartMatchScreen() {
  const [query, setQuery] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<MatchResult[]>([]);
  const [message, setMessage] = useState('');
  const [aiUsed, setAiUsed] = useState(false);

  const search = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await marketplaceApi.match(query.trim(), consent);
      setItems(result.items);
      setMessage(result.message);
      setAiUsed(result.ai_used);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xizmatlarni topib bo‘lmadi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false}>
      <ScreenHeader title="AI xizmat topish" subtitle="Ehtiyojingizni oddiy tilda yozing" />
      <View style={{ padding: 16, gap: 12 }}>
        <Input
          label="Sizga qanday xizmat kerak?"
          value={query}
          onChangeText={setQuery}
          multiline
          maxLength={500}
          placeholder="Masalan: Samarqandda kichik kafe uchun logo va menyu dizayni kerak"
        />
        <Pressable onPress={() => setConsent((value) => !value)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Icon name={consent ? 'checkbox' : 'square-outline'} size={22} color={colors.greenMid} />
          <Text style={[typo.small, { flex: 1 }]}>
            AI tahlilini yoqaman. Matnim OpenAI xizmatiga yuborilishi mumkin; belgilamasam, faqat kalit-so‘z mosligi ishlaydi.
          </Text>
        </Pressable>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        <Button title={consent ? 'AI bilan tahlil qilish' : 'Mos xizmatlarni topish'} icon="sparkles-outline" onPress={search} loading={busy} />
        {message ? <Text style={typo.caption}>{aiUsed ? 'AI tavsiyasi' : 'Mahalliy moslik'}: {message}</Text> : null}
        {items.map((item) => (
          <Card key={item.id} onPress={() => router.push(`/service/${item.id}`)}>
            <Text style={typo.h3}>{item.name}</Text>
            <Text style={[typo.small, { marginTop: 4 }]}>{item.business_name}{item.city ? ` · ${item.city}` : ''}</Text>
            <Text style={[typo.bodyBold, { marginTop: 8 }]}>{formatPrice(item.price)}</Text>
            <Text style={[typo.body, { color: colors.muted, marginTop: 6 }]}>{item.match_reason}</Text>
            {item.description ? <Text style={[typo.small, { marginTop: 6 }]} numberOfLines={2}>{item.description}</Text> : null}
          </Card>
        ))}
        {!items.length && message ? <Text style={typo.small}>Mos xizmat topilmadi. So‘rovni boshqacha ifodalab ko‘ring.</Text> : null}
      </View>
    </Screen>
  );
}
