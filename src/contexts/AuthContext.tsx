import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { User } from '../types';
import { parseModuleCrud, ALL_MODULE_IDS_SET } from '../constants/permissions';

interface AppUser {
  id: string;
  user_name: string;
  ho_ten: string;
  id_don_vi: string;
  quyen: string;
  quyen_truy_cap?: string;
  quyen_chi_tiet?: string;
  password?: string; // Mật khẩu dùng để đối chiếu đổi mật khẩu ngầm
  can_view?: boolean;
  can_create?: boolean;
  can_update?: boolean;
  can_delete?: boolean;
  can_delete_unit?: boolean;
  can_lock_period?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  login: (username: string, pass: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  checkPermission: (moduleId: string) => boolean;
  canView: (moduleOrUnitId?: string, unitId?: string) => boolean;
  canCreate: (moduleOrUnitId?: string, unitId?: string) => boolean;
  canUpdate: (moduleOrUnitId?: string, unitId?: string) => boolean;
  canDelete: (moduleOrUnitId?: string, unitId?: string) => boolean;
  canDeleteUnit: (unitId?: string) => boolean;
  canLockPeriod: (unitId?: string) => boolean;
  hasRule: (ruleId: string) => boolean;
  getModulePermissions: (moduleId: string) => { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean };
  sessionDays: number;
  setSessionDays: (days: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Hằng số phiên bản ứng dụng
const APP_VERSION = '1.1.0';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [sessionDays, setSessionDaysState] = useState<number>(() => {
    const saved = localStorage.getItem('app_session_days');
    const n = saved ? parseInt(saved, 10) : 2;
    return !isNaN(n) && n > 0 ? n : 2;
  });

  const setSessionDays = (days: number) => {
    const validDays = Math.max(1, days);
    setSessionDaysState(validDays);
    localStorage.setItem('app_session_days', String(validDays));
    if (localStorage.getItem('authUser')) {
      localStorage.setItem('sessionExpiry', String(Date.now() + validDays * 24 * 60 * 60 * 1000));
    }
  };

  const getSessionExpiryMs = () => sessionDays * 24 * 60 * 60 * 1000;

  useEffect(() => {
    // 🟢 TỰ ĐỘNG DỌN DẸP NHẬT KÝ HỆ THỐNG CŨ (> 5 ngày) CHẠY NGẦM
    apiService.cleanOldLogs?.(5).catch(err => {
      console.warn("Lỗi tự động dọn dẹp log:", err);
    });

    // 🟢 1. KIỂM TRA PHIÊN BẢN ỨNG DỤNG (APP VERSIONING)
    const currentVersion = localStorage.getItem('appVersion');
    if (currentVersion !== APP_VERSION) {
      // Xóa thông tin đăng nhập và cache cũ khi có cập nhật lớn để tránh xung đột
      localStorage.removeItem('authUser');
      localStorage.removeItem('sessionExpiry');
      sessionStorage.removeItem('authUser');

      // Xóa các dữ liệu API đệm (cache) lưu trong localStorage
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('api_cache_') || key.startsWith('offline_records_'))) {
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem('appVersion', APP_VERSION);
    }

    const storedUser = localStorage.getItem('authUser') || sessionStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);

      // 🟢 2. KIỂM TRA THỜI HẠN PHIÊN (SESSION EXPIRATION - 2 NGÀY)
      if (localStorage.getItem('authUser')) {
        const expiry = localStorage.getItem('sessionExpiry');
        if (expiry && Date.now() > Number(expiry)) {
          // Phiên đăng nhập đã quá hạn 2 ngày -> tự động logout
          localStorage.removeItem('authUser');
          localStorage.removeItem('sessionExpiry');
          window.location.reload();
          return;
        }
      }

      // Đăng nhập nhanh bằng dữ liệu cache (tránh giật lag giao diện)
      setUser(parsedUser);
      apiService.setCurrentUser(parsedUser as unknown as User);

      // 🟢 3. ĐỒNG BỘ NGẦM QUYỀN HẠN & MẬT KHẨU TỪ DATABASE (DATABASE SYNC)
      apiService.validateAndRefreshUser(parsedUser.id).then((freshUser) => {
        if (freshUser) {
          // A. Kiểm tra xem mật khẩu có bị đổi không
          if (parsedUser.password && freshUser.password !== parsedUser.password) {
            logout();
            alert("Tài khoản của bạn đã bị đổi mật khẩu hoặc khóa bởi quản trị viên. Vui lòng đăng nhập lại!");
            return;
          }

          // B. Tính toán đơn vị mặc định
          let finalIdDonVi = '';
          if (String(freshUser.quyen || '').toUpperCase() === 'ADMIN') {
            finalIdDonVi = 'ALL';
          } else {
            finalIdDonVi = freshUser.id_don_vi ? String(freshUser.id_don_vi).trim() : 'HO';
          }

          // C. So sánh dữ liệu mới và cũ
          const hasChanges =
            freshUser.ho_ten !== parsedUser.ho_ten ||
            finalIdDonVi !== parsedUser.id_don_vi ||
            freshUser.quyen !== parsedUser.quyen ||
            (freshUser.quyen_truy_cap || '') !== (parsedUser.quyen_truy_cap || '') ||
            (freshUser.quyen_chi_tiet || '') !== (parsedUser.quyen_chi_tiet || '') ||
            Boolean(freshUser.can_view) !== Boolean(parsedUser.can_view) ||
            Boolean(freshUser.can_create) !== Boolean(parsedUser.can_create) ||
            Boolean(freshUser.can_update) !== Boolean(parsedUser.can_update) ||
            Boolean(freshUser.can_delete) !== Boolean(parsedUser.can_delete) ||
            Boolean(freshUser.can_delete_unit) !== Boolean(parsedUser.can_delete_unit) ||
            Boolean(freshUser.can_lock_period) !== Boolean(parsedUser.can_lock_period);

          if (hasChanges) {
            const rawRoleFresh = String(freshUser.quyen || 'USER');
            const updatedUser: AppUser = {
              id: parsedUser.id,
              user_name: parsedUser.user_name,
              ho_ten: String(freshUser.ho_ten || 'Người dùng'),
              id_don_vi: finalIdDonVi,
              quyen: rawRoleFresh,
              quyen_truy_cap: String(freshUser.quyen_truy_cap || ''),
              quyen_chi_tiet: String(freshUser.quyen_chi_tiet || ''),
              password: String(freshUser.password || ''),
              can_view: rawRoleFresh.toUpperCase() === 'ADMIN' ? true : (freshUser.can_view !== undefined ? Boolean(freshUser.can_view) : true),
              can_create: rawRoleFresh.toUpperCase() === 'ADMIN' ? true : (freshUser.can_create !== undefined ? Boolean(freshUser.can_create) : true),
              can_update: rawRoleFresh.toUpperCase() === 'ADMIN' ? true : (freshUser.can_update !== undefined ? Boolean(freshUser.can_update) : true),
              can_delete: rawRoleFresh.toUpperCase() === 'ADMIN' ? true : Boolean(freshUser.can_delete),
              can_delete_unit: rawRoleFresh.toUpperCase() === 'ADMIN' ? true : Boolean(freshUser.can_delete_unit),
              can_lock_period: rawRoleFresh.toUpperCase() === 'ADMIN' ? true : Boolean(freshUser.can_lock_period)
            };

            setUser(updatedUser);
            if (localStorage.getItem('authUser')) {
              localStorage.setItem('authUser', JSON.stringify(updatedUser));
              // Gia hạn thời điểm hết hạn từ lúc đồng bộ thành công
              localStorage.setItem('sessionExpiry', String(Date.now() + getSessionExpiryMs()));
            } else {
              sessionStorage.setItem('authUser', JSON.stringify(updatedUser));
            }
            apiService.setCurrentUser(updatedUser as unknown as User);
            console.log("Đã đồng bộ ngầm thông tin phân quyền mới thành công.");
          }
        } else {
          // Tài khoản không tồn tại trong DB (bị xóa) -> tự động logout
          logout();
          alert("Tài khoản của bạn không còn tồn tại trên hệ thống!");
        }
      }).catch((err) => {
        console.warn("⚠️ Không thể đồng bộ ngầm thông tin phân quyền (Đang chạy offline):", err);
      });
    }
  }, []);

  const login = async (username: string, pass: string, remember: boolean = false) => {
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
        const rawId = userData.id_don_vi || userData.ID_DonVi || userData.idDonVi;
        finalIdDonVi = rawId ? String(rawId).trim() : 'HO';
      }

      // 🟢 3. CHUẨN HÓA THÔNG TIN NGƯỜI DÙNG (Bao gồm cả Cột Truy Cập & Phân quyền Thao tác)
      const mappedUser: AppUser = {
        id: String(userData.id || userData.ID || userData.ID_User || 'Unknown'),
        user_name: String(userData.user_name || userData.Username || userData.username || username),
        ho_ten: String(userData.ho_ten || userData.HoTen || userData.hoTen || 'Người dùng'),
        id_don_vi: finalIdDonVi,
        quyen: rawRole, // Lấy chuẩn chữ viewer_hanche
        quyen_truy_cap: String(userData.quyen_truy_cap || ''),
        quyen_chi_tiet: String(userData.quyen_chi_tiet || ''),
        password: String(userData.password || ''), // Lưu password để đối chiếu đổi mật khẩu ngầm
        can_view: rawRole.toUpperCase() === 'ADMIN' ? true : (userData.can_view !== undefined ? Boolean(userData.can_view) : true),
        can_create: rawRole.toUpperCase() === 'ADMIN' ? true : (userData.can_create !== undefined ? Boolean(userData.can_create) : true),
        can_update: rawRole.toUpperCase() === 'ADMIN' ? true : (userData.can_update !== undefined ? Boolean(userData.can_update) : true),
        can_delete: rawRole.toUpperCase() === 'ADMIN' ? true : Boolean(userData.can_delete),
        can_delete_unit: rawRole.toUpperCase() === 'ADMIN' ? true : Boolean(userData.can_delete_unit),
        can_lock_period: rawRole.toUpperCase() === 'ADMIN' ? true : Boolean(userData.can_lock_period)
      };

      // Lưu User vào state và LocalStorage/SessionStorage tùy chọn
      setUser(mappedUser);
      if (remember) {
        localStorage.setItem('authUser', JSON.stringify(mappedUser));
        localStorage.setItem('sessionExpiry', String(Date.now() + getSessionExpiryMs())); // Lưu mốc hết hạn theo sessionDays
        sessionStorage.removeItem('authUser');
      } else {
        sessionStorage.setItem('authUser', JSON.stringify(mappedUser));
        localStorage.removeItem('authUser');
        localStorage.removeItem('sessionExpiry');
      }

      apiService.setCurrentUser(mappedUser as unknown as User);
      apiService.writeLog('ĐĂNG NHẬP', 'Truy cập hệ thống');

      // Chỉ preload danh mục đơn vị cơ bản ngầm (nhẹ) nếu cần, tránh tải ồ ạt toàn bộ bảng nhân sự, an ninh, pháp nhân
      setTimeout(() => {
        apiService.getDonVi().catch(() => { });
      }, 300);

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
      localStorage.removeItem('sessionExpiry'); // Xóa thời hạn hết hạn
      sessionStorage.removeItem('authUser');
      apiService.setCurrentUser(null);
      window.location.reload();
    }, 500);
  };

  const checkPermission = (moduleId: string) => {
    if (!user) return false;
    const quyenUpper = String(user.quyen || '').toUpperCase();
    const quyenTruyCap = String(user.quyen_truy_cap || '').trim();

    // 1. ADMIN hoặc ALL thì luôn có toàn quyền
    if (quyenUpper === 'ADMIN' || quyenTruyCap.includes('ALL')) {
      return true;
    }

    // 2. Kiểm tra xem trong quyen_chi_tiet có cờ CRUD:moduleId:V... không
    const moduleCrud = parseModuleCrud(user.quyen_chi_tiet, moduleId);
    if (moduleCrud !== null) {
      return moduleCrud.v;
    }

    // 3. Nếu quyen_truy_cap rỗng (tài khoản mặc định chưa bị giới hạn riêng) -> cho phép truy cập module
    if (!quyenTruyCap && String(user.quyen).toLowerCase() !== 'viewer_hanche') {
      return true;
    }

    // 4. Tương thích ngược: Nếu tài khoản có trọn bộ 9 module cũ trước khi có BaoCao -> tự động mở BaoCao
    const legacyModules = ['TongQuan', 'CongTy', 'NhanSu', 'PCCC', 'ATVSLD', 'Xe', 'ThietBi', 'VanBan', 'QuyDinh'];
    const isLegacyFullAccess = legacyModules.every(m => quyenTruyCap.includes(m));
    if (moduleId === 'BaoCao' && isLegacyFullAccess) {
      return true;
    }

    return quyenTruyCap.includes(moduleId);
  };

  // 🟢 TIỆN ÍCH PHÂN TÁCH THAM SỐ VÀ KIỂM TRA ĐƠN VỊ
  const parsePermissionArgs = (arg1?: string, arg2?: string): { moduleId?: string; unitId?: string } => {
    if (!arg1 && !arg2) return {};
    if (arg1 && arg2) return { moduleId: arg1, unitId: arg2 };
    if (arg1) {
      if (ALL_MODULE_IDS_SET.has(arg1)) {
        return { moduleId: arg1 };
      }
      return { unitId: arg1 };
    }
    return { unitId: arg2 };
  };

  const isUnitAuthorized = (targetUnitId?: string): boolean => {
    if (!user) return false;
    if (String(user.quyen || '').toUpperCase() === 'ADMIN') return true;
    if (!targetUnitId || targetUnitId === 'ALL') return true;
    const userDonVi = String(user.id_don_vi || '').trim();
    if (userDonVi === 'ALL' || userDonVi === 'HO') return true;
    const assignedUnits = userDonVi.split(',').map(s => s.trim()).filter(Boolean);
    return assignedUnits.includes(targetUnitId);
  };

  // 🟢 CÁC HELPER KIỂM TRA QUYỀN THAO TÁC (CRUD THEO PHÂN HỆ VÀ ĐƠN VỊ)
  const canView = (arg1?: string, arg2?: string): boolean => {
    if (!user) return false;
    if (String(user.quyen || '').toUpperCase() === 'ADMIN') return true;
    const { moduleId, unitId } = parsePermissionArgs(arg1, arg2);
    if (unitId && !isUnitAuthorized(unitId)) return false;
    if (moduleId) {
      const crud = parseModuleCrud(user.quyen_chi_tiet, moduleId);
      if (crud !== null) return crud.v;
      return checkPermission(moduleId) && user.can_view !== false;
    }
    return user.can_view !== false;
  };

  const canCreate = (arg1?: string, arg2?: string): boolean => {
    if (!user) return false;
    if (String(user.quyen || '').toUpperCase() === 'ADMIN') return true;
    const { moduleId, unitId } = parsePermissionArgs(arg1, arg2);
    if (unitId && !isUnitAuthorized(unitId)) return false;
    if (moduleId) {
      const crud = parseModuleCrud(user.quyen_chi_tiet, moduleId);
      if (crud !== null) return crud.c;
      return checkPermission(moduleId) && user.can_create !== false;
    }
    return user.can_create !== false;
  };

  const canUpdate = (arg1?: string, arg2?: string): boolean => {
    if (!user) return false;
    if (String(user.quyen || '').toUpperCase() === 'ADMIN') return true;
    const { moduleId, unitId } = parsePermissionArgs(arg1, arg2);
    if (unitId && !isUnitAuthorized(unitId)) return false;
    if (moduleId) {
      const crud = parseModuleCrud(user.quyen_chi_tiet, moduleId);
      if (crud !== null) return crud.u;
      return checkPermission(moduleId) && user.can_update !== false;
    }
    return user.can_update !== false;
  };

  const canDelete = (arg1?: string, arg2?: string): boolean => {
    if (!user) return false;
    if (String(user.quyen || '').toUpperCase() === 'ADMIN') return true;
    const { moduleId, unitId } = parsePermissionArgs(arg1, arg2);
    if (unitId && !isUnitAuthorized(unitId)) return false;
    if (moduleId) {
      const crud = parseModuleCrud(user.quyen_chi_tiet, moduleId);
      if (crud !== null) return crud.d;
      return checkPermission(moduleId) && Boolean(user.can_delete);
    }
    return Boolean(user.can_delete);
  };

  const canDeleteUnit = (unitId?: string): boolean => {
    if (!user) return false;
    if (String(user.quyen || '').toUpperCase() === 'ADMIN') return true;
    if (unitId && !isUnitAuthorized(unitId)) return false;
    const rules = String(user.quyen_chi_tiet || '').split(',').map(r => r.trim());
    return Boolean(user.can_delete_unit) || rules.includes('CAN_DELETE_UNIT');
  };

  const canLockPeriod = (unitId?: string): boolean => {
    if (!user) return false;
    if (String(user.quyen || '').toUpperCase() === 'ADMIN') return true;
    if (unitId && !isUnitAuthorized(unitId)) return false;
    const rules = String(user.quyen_chi_tiet || '').split(',').map(r => r.trim());
    return Boolean(user.can_lock_period) || rules.includes('CAN_LOCK_PERIOD');
  };

  const hasRule = (ruleId: string): boolean => {
    if (!user) return false;
    if (String(user.quyen || '').toUpperCase() === 'ADMIN') {
      // Các rule che giấu (Negative restrictions) không áp dụng cho ADMIN
      if (ruleId === 'NS_HIDE_SENSITIVE' || ruleId === 'NS_NO_DETAIL' || ruleId === 'TB_HIDE_PRICE' || ruleId === 'VB_HIDE_BTN') {
        return false;
      }
      return true;
    }
    const rules = String(user.quyen_chi_tiet || '').split(',').map(r => r.trim());
    return rules.includes(ruleId);
  };

  const getModulePermissions = (moduleId: string) => {
    return {
      canView: canView(moduleId),
      canCreate: canCreate(moduleId),
      canUpdate: canUpdate(moduleId),
      canDelete: canDelete(moduleId),
    };
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      checkPermission,
      canView,
      canCreate,
      canUpdate,
      canDelete,
      canDeleteUnit,
      canLockPeriod,
      hasRule,
      getModulePermissions,
      sessionDays,
      setSessionDays
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};