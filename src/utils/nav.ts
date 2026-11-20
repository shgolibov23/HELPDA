import { router } from 'expo-router';

/** Stack ichidan chiqib, kerakli tabga o'tadi. */
export function goToTab(path: '/' | '/search' | '/orders' | '/favorites' | '/dashboard' | '/profile') {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(path);
}
