import { User } from '../../types';
import { SUPABASE_URL, HEADERS, API_MODE } from './client';
import { getLocalRecords } from './localStore';

export let currentUser: User | null = null;

export const setCurrentUser = (user: User | null) => {
  currentUser = user;
};

export async function login(username: string, password: string): Promise<User> {
  // 1. Chế độ MOCK hoàn toàn
  if (API_MODE === 'MOCK') {
    return loginMock(username, password);
  }

  // 2. Chế độ SUPABASE
  try {
    const url = `${SUPABASE_URL}/rest/v1/config_users?user_name=eq.${username}&password=eq.${password}&select=*`;
    const response = await fetch(url, { method: 'GET', headers: HEADERS });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lỗi Supabase: ${errorText}`);
    }

    const users = await response.json();
    if (users.length === 0) throw new Error("Sai tên đăng nhập hoặc mật khẩu");
    return users[0] as User;
  } catch (err) {
    console.warn("⚠️ Không thể kết nối Supabase. Tự động đăng nhập qua dữ liệu offline!");
    return loginMock(username, password);
  }
}

function loginMock(username: string, password: string): User {
  const users = getLocalRecords('config_users');
  const user = users.find(u => u.user_name === username && String(u.password) === String(password));
  if (!user) throw new Error("Sai tên đăng nhập hoặc mật khẩu (Chế độ offline)");
  return user as User;
}
