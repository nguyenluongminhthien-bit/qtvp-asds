import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Flame,
  HardHat, 
  Car, 
  MonitorSmartphone, 
  FileText, 
  BookOpen, 
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,         
  ClipboardList    
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { logout, user } = useAuth();
  
  // Trạng thái đóng/mở Sidebar
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 🟢 TRẠM KIỂM SOÁT QUYỀN (Tự động đọc Checkbox từ Database)
  const checkPermission = (moduleId: string) => {
    if (!user) return false;
    // Nếu là ADMIN hoặc được tick ô ALL -> Mở khóa toàn bộ
    if (String(user.quyen).toUpperCase() === 'ADMIN' || String(user.quyen_truy_cap).includes('ALL')) {
      return true;
    }
    // Nếu là User thường -> Kiểm tra xem có được tick cấp quyền module này không
    return String(user.quyen_truy_cap || '').includes(moduleId);
  };

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} h-full bg-[#05408A] flex flex-col shadow-xl shrink-0 text-white transition-all duration-300 z-50`}>
      
      {/* HEADER LOGO */}
      <div className={`p-5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-blue-800/50 transition-all`}>
        {!isCollapsed && (
          <div className="animate-in fade-in duration-300">
            <h1 className="text-xl font-black tracking-wide text-white">HỆ THỐNG</h1>
            <p className="text-[9px] font-bold text-blue-200 tracking-widest uppercase mt-0.5">Quản trị VP & An sinh đời sống</p>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="text-blue-300 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
          title={isCollapsed ? "Mở rộng Menu" : "Thu gọn Menu"}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* THÔNG TIN USER */}
      <div className={`px-5 py-5 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} border-b border-blue-800/50 transition-all`}>
        <div className="w-10 h-10 rounded-full bg-white text-[#05408A] flex items-center justify-center font-black text-lg shrink-0 shadow-sm" title={user?.ho_ten || 'Người dùng'}>
          {user?.ho_ten ? user.ho_ten.charAt(0).toUpperCase() : 'U'}
        </div>
        {!isCollapsed && (
          <div className="flex flex-col min-w-0 animate-in fade-in duration-300">
            <span className="text-sm font-bold truncate text-white" title={user?.ho_ten || 'Người dùng'}>
              {user?.ho_ten || 'Người dùng'}
            </span>
            <span className="text-[9px] font-black mt-1 bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full inline-block w-max border border-teal-500/30">
              {String(user?.quyen).toUpperCase() === 'ADMIN' ? 'QUẢN TRỊ VIÊN' : 
               String(user?.quyen).toLowerCase() === 'viewer_hanche' ? 'CHUYÊN VIÊN' : 'Chỉ xem'}
            </span>
          </div>
        )}
      </div>

      {/* DANH SÁCH MENU */}
      <nav className={`flex-1 py-6 space-y-6 overflow-y-auto custom-scrollbar ${isCollapsed ? 'px-2' : 'px-3'}`}>
        
        {/* Nhóm 1: Bảng điều khiển (Ai cũng xem được) */}
        <div>
          {!isCollapsed && <p className="px-3 text-[10px] font-bold text-blue-300/80 uppercase tracking-widest mb-2 animate-in fade-in">Bảng điều khiển</p>}
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              title="Tổng quan"
              className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                activeTab === 'dashboard' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
              }`}
            >
              <LayoutDashboard size={18} />
              {!isCollapsed && <span className="text-sm">Tổng quan</span>}
            </button>
          </div>
        </div>

        {/* Nhóm 2: Quản lý hoạt động (ĐÃ BỌC ĐIỀU KIỆN PHÂN QUYỀN) */}
        <div>
          {!isCollapsed && <p className="px-3 text-[10px] font-bold text-blue-300/80 uppercase tracking-widest mb-2 animate-in fade-in">Quản lý hoạt động</p>}
          <div className="space-y-1">
            
            {checkPermission('CongTy') && (
              <button
                onClick={() => setActiveTab('departments')}
                title="Thông tin Công ty"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'departments' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Building2 size={18} />
                {!isCollapsed && <span className="text-sm">Thông tin Công ty</span>}
              </button>
            )}

            {checkPermission('NhanSu') && (
              <button
                onClick={() => setActiveTab('personnel')}
                title="Thông tin Nhân sự"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'personnel' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Users size={18} />
                {!isCollapsed && <span className="text-sm">Thông tin Nhân sự</span>}
              </button>
            )}

            {checkPermission('PCCC') && (
              <button
                onClick={() => setActiveTab('firesafety')}
                title="Phòng cháy chữa cháy"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'firesafety' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Flame size={18} />
                {!isCollapsed && <span className="text-sm">Phòng cháy chữa cháy</span>}
              </button>
            )}

            {checkPermission('ATVSLD') && (
              <button
                onClick={() => setActiveTab('atvsld')}
                title="An toàn vệ sinh LĐ"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'atvsld' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <HardHat size={18} />
                {!isCollapsed && <span className="text-sm">An toàn vệ sinh LĐ</span>}
              </button>
            )}

            {checkPermission('Xe') && (
              <button
                onClick={() => setActiveTab('vehicles')}
                title="Thông tin Xe"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'vehicles' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Car size={18} />
                {!isCollapsed && <span className="text-sm">Thông tin Xe</span>}
              </button>
            )}

            {checkPermission('ThietBi') && (
              <button
                onClick={() => setActiveTab('equipments')}
                title="Thông tin TTB VP"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'equipments' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <MonitorSmartphone size={18} />
                {!isCollapsed && <span className="text-sm">Thông tin TTB VP</span>}
              </button>
            )}

            {checkPermission('VanBan') && (
              <button
                onClick={() => setActiveTab('documents')}
                title="Văn bản - Thông báo"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'documents' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <FileText size={18} />
                {!isCollapsed && <span className="text-sm">Văn bản - Thông báo</span>}
              </button>
            )}

            {checkPermission('QuyDinh') && (
              <button
                onClick={() => setActiveTab('policies')}
                title="Quy định - Quy trình"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'policies' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <BookOpen size={18} />
                {!isCollapsed && <span className="text-sm">Quy định - Quy trình</span>}
              </button>
            )}
          </div>
        </div>

        {/* Nhóm 3: Hệ thống (Chỉ ADMIN) */}
        {String(user?.quyen).toUpperCase() === 'ADMIN' && (
          <div>
            {!isCollapsed && <p className="px-3 text-[10px] font-bold text-blue-300/80 uppercase tracking-widest mb-2 animate-in fade-in">Hệ thống</p>}
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('accounts')}
                title="Tài khoản"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'accounts' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <UserCog size={18} />
                {!isCollapsed && <span className="text-sm">Tài khoản</span>}
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                title="Nhật ký (Log)"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'} rounded-lg font-semibold transition-all duration-200 ${
                  activeTab === 'logs' ? 'bg-white/10 text-white shadow-sm' : 'text-blue-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <ClipboardList size={18} />
                {!isCollapsed && <span className="text-sm">Nhật ký (Log)</span>}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* FOOTER ĐĂNG XUẤT */}
      <div className={`p-4 border-t border-blue-800/50 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button 
          onClick={logout}
          title="Đăng xuất"
          className={`flex items-center justify-center gap-3 py-2.5 rounded-lg font-bold text-red-300 hover:bg-red-500/20 hover:text-red-100 transition-colors ${isCollapsed ? 'w-10 h-10 px-0' : 'w-full px-3'}`}
        >
          <LogOut size={18} />
          {!isCollapsed && <span className="text-sm">Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
}
