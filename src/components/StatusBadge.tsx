import type { ApplicationStatus, OrderStatus } from '@/types';
import { applicationStatusLabel, orderStatusLabel } from '@/utils/format';

import { Badge } from './Card';
import type { Tone } from './Card';

const orderTone: Record<OrderStatus, Tone> = {
  pending: 'warning',
  accepted: 'info',
  rejected: 'danger',
  completed: 'success',
  cancelled: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge label={orderStatusLabel(status)} tone={orderTone[status]} />;
}

const appTone: Record<ApplicationStatus, Tone> = { pending: 'warning', approved: 'success', rejected: 'danger' };

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge label={applicationStatusLabel(status)} tone={appTone[status]} />;
}
