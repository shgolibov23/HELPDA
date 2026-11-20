import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';

import { ordersApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Input } from '@/components/Input';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { ErrorState, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { colors, typo } from '@/theme';
import { formatDate } from '@/utils/format';

export default function OrderChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const { user } = useAuth();
  const dialog = useDialog();
  const { data, loading, error, reload, silentReload } = useFetch(() => ordersApi.messages(orderId), [orderId, user?.id]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollViewInstance | null>(null);

  useEffect(() => {
    const timer = setInterval(() => void silentReload(), 5000);
    return () => clearInterval(timer);
  }, [silentReload]);

  const send = async () => {
    const body = message.trim();
    if (!body) return;
    setSending(true);
    try {
      await ordersApi.sendMessage(orderId, body);
      setMessage('');
      await silentReload();
    } catch (e) {
      await dialog.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen edges={STACK_EDGES} padded={false} scroll={false} footer={
      <View style={{ padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input value={message} onChangeText={setMessage} multiline maxLength={2000} placeholder="Xabar yozing..." containerStyle={{ marginBottom: 0 }} />
        </View>
        <Button title="Yuborish" icon="send-outline" small onPress={send} loading={sending} />
      </View>
    }>
      <ScreenHeader title="Buyurtma xabarlari" subtitle={`Buyurtma #${orderId}`} />
      {loading ? <LoadingView /> : error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {!data?.length ? <Card><Text style={typo.body}>Hali xabar yo‘q. Buyurtma bo‘yicha kelishuvni shu yerda yozing.</Text></Card> : null}
          {data?.map((item) => {
            const mine = item.sender_id === user?.id;
            return (
              <View key={item.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <Card style={{ backgroundColor: mine ? colors.greenSoft : colors.surface }}>
                  <Text style={typo.caption}>{mine ? 'Siz' : item.sender_name} · {formatDate(item.created_at)}</Text>
                  <Text style={[typo.body, { marginTop: 4 }]}>{item.body}</Text>
                </Card>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </Screen>
  );
}
