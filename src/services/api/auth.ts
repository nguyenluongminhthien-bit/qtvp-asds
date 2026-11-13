import { User } from '../../types';
import { SUPABASE_URL, HEADERS, API_MODE } from './client';
import { getLocalRecords } from './localStore';

export let currentUser: User | null = null;

export const CONFIG_USERS_AUTH_COLUMNS = 'id,user_name,password,ho_ten,id_don_vi,quyen,quyen_truy_cap,quyen_chi_tiet,can_view,can_create,can_update,can_delete,can_delete_unit,can_lock_period';

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
    const url = `${SUPABASE_URL}/rest/v1/config_users?user_name=eq.${username}&password=eq.${password}&select=${CONFIG_USERS_AUTH_COLUMNS}`;
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

export async function validateAndRefreshUser(id: string): Promise<User | null> {
  // 1. Chế độ MOCK hoàn toàn
  if (API_MODE === 'MOCK') {
    const users = getLocalRecords('config_users');
    return (users.find(u => String(u.id) === String(id)) as User) || null;
  }

  // 2. Chế độ SUPABASE
  try {
    const url = `${SUPABASE_URL}/rest/v1/config_users?id=eq.${id}&select=${CONFIG_USERS_AUTH_COLUMNS}`;
    const response = await fetch(url, { method: 'GET', headers: HEADERS });
    if (!response.ok) return null;
    
    const users = await response.json();
    if (users.length === 0) return null;
    return users[0] as User;
  } catch (err) {
    console.warn("⚠️ Không thể kết nối Supabase để đồng bộ tài khoản. Sử dụng dữ liệu cache.");
    return null;
  }
}

function loginMock(username: string, password: string): User {
  const users = getLocalRecords('config_users');
  const user = users.find(u => u.user_name === username && String(u.password) === String(password));
  if (!user) throw new Error("Sai tên đăng nhập hoặc mật khẩu (Chế độ offline)");
  return user as User;
}

