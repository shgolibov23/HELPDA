import { api, upload } from './client';
import type { MultipartFile } from './client';
import type {
  AdminApplication,
  AdminStats,
  AdminUser,
  AppNotification,
  Application,
  ApplicationStatus,
  Business,
  BusinessStats,
  BusinessType,
  Category,
  AvailabilitySlot,
  Coupon,
  ContentReport,
  HomeFeed,
  LoyaltyAccount,
  MatchResult,
  Order,
  OrderMessage,
  OrderStatus,
  Review,
  Service,
  ServiceOffer,
  ServiceRequest,
  SortKey,
  User,
} from '@/types';

type AuthResponse = { access_token: string; user: User };

export type ServiceInput = {
  name: string;
  description: string | null;
  price: number;
  category_id: number;
  image_url: string | null;
};

export type ApplicationInput = {
  business_type: BusinessType;
  business_name: string;
  registration_number: string;
  business_phone: string;
  city: string;
  address: string;
  applicant_position: string;
  category_ids: number[];
  description: string;
};

export type ServiceFilters = {
  q?: string;
  category_id?: number | null;
  city?: string;
  min_price?: number;
  max_price?: number;
  sort?: SortKey;
  limit?: number;
  offset?: number;
};

export const authApi = {
  login: (phone: string, password: string) =>
    api<AuthResponse>('/login', { method: 'POST', body: { phone, password } }),
  register: (body: { full_name: string; phone: string; email?: string; password: string }) =>
    api<AuthResponse>('/register', { method: 'POST', body }),
  me: () => api<User>('/me'),
  updateMe: (body: { full_name: string; email: string | null }) =>
    api<User>('/me', { method: 'PUT', body }),
  uploadAvatar: (image: MultipartFile) =>
    upload<User>('/me/avatar', {}, { image }),
};

export const catalogApi = {
  categories: () => api<Category[]>('/categories'),
  home: () => api<HomeFeed>('/home'),
  services: (f: ServiceFilters) =>
    api<{ total: number; items: Service[] }>('/services', { query: f }),
  service: (id: number) => api<Service>(`/services/${id}`),
  reviews: (id: number) => api<Review[]>(`/services/${id}/reviews`),
  eligibility: (id: number) =>
    api<{ can_review: boolean; has_reviewed: boolean }>(`/services/${id}/review-eligibility`),
  createReview: (id: number, rating: number, comment: string | null) =>
    api<{ message: string }>(`/services/${id}/reviews`, { method: 'POST', body: { rating, comment } }),
  business: (id: number) =>
    api<{ business: Business; services: Service[]; reviews: Review[] }>(`/businesses/${id}`),
  report: (body: { service_id?: number; business_id?: number; reason: string }) =>
    api<{ message: string; id: number }>('/reports', { method: 'POST', body }),
};

export const favoritesApi = {
  list: () => api<Service[]>('/favorites'),
  add: (id: number) => api<{ is_favorite: boolean }>(`/favorites/${id}`, { method: 'POST' }),
  remove: (id: number) => api<{ is_favorite: boolean }>(`/favorites/${id}`, { method: 'DELETE' }),
};

export const ordersApi = {
  create: (body: {
    service_id: number;
    message?: string;
    contact_phone?: string;
    address?: string;
    booking_slot_id?: number;
    coupon_code?: string;
    redeem_points?: boolean;
  }) =>
    api<{ message: string; order: Order }>('/orders', { method: 'POST', body }),
  mine: () => api<Order[]>('/orders/my'),
  cancel: (id: number) => api<{ message: string }>(`/orders/${id}/cancel`, { method: 'POST' }),
  notifications: () =>
    api<{ unread_count: number; items: AppNotification[] }>('/notifications'),
  markNotificationRead: (id: number) =>
    api<{ read: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
  messages: (id: number) => api<OrderMessage[]>(`/orders/${id}/messages`),
  sendMessage: (id: number, body: string) =>
    api<{ id: number; created_at: string }>(`/orders/${id}/messages`, { method: 'POST', body: { body } }),
  availableSlots: (businessId: number) =>
    api<AvailabilitySlot[]>(`/businesses/${businessId}/slots`),
  loyalty: () => api<LoyaltyAccount>('/loyalty/me'),
};

export const marketplaceApi = {
  requests: (status?: string) =>
    api<ServiceRequest[]>('/service-requests', { query: { status } }),
  request: (id: number) =>
    api<{ request: ServiceRequest; offers: ServiceOffer[] }>(`/service-requests/${id}`),
  createRequest: (body: {
    category_id?: number;
    title: string;
    description: string;
    city: string;
    budget_min?: number;
    budget_max?: number;
  }) => api<ServiceRequest>('/service-requests', { method: 'POST', body }),
  closeRequest: (id: number) =>
    api<{ id: number; status: string }>(`/service-requests/${id}/close`, { method: 'POST' }),
  createOffer: (id: number, body: { price: number; duration_days?: number; message: string }) =>
    api<{ id: number; message: string }>(`/service-requests/${id}/offers`, { method: 'POST', body }),
  selectOffer: (id: number) =>
    api<{ message: string; order: Order }>(`/service-offers/${id}/select`, { method: 'POST' }),
  businessSlots: () => api<AvailabilitySlot[]>('/business/availability'),
  addSlot: (body: { starts_at: string; ends_at: string }) =>
    api<{ id: number; status: string }>('/business/availability', { method: 'POST', body }),
  deleteSlot: (id: number) =>
    api<{ deleted: boolean }>(`/business/availability/${id}`, { method: 'DELETE' }),
  coupons: () => api<Coupon[]>('/business/coupons'),
  createCoupon: (body: {
    code: string;
    discount_type: 'percent' | 'fixed';
    value: number;
    max_redemptions?: number;
  }) => api<{ id: number; code: string }>('/business/coupons', { method: 'POST', body }),
  setCouponActive: (id: number, is_active: boolean) =>
    api<{ id: number; is_active: boolean }>(`/business/coupons/${id}/active`, { method: 'PATCH', query: { is_active } }),
  match: (query: string, use_ai: boolean, city?: string) =>
    api<{ items: MatchResult[]; ai_used: boolean; message: string }>('/match', { method: 'POST', body: { query, use_ai, city } }),
  registerPushToken: (token: string, device_id?: string) =>
    api<{ registered: boolean }>('/push-token', { method: 'PUT', body: { token, device_id } }),
  unregisterPushToken: (token: string) =>
    api<{ registered: boolean }>('/push-token', { method: 'DELETE', query: { token } }),
};

export const businessApi = {
  apply: (body: ApplicationInput, document?: MultipartFile | null) => {
    if (!document) return api<{ message: string; application: Application }>('/business/apply', { method: 'POST', body });
    const fields: Record<string, string | number> = {
      business_type: body.business_type,
      business_name: body.business_name,
      registration_number: body.registration_number,
      business_phone: body.business_phone,
      city: body.city,
      address: body.address,
      applicant_position: body.applicant_position,
      description: body.description,
    };
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (key !== 'category_ids') form.append(key, String(value));
    }
    for (const id of body.category_ids) form.append('category_ids', String(id));
    form.append('document', document.file ?? ({ uri: document.uri, name: document.name, type: document.type } as unknown as Blob), document.name);
    return api<{ message: string; application: Application }>('/business/apply-with-document', {
      method: 'POST',
      body: form,
      timeoutMs: 60000,
    });
  },
  myApplication: () => api<{ application: Application | null }>('/business/my-application'),
  me: () => api<{ business: Business; stats: BusinessStats }>('/business/me'),
  update: (body: {
    description: string | null;
    phone: string;
    city: string;
    address: string;
    logo: string | null;
    working_hours: string | null;
    portfolio_images: string[];
    maps_url: string | null;
    category_ids: number[];
  }) => api<{ message: string }>('/business/me', { method: 'PUT', body }),
  services: () => api<Service[]>('/business/services'),
  service: (id: number) => api<Service>(`/business/services/${id}`),
  createService: (body: ServiceInput) =>
    api<{ id: number }>('/business/services', { method: 'POST', body }),
  updateService: (id: number, body: ServiceInput) =>
    api<{ message: string }>(`/business/services/${id}`, { method: 'PUT', body }),
  toggleService: (id: number) =>
    api<{ is_active: boolean }>(`/business/services/${id}/toggle`, { method: 'PATCH' }),
  deleteService: (id: number) => api<{ message: string }>(`/business/services/${id}`, { method: 'DELETE' }),
  orders: (status?: OrderStatus) => api<Order[]>('/business/orders', { query: { status } }),
  orderAction: (
    id: number,
    action: 'accept' | 'reject' | 'complete',
    reason?: string,
    agreement?: { agreed_scope?: string; deadline_at?: string; final_price?: number }
  ) =>
    api<{ status: OrderStatus }>(`/business/orders/${id}`, { method: 'PATCH', body: { action, reason, ...agreement } }),
  replyToReview: (id: number, response: string) =>
    api<{ message: string }>(`/business/reviews/${id}/reply`, { method: 'PATCH', body: { response } }),
};

export const adminApi = {
  stats: () => api<AdminStats>('/admin/stats'),
  reports: () => api<ContentReport[]>('/admin/reports'),
  resolveReport: (id: number, status: 'resolved' | 'dismissed') =>
    api<{ id: number; status: string }>(`/admin/reports/${id}`, { method: 'PATCH', body: { status } }),
  applications: (status: ApplicationStatus) =>
    api<AdminApplication[]>('/admin/business-applications', { query: { status } }),
  applicationDocumentLink: (id: number) =>
    api<{ url: string }>(`/admin/business-applications/${id}/document-link`),
  approve: (id: number) => api<{ message: string }>(`/admin/business-applications/${id}/approve`, { method: 'POST' }),
  reject: (id: number, reason: string) =>
    api<{ message: string }>(`/admin/business-applications/${id}/reject`, { method: 'POST', body: { reason } }),
  users: (q?: string) => api<{ total: number; items: AdminUser[] }>('/admin/users', { query: { q } }),
  setUserActive: (id: number, is_active: boolean) =>
    api<{ is_active: boolean }>(`/admin/users/${id}/active`, { method: 'PATCH', body: { is_active } }),
  businesses: () => api<Business[]>('/admin/businesses'),
  setBusinessActive: (id: number, is_active: boolean) =>
    api<{ is_active: boolean }>(`/admin/businesses/${id}/active`, { method: 'PATCH', body: { is_active } }),
  setBusinessFeatured: (id: number, is_featured: boolean) =>
    api<{ is_featured: boolean }>(`/admin/businesses/${id}/featured`, { method: 'PATCH', body: { is_featured } }),
  services: () => api<Service[]>('/admin/services'),
  setServiceBlocked: (id: number, is_blocked: boolean) =>
    api<{ is_blocked: boolean }>(`/admin/services/${id}/block`, { method: 'PATCH', body: { is_blocked } }),
};

export const telegramApi = {
  status: () => api<{ configured: boolean; linked: boolean }>('/me/telegram'),
  link: () => api<{ url: string }>('/me/telegram/link', { method: 'POST' }),
  unlink: () => api<{ linked: boolean }>('/me/telegram', { method: 'DELETE' }),
};
