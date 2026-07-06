// Cấu hình kết nối Supabase API
export const SUPABASE_URL = 'https://eizpyrhqshkhcghkupjy.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpenB5cmhxc2hraGNnaGt1cGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzUyNTcsImV4cCI6MjA5MDk1MTI1N30.Whb7fJVbGMeCPN0M07BchRFvHtIiH5ZTSCeSu2l4RPc';

export const HEADERS = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation" // Yêu cầu Supabase trả về dữ liệu sau khi thêm/sửa
};

// Chế độ chạy API: 'SUPABASE' (kết nối database thật) hoặc 'MOCK' (chạy dữ liệu giả lập offline qua LocalStorage)
export const API_MODE: 'SUPABASE' | 'MOCK' = (() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const cachedMode = window.localStorage.getItem('API_MODE');
    if (cachedMode === 'MOCK' || cachedMode === 'SUPABASE') {
      return cachedMode as 'SUPABASE' | 'MOCK';
    }
  }
  return 'SUPABASE';
})();
