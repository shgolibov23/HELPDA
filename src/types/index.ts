export type Role = 'client' | 'business' | 'admin';

export type User = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  role: Role;
  avatar_url: string | null;
};

export type Category = { id: number; name: string; icon: string | null };

export type Verification = { level: string; registry_verified: boolean };

export type BusinessBrief = {
  id: number;
  name: string;
  logo: string | null;
  city: string | null;
  address: string | null;
  phone: string;
  verification: Verification;
};

export type Service = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  is_blocked: boolean;
  created_at: string;
  category: Category | null;
  business: BusinessBrief;
  rating: number | null;
  review_count: number;
  is_favorite: boolean;
};

export type Business = {
  id: number;
  name: string;
  description: string | null;
  working_hours: string | null;
  portfolio_images: string[];
  maps_url: string | null;
  logo: string | null;
  phone: string;
  city: string | null;
  address: string | null;
  business_type: string | null;
  categories: Category[];
  is_featured: boolean;
  is_active: boolean;
  verification: Verification;
  rating: number | null;
  review_count: number;
  services_count: number;
  created_at: string;
};

export type Review = {
  id: number;
  rating: number;
  comment: string | null;
  business_response: string | null;
  business_response_at: string | null;
  user_name: string;
  created_at: string;
};

export type AppNotification = {
  id: number;
  kind: string;
  title: string;
  message: string;
  order_id: number | null;
  read_at: string | null;
  created_at: string;
};

export type ContentReport = {
  id: number;
  reporter_name: string;
  service_id: number | null;
  service_name: string | null;
  business_id: number | null;
  business_name: string | null;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  admin_note: string | null;
  created_at: string;
};

export type OrderStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export type Order = {
  id: number;
  service_id: number | null;
  service_name: string;
  price: number;
  status: OrderStatus;
  message: string | null;
  contact_phone: string;
  address: string | null;
  original_price: number;
  discount_amount: number;
  redeemed_points: number;
  booking_slot_id: number | null;
  agreed_scope: string | null;
  deadline_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  business?: { id: number; name: string; phone: string };
  customer?: { id: number; full_name: string };
};

export type ServiceRequest = {
  id: number;
  customer_id: number;
  customer_name: string | null;
  category_id: number | null;
  title: string;
  description: string;
  city: string;
  budget_min: number | null;
  budget_max: number | null;
  desired_date: string | null;
  status: 'open' | 'awarded' | 'closed';
  created_at: string;
};

export type ServiceOffer = {
  id: number;
  request_id: number;
  business_id: number;
  business_name: string;
  business_verification: string;
  price: number;
  duration_days: number | null;
  message: string;
  status: 'pending' | 'selected' | 'rejected';
  created_at: string;
};

export type AvailabilitySlot = {
  id: number;
  starts_at: string;
  ends_at: string;
  status?: 'available' | 'reserved' | 'booked' | 'cancelled';
};

export type OrderMessage = {
  id: number;
  sender_id: number;
  sender_name: string;
  body: string;
  created_at: string;
};

export type Coupon = {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed';
  value: number;
  max_redemptions: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

export type LoyaltyAccount = {
  points: number;
  point_value_uzs: number;
  earn_rule: string;
  transactions: { id: number; points: number; kind: string; order_id: number | null; created_at: string }[];
};

export type MatchResult = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  business_name: string;
  city: string | null;
  rating: number | null;
  review_count: number;
  match_reason: string;
};

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type BusinessType = 'mchj' | 'ytt' | 'self_employed';

export type Application = {
  id: number;
  business_name: string;
  business_type: BusinessType;
  registration_number: string;
  business_phone: string;
  city: string;
  address: string;
  applicant_position: string;
  category_ids: number[];
  categories: Category[];
  description: string;
  status: ApplicationStatus;
  rejection_reason: string | null;
  ai_status: 'pending' | 'not_configured' | 'completed' | 'failed';
  ai_recommendation: 'matches' | 'mismatch' | 'needs_review' | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  document_available: boolean;
  created_at: string;
  verification_note: string;
};

export type AdminApplication = Application & {
  applicant_name: string;
  applicant_phone: string;
};

export type AdminUser = User & { is_active: boolean; created_at: string };

export type HomeFeed = {
  popular: Service[];
  recent: Service[];
  featured_businesses: Business[];
  recommended_businesses: Business[];
};

export type BusinessStats = {
  total_services: number;
  active_services: number;
  orders: Record<OrderStatus, number>;
  total_orders: number;
  orders_last_30_days: number;
  completed_last_30_days: number;
  revenue_last_30_days: number;
};

export type AdminStats = {
  users: number;
  businesses: number;
  services: number;
  blocked_services: number;
  reviews: number;
  applications: Record<ApplicationStatus, number>;
  orders: Record<OrderStatus, number>;
  orders_last_30_days: number;
};

export type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'rating';
