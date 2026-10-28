import React, { useState, useEffect } from 'react';
import { motion, LayoutGroup } from 'motion/react';
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
  ClipboardList,
  Moon,
  Sun,
  BarChart3,
  Handshake,
  Receipt
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface SidebarItemProps {
  id: string;
  label: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
}

function SidebarItem({ id, label, icon: Icon, activeTab, setActiveTab, isCollapsed }: SidebarItemProps) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActiveTab(id)}
      title={label}
      className={`relative w-full flex items-center ${
        isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'
      } rounded-lg font-semibold transition-colors duration-150 cursor-pointer ${
        isActive ? 'text-white font-bold' : 'text-blue-100 hover:bg-white/5 hover:text-white'
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="sidebarActiveIndicator"
          className="absolute inset-0 bg-white/15 border border-white/10 rounded-lg shadow-xs z-0"
          transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
        />
      )}
      <Icon size={18} className="relative z-10 shrink-0" />
      {!isCollapsed && <span className="text-sm relative z-10 truncate">{label}</span>}
    </button>
  );
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { logout, user, checkPermission } = useAuth();

  // Trạng thái đóng/mở Sidebar (Mặc định đóng trên di động)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  // 🟢 TRẠNG THÁI GIAO DIỆN BAN ĐÊM (DARK MODE)
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode', 'dark');
      document.body.classList.add('dark-mode', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode', 'dark');
      document.body.classList.remove('dark-mode', 'dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <>
      {/* Nút bấm nổi mở Menu trên di động */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="fixed left-3 bottom-5 z-[60] md:hidden bg-[#05408A] hover:bg-[#04367a] text-white p-3.5 rounded-full shadow-2xl border border-blue-400/40 flex items-center justify-center transition-all animate-pulse"
          title="Menu"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

      {/* Lớp nền mờ khi mở Menu trên di động */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-45 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsCollapsed(true)}
        ></div>
      )}

      {/* Khung giữ chỗ trong Flex layout (0px trên di động, w-20/w-64 trên PC) */}
      <div className={`shrink-0 transition-all duration-300 h-full overflow-hidden md:overflow-visible ${isCollapsed ? 'w-0 md:w-20' : 'w-0 md:w-64'}`}>
        <aside className={`fixed md:relative left-0 top-0 h-full bg-[#05408A] flex flex-col shadow-xl text-white transition-all duration-300 z-50 ${isCollapsed ? '-translate-x-full md:translate-x-0 w-64 md:w-20' : 'translate-x-0 w-64 md:w-64'}`}>

          {/* HEADER LOGO */}
          <div className={`p-5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-blue-800/50 transition-all`}>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-300">
                <h1 className="text-xl font-black tracking-wide text-white">HỆ THỐNG</h1>
                <p className="text-[9px] font-bold text-blue-200 tracking-widest uppercase mt-0.5">Quản trị VĂN PHÒNG</p>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-blue-300 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
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
                    String(user?.quyen).toLowerCase() === 'viewer_hanche' ? 'CHUYÊN VIÊN' :
                      String(user?.quyen).toUpperCase() === 'USER' ? 'QUẢN TRỊ VIÊN ĐV' : 'Chỉ xem'}
                </span>
              </div>
            )}
          </div>

          {/* DANH SÁCH MENU */}
          <nav className={`flex-1 py-6 space-y-6 overflow-y-auto custom-scrollbar ${isCollapsed ? 'px-2' : 'px-3'}`}>
            <LayoutGroup id="sidebarNavLayout">

            {/* Nhóm 1: Bảng điều khiển (Chỉ hiện khi được phân quyền) */}
            {checkPermission('TongQuan') && (
              <div>
                {!isCollapsed && <p className="px-3 text-[10px] font-bold text-blue-300/80 uppercase tracking-widest mb-2 animate-in fade-in">Bảng điều khiển</p>}
                <div className="space-y-1">
                  <SidebarItem
                    id="dashboard"
                    label="Tổng quan"
                    icon={LayoutDashboard}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                </div>
              </div>
            )}

            {/* Nhóm 2: Quản lý hoạt động (ĐÃ BỌC ĐIỀU KIỆN PHÂN QUYỀN) */}
            <div>
              {!isCollapsed && <p className="px-3 text-[10px] font-bold text-blue-300/80 uppercase tracking-widest mb-2 animate-in fade-in">Quản lý hoạt động</p>}
              <div className="space-y-1">
                {checkPermission('CongTy') && (
                  <SidebarItem
                    id="departments"
                    label="Thông tin Công ty"
                    icon={Building2}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                {checkPermission('NhanSu') && (
                  <SidebarItem
                    id="personnel"
                    label="Thông tin Nhân sự"
                    icon={Users}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                {checkPermission('PCCC') && (
                  <SidebarItem
                    id="firesafety"
                    label="Phòng cháy chữa cháy"
                    icon={Flame}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                {checkPermission('ATVSLD') && (
                  <SidebarItem
                    id="atvsld"
                    label="An toàn vệ sinh LĐ"
                    icon={HardHat}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                {checkPermission('Xe') && (
                  <SidebarItem
                    id="vehicles"
                    label="Quản lý Xe"
                    icon={Car}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                {checkPermission('ThietBi') && (
                  <SidebarItem
                    id="equipments"
                    label="Quản lý TTB VP"
                    icon={MonitorSmartphone}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                {checkPermission('ChiPhi') && (
                  <SidebarItem
                    id="cphc"
                    label="Quản lý Chi phí"
                    icon={Receipt}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                {checkPermission('NhaCungCap') && (
                  <SidebarItem
                    id="suppliers"
                    label="Quản lý NCC"
                    icon={Handshake}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                {checkPermission('VanBan') && (
                  <SidebarItem
                    id="documents"
                    label="Quản lý VTLT"
                    icon={FileText}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                {checkPermission('QuyDinh') && (
                  <SidebarItem
                    id="policies"
                    label="Quy định - Quy trình"
                    icon={BookOpen}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}
              </div>
            </div>

            {/* Nhóm 3: Hệ thống */}
            <div>
              {!isCollapsed && <p className="px-3 text-[10px] font-bold text-blue-300/80 uppercase tracking-widest mb-2 animate-in fade-in">Hệ thống</p>}
              <div className="space-y-1">
                {checkPermission('BaoCao') && (
                  <SidebarItem
                    id="reports"
                    label="Báo cáo"
                    icon={BarChart3}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}

                <SidebarItem
                  id="accounts"
                  label="Tài khoản"
                  icon={UserCog}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  isCollapsed={isCollapsed}
                />

                {String(user?.quyen).toUpperCase() === 'ADMIN' && (
                  <SidebarItem
                    id="logs"
                    label="Nhật ký (Log)"
                    icon={ClipboardList}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isCollapsed={isCollapsed}
                  />
                )}
              </div>
            </div>
            </LayoutGroup>
          </nav>

          {/* FOOTER: CHẾ ĐỘ BAN ĐÊM & ĐĂNG XUẤT */}
          <div className={`p-3 border-t border-blue-800/50 flex flex-col gap-2 ${isCollapsed ? 'items-center' : ''}`}>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Chuyển sang Giao diện Sáng (Day Mode)' : 'Chuyển sang Giao diện Ban đêm (Dark Mode)'}
              className={`flex items-center justify-center gap-3 py-2 rounded-lg font-bold transition-all ${isDarkMode ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-blue-900/40 text-blue-200 hover:bg-blue-800/60'
                } ${isCollapsed ? 'w-10 h-10 px-0' : 'w-full px-3'}`}
            >
              {isDarkMode ? <Sun size={18} className="text-amber-400 animate-spin-slow" /> : <Moon size={18} className="text-blue-300" />}
              {!isCollapsed && <span className="text-xs">{isDarkMode ? 'Chế độ Sáng (Day)' : 'Giao diện Ban đêm'}</span>}
            </button>

            <button
              onClick={logout}
              title="Đăng xuất"
              className={`flex items-center justify-center gap-3 py-2 rounded-lg font-bold text-red-300 hover:bg-red-500/20 hover:text-red-100 transition-colors ${isCollapsed ? 'w-10 h-10 px-0' : 'w-full px-3'}`}
            >
              <LogOut size={18} />
              {!isCollapsed && <span className="text-xs">Đăng xuất</span>}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}