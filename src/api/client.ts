import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { t } from '@/i18n';

declare const process: { env: Record<string, string | undefined> };

/**
 * Backend manzili. Tartib:
 * 1) EXPO_PUBLIC_API_URL (.env),
 * 2) Expo dev-server o'rnatilgan MacBook IP manzili (Expo Go uchun avtomatik),
 * 3) emulyatorlar uchun standart manzillar.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:8000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
  get isNetwork() {
    return this.status === 0;
  }
}

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

type Query = Record<string, string | number | boolean | null | undefined>;

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  timeoutMs?: number;
};

export type MultipartFile = {
  uri: string;
  name: string;
  type: string;
  file?: Blob;
};

function multipartFile(form: FormData, key: string, value: MultipartFile) {
  if (value.file) {
    form.append(key, value.file, value.name);
  } else {
    form.append(key, { uri: value.uri, name: value.name, type: value.type } as unknown as Blob);
  }
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildQuery(query?: Query): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, query, timeoutMs = 15000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const sentToken = authToken;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isMultipart) headers['Content-Type'] = 'application/json';
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : isMultipart ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, t('networkMessage'));
  } finally {
    clearTimeout(timer);
  }

  let data: unknown = null;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    const message = typeof detail === 'string' ? detail : t('unknownError');
    if (response.status === 401 && sentToken && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export async function upload<T>(
  path: string,
  fields: Record<string, string | number>,
  files: Record<string, MultipartFile>,
): Promise<T> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  for (const [key, value] of Object.entries(files)) multipartFile(form, key, value);
  return api<T>(path, { method: 'POST', body: form, timeoutMs: 60000 });
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return t('unknownError');
}
