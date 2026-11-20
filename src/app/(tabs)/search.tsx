import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { catalogApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { ServiceCard } from '@/components/ServiceCard';
import { EmptyState, ErrorState, LoadingView } from '@/components/States';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/components/DialogProvider';
import { colors, typo, makeStyles } from '@/theme';
import type { Service, SortKey } from '@/types';

const PAGE = 20;
const CITIES = ['Toshkent', 'Samarqand', 'Buxoro', 'Andijon', 'Namangan', 'Farg‘ona', 'Qarshi', 'Nukus'];
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Yangilari' },
  { key: 'price_asc', label: 'Arzonroq' },
  { key: 'price_desc', label: 'Qimmatroq' },
  { key: 'rating', label: 'Reyting' },
];

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category_id?: string }>();
  const parsedCategoryId = Number(params.category_id);
  const initialCategoryId =
    params.category_id && Number.isInteger(parsedCategoryId) && parsedCategoryId > 0 ? parsedCategoryId : null;
  return <SearchContent key={params.category_id ?? 'all'} initialCategoryId={initialCategoryId} />;
}

function SearchContent({ initialCategoryId }: { initialCategoryId: number | null }) {
  const { user } = useAuth();
  const dialog = useDialog();
  const toggleFavorite = useFavoriteToggle();
  const categories = useFetch(() => catalogApi.categories(), []);

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [sheet, setSheet] = useState(false);

  const [items, setItems] = useState<Service[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const debouncedQuery = useDebounce(query);

  const fetchPage = useCallback(
    async (offset: number) => {
      const id = ++reqId.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await catalogApi.services({
          q: debouncedQuery.trim() || undefined,
          category_id: categoryId,
          city: city || undefined,
          min_price: minPrice.trim() ? Number(minPrice) : undefined,
          max_price: maxPrice.trim() ? Number(maxPrice) : undefined,
          sort,
          limit: PAGE,
          offset,
        });
        if (id !== reqId.current) return;
        setTotal(res.total);
        setItems((prev) => (offset === 0 ? res.items : [...prev, ...res.items]));
      } catch (e) {
        if (id === reqId.current) setError(errorMessage(e));
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedQuery, categoryId, city, minPrice, maxPrice, sort]
  );

  useEffect(() => {
    let active = true;
    const loadInitialPage = async () => {
      await Promise.resolve();
      if (active) await fetchPage(0);
    };
    void loadInitialPage();
    return () => {
      active = false;
    };
  }, [fetchPage, user?.id]);

  const onFavorite = async (s: Service) => {
    const value = await toggleFavorite(s);
    if (value !== null) setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_favorite: value } : x)));
  };

  const toggleCompare = async (service: Service) => {
    if (compareIds.includes(service.id)) {
      setCompareIds((ids) => ids.filter((id) => id !== service.id));
      return;
    }
    if (compareIds.length >= 3) {
      await dialog.notify({ type: 'info', title: 'Ko‘pi bilan 3 ta xizmatni solishtirish mumkin' });
      return;
    }
    setCompareIds((ids) => [...ids, service.id]);
  };

  const activeFilters = (categoryId !== null ? 1 : 0) + (city ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (sort !== 'newest' ? 1 : 0);

  return (
    <Screen
      scroll={false}
      padded={false}
    >
      <View style={styles.top}>
        <Text style={typo.h1}>Qidiruv</Text>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <Input
              icon="search-outline"
              placeholder="Xizmat yoki biznes nomi"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
          <Button
            title="AI yordamida xizmat topish"
            icon="sparkles-outline"
            variant="secondary"
            small
            onPress={() => router.push('/smart-match')}
          />
          <PressableScale onPress={() => setSheet(true)} style={styles.filterBtn}>
            <Icon name="options-outline" size={22} color={colors.white} />
            {activeFilters > 0 ? (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{activeFilters}</Text>
              </View>
            ) : null}
          </PressableScale>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 14 }}>
          <Chip label="Barchasi" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          {(categories.data ?? []).map((c) => (
            <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </ScrollView>
        {compareIds.length > 0 ? (
          <Button
            title={`Solishtirish (${compareIds.length}/3)`}
            icon="git-compare-outline"
            small
            onPress={() => router.push({ pathname: '/compare', params: { ids: compareIds.join(',') } })}
          />
        ) : null}
      </View>

      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchPage(0)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<Text style={typo.small}>{total} ta natija topildi</Text>}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Hech narsa topilmadi"
              message="Boshqa so‘z yoki filtrlar bilan urinib ko‘ring."
              actionLabel="Filtrlarni tozalash"
              onAction={() => {
                setQuery('');
                setCategoryId(null);
                setCity('');
                setMinPrice('');
                setMaxPrice('');
                setSort('newest');
              }}
            />
          }
          renderItem={({ item }) => (
            <View style={{ gap: 8 }}>
              <ServiceCard service={item} onPress={() => router.push(`/service/${item.id}`)} onToggleFavorite={() => onFavorite(item)} />
              <Button
                title={compareIds.includes(item.id) ? 'Solishtirishdan olish' : 'Solishtirishga qo‘shish'}
                icon="git-compare-outline"
                variant="ghost"
                small
                onPress={() => toggleCompare(item)}
              />
            </View>
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!loadingMore && items.length < total) fetchPage(items.length);
          }}
          ListFooterComponent={loadingMore ? <LoadingView text="" /> : undefined}
        />
      )}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Filtrlar">
        <Text style={styles.sheetLabel}>Saralash</Text>
        <View style={styles.wrap}>
          {SORTS.map((s) => (
            <Chip key={s.key} label={s.label} selected={sort === s.key} onPress={() => setSort(s.key)} />
          ))}
        </View>
        <Text style={styles.sheetLabel}>Shahar</Text>
        <View style={styles.wrap}>
          <Chip label="Barchasi" selected={city === ''} onPress={() => setCity('')} />
          {CITIES.map((c) => (
            <Chip key={c} label={c} selected={city === c} onPress={() => setCity(c)} />
          ))}
        </View>
        <Text style={styles.sheetLabel}>Narx oralig‘i (so‘m)</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Dan"
              placeholder="0"
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
              containerStyle={{ marginBottom: 8 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Gacha"
              placeholder="Cheklanmagan"
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              containerStyle={{ marginBottom: 8 }}
            />
          </View>
        </View>
        <Button title="Qo‘llash" onPress={() => setSheet(false)} style={{ marginTop: 22 }} />
      </Sheet>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  top: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 12 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  filterBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  sheetLabel: { ...typo.label, marginTop: 6, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
}));
