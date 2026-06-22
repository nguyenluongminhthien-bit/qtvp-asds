import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { User } from '../types';

interface AppUser {
  id: string;
  user_name: string;
  ho_ten: string;
  id_don_vi: string;
  quyen: string; 
  quyen_truy_cap?: string; 
  quyen_chi_tiet?: string;
}

interface AuthContextType {
  user: AppUser | null;
  login: (username: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      // Đồng bộ thông tin user xuống apiService
      apiService.setCurrentUser({
        id: parsedUser.id,
        user_name: parsedUser.user_name,
        ho_ten: parsedUser.ho_ten,
        id_don_vi: parsedUser.id_don_vi,
        quyen: parsedUser.quyen,
        quyen_truy_cap: parsedUser.quyen_truy_cap // 🟢 Bổ sung nạp quyền truy cập từ Cache
      } as User);
    }
  }, []);

  const login = async (username: string, pass: string) => {
    try {
      const responseData = await apiService.login(username, pass);
      
      if (!responseData) throw new Error("Không nhận được dữ liệu từ máy chủ.");
      
      let userData: any = null;
      if (responseData.data) {
        userData = responseData.data; 
      } else if (Array.isArray(responseData)) {
        userData = responseData[0];   
      } else {
        userData = responseData;      
      }

      if (!userData) throw new Error("Dữ liệu tài khoản bị trống.");

      // 🟢 1. PHÂN LỌC QUYỀN TRUY CẬP (NHẬN TRỰC TIẾP TỪ DATABASE)
      const rawRole = String(userData.quyen || userData.NhomQuyen || userData.role || 'USER').trim();

      // 🟢 2. QUYẾT ĐỊNH ID_DON_VI (Chỉ duy nhất ADMIN mới được ép thành 'ALL')
      let finalIdDonVi = '';
      if (rawRole.toUpperCase() === 'ADMIN') {
        finalIdDonVi = 'ALL';
      } else {
        finalIdDonVi = String(userData.id_don_vi || userData.ID_DonVi || userData.idDonVi || 'UNKNOWN').trim();
      }

      // 🟢 3. CHUẨN HÓA THÔNG TIN NGƯỜI DÙNG (Bao gồm cả Cột Truy Cập)
      const mappedUser: AppUser = {
        id: String(userData.id || userData.ID_User || 'Unknown'),
        user_name: String(userData.user_name || userData.Username || userData.username || username),
        ho_ten: String(userData.ho_ten || userData.HoTen || userData.hoTen || 'Người dùng'),
        id_don_vi: finalIdDonVi,
        quyen: rawRole, // Lấy chuẩn chữ viewer_hanche
        quyen_truy_cap: String(userData.quyen_truy_cap || ''),
        quyen_chi_tiet: String(userData.quyen_chi_tiet || '')
      };

      // Lưu User vào state và LocalStorage
      setUser(mappedUser);
      localStorage.setItem('authUser', JSON.stringify(mappedUser));
      
      apiService.setCurrentUser(mappedUser as unknown as User);
      apiService.writeLog('ĐĂNG NHẬP', 'Truy cập hệ thống');

      // Tải ngầm
      setTimeout(() => {
        apiService.getDonVi().catch(()=>{});
        apiService.getPersonnel().catch(()=>{});
        apiService.getAnNinh().catch(()=>{});
        apiService.getPhapNhan().catch(()=>{});
        if (apiService.getPhongHop) apiService.getPhongHop().catch(()=>{});
      }, 500);

    } catch (error) {
      console.error("Login Error:", error);
      throw error; 
    }
  };

  const logout = () => {
    apiService.writeLog('ĐĂNG XUẤT', 'Thoát hệ thống');
    setTimeout(() => {
      setUser(null);
      localStorage.removeItem('authUser');
      apiService.setCurrentUser(null);
      window.location.reload();
    }, 500);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};