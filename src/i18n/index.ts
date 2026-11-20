import uz from './uz';

export type Locale = 'uz' | 'ru' | 'en';
export type TKey = keyof typeof uz;

// Kelajakda: import ru from './ru'; dictionaries.ru = ru;
const dictionaries: Partial<Record<Locale, Partial<Record<TKey, string>>>> = { uz };

let locale: Locale = 'uz';

export function setLocale(next: Locale) {
  locale = next;
}

export function getLocale(): Locale {
  return locale;
}

export function t(key: TKey, vars?: Record<string, string | number>): string {
  let text: string = dictionaries[locale]?.[key] ?? uz[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
