import { t } from '@/i18n';
import type { ApplicationStatus, BusinessType, OrderStatus } from '@/types';

export function formatPrice(price: number): string {
  if (!price) return 'Kelishiladi';
  const s = Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${s} ${t('currency')}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function formatPhone(phone: string): string {
  const m = phone.match(/^998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

/** Foydalanuvchi kiritgan raqamni 998XXXXXXXXX ko'rinishiga keltiradi; xato bo'lsa null. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 9) digits = `998${digits}`;
  return digits.length === 12 && digits.startsWith('998') ? digits : null;
}

export function isValidEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

export function orderStatusLabel(s: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    pending: t('statusPending'),
    accepted: t('statusAccepted'),
    rejected: t('statusRejected'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };
  return map[s];
}

export function applicationStatusLabel(s: ApplicationStatus): string {
  return s === 'pending' ? t('statusPending') : s === 'approved' ? t('statusApproved') : t('statusRejected');
}

export function businessTypeLabel(type: BusinessType | string | null): string {
  if (type === 'mchj') return t('typeMchj');
  if (type === 'ytt') return t('typeYtt');
  if (type === 'self_employed') return t('typeSelf');
  return '';
}

export function roleLabel(role: string): string {
  return role === 'admin' ? t('roleAdmin') : role === 'business' ? t('roleBusiness') : t('roleClient');
}
