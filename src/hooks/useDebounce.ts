import { useState, useEffect } from 'react';

/**
 * Hook hoãn cập nhật giá trị (Debounce) giúp tăng hiệu năng cho các ô tìm kiếm.
 * Chỉ cập nhật value sau khoảng thời gian delay (mặc định 250ms).
 */
export function useDebounce<T>(value: T, delay: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
