import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { FlatList, Text, View, useWindowDimensions } from 'react-native';
import type { ReactNode } from 'react';

import { catalogApi } from '@/api/endpoints';
import { BusinessCard } from '@/components/BusinessCard';
import { SectionHeader } from '@/components/Card';
import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { ServiceCard } from '@/components/ServiceCard';
import { EmptyState, ErrorState, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useFetch } from '@/hooks/useFetch';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { t } from '@/i18n';
import { colors, gradients, radius, shadow, typo, makeStyles } from '@/theme';
import type { HomeFeed, Service } from '@/types';

async function loadHome() {
  const [feed, categories] = await Promise.all([catalogApi.home(), catalogApi.categories()]);
  return { feed, categories };
}

function patchFavorite(feed: HomeFeed, id: number, value: boolean): HomeFeed {
  const patch = (list: Service[]) => list.map((s) => (s.id === id ? { ...s, is_favorite: value } : s));
  return { ...feed, popular: patch(feed.popular), recent: patch(feed.recent) };
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const toggleFavorite = useFavoriteToggle();
  const { data, loading, error, refreshing, refresh, reload, silentReload, setData } = useFetch(loadHome, [user?.id]);
  useRefetchOnFocus(silentReload);

  const onFavorite = async (s: Service) => {
    const value = await toggleFavorite(s);
    if (value !== null && data) setData({ ...data, feed: patchFavorite(data.feed, s.id, value) });
  };

  const openService = (s: Service) => router.push(`/service/${s.id}`);
  const openBusiness = (id: number) => router.push(`/company/${id}`);
  const openCategory = (id: number) => router.push({ pathname: '/search', params: { category_id: String(id) } });
  const categoryColumns = width < 360 ? 3 : 4;
  const categoryWidth = (width - 32 - (categoryColumns - 1) * 10) / categoryColumns;

  const empty = data && data.feed.recent.length === 0 && data.feed.recommended_businesses.length === 0;

  let body: ReactNode;
  if (loading) body = <LoadingView />;
  else if (error || !data) body = <ErrorState message={error ?? t('unknownError')} onRetry={reload} />;
  else {
    const { feed, categories } = data;
    body = (
      <>
        <PressableScale onPress={() => router.push('/search')} scaleTo={0.985} style={styles.heroWrap}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>HELPDA BILAN</Text>
              <Text style={styles.heroTitle}>Kerakli xizmatlar bir joyda!</Text>
              <Text style={styles.heroText}>Ishonchli mutaxassislarni toping va buyurtma bering.</Text>
              <View style={styles.heroAction}>
                <Text style={styles.heroActionText}>Xizmatlarni ko‘rish</Text>
                <Icon name="arrow-forward" size={16} color={colors.greenDark} />
              </View>
            </View>
            <View style={styles.heroArt}>
              <Icon name="construct-outline" size={42} color={colors.white} />
            </View>
          </LinearGradient>
        </PressableScale>

        <View style={styles.trustNote}>
          <Icon name="shield-checkmark" size={18} color={colors.greenMid} />
          <Text style={styles.trustText}>Bizneslar admin tomonidan ko‘rib chiqiladi</Text>
        </View>

        <SectionHeader
          title="Kategoriyalar"
          actionLabel="Barchasi"
          onAction={() => router.push('/search')}
        />
        <View style={styles.categoryGrid}>
          {categories.slice(0, 8).map((category) => (
            <CategoryTile
              key={category.id}
              category={category}
              onPress={() => openCategory(category.id)}
              style={{ width: categoryWidth }}
            />
          ))}
        </View>

        {empty ? (
          <EmptyState
            icon="rocket-outline"
            title="Xizmatlar tez orada qo‘shiladi"
            message="Hozircha e’lon qilingan xizmatlar yo‘q. Biznesingiz bo‘lsa, birinchilardan bo‘lib qo‘shiling."
            actionLabel="Biznesimni qo‘shish"
            onAction={() => router.push(user ? '/business-apply' : '/auth')}
          />
        ) : null}

        {feed.popular.length > 0 ? (
          <>
            <SectionHeader title="Ommabop xizmatlar" />
            <HList data={feed.popular} render={(s) => <ServiceCard width={250} service={s} onPress={() => openService(s)} onToggleFavorite={() => onFavorite(s)} />} />
          </>
        ) : null}

        {feed.featured_businesses.length > 0 ? (
          <>
            <SectionHeader title="Tanlangan bizneslar" />
            <HList data={feed.featured_businesses} render={(b) => <BusinessCard width={270} business={b} onPress={() => openBusiness(b.id)} />} />
          </>
        ) : null}

        {feed.recommended_businesses.length > 0 ? (
          <>
            <SectionHeader title="Tavsiya etilgan bizneslar" />
            <HList data={feed.recommended_businesses} render={(b) => <BusinessCard width={270} business={b} onPress={() => openBusiness(b.id)} />} />
          </>
        ) : null}

        {feed.recent.length > 0 ? (
          <>
            <SectionHeader title="Yangi qo‘shilganlar" actionLabel="Hammasi" onAction={() => router.push('/search')} />
            <View style={{ paddingHorizontal: 16, gap: 14 }}>
              {feed.recent.map((s) => (
                <ServiceCard key={s.id} service={s} onPress={() => openService(s)} onToggleFavorite={() => onFavorite(s)} />
              ))}
            </View>
          </>
        ) : null}
      </>
    );
  }

  return (
    <Screen padded={false} refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <View style={styles.headRow}>
          <View style={styles.logo}>
            <Icon name="home" size={24} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>{t('appName')}</Text>
            <Text style={styles.slogan}>{user ? `Salom, ${user.full_name.split(' ')[0]}!` : t('slogan')}</Text>
          </View>
        </View>
        <PressableScale onPress={() => router.push('/search')} scaleTo={0.985} style={styles.searchBar}>
          <Icon name="search-outline" size={20} color={colors.muted} />
          <Text style={styles.searchText}>Xizmat yoki biznes qidiring</Text>
        </PressableScale>
      </View>
      {body}
    </Screen>
  );
}

function HList<T extends { id: number }>({ data, render }: { data: T[]; render: (item: T) => ReactNode }) {
  return (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(i) => String(i.id)}
      contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingBottom: 6 }}
      renderItem={({ item }) => <View>{render(item)}</View>}
    />
  );
}

const styles = makeStyles(() => ({
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  logo: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 1.1 },
  slogan: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 50,
    ...shadow.card,
  },
  searchText: { ...typo.body, color: colors.placeholder },
  heroWrap: { marginHorizontal: 16, marginTop: 10, borderRadius: radius.lg, ...shadow.float },
  hero: { minHeight: 188, borderRadius: radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  heroCopy: { flex: 1, alignItems: 'flex-start', gap: 7 },
  heroEyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { color: colors.white, fontSize: 21, lineHeight: 26, fontWeight: '900', maxWidth: 240 },
  heroText: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18, maxWidth: 230 },
  heroAction: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 13 },
  heroActionText: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  heroArt: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  trustNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginHorizontal: 16, padding: 12, borderRadius: radius.md, backgroundColor: colors.greenSoft },
  trustText: { flex: 1, color: colors.greenMid, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
}));
