import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/** Ekranga qaytganda ma'lumotni jimgina yangilaydi (birinchi ochilishda emas). */
export function useRefetchOnFocus(refetch: () => void) {
  const first = useRef(true);
  const ref = useRef(refetch);
  useEffect(() => {
    ref.current = refetch;
  }, [refetch]);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      ref.current();
    }, [])
  );
}
