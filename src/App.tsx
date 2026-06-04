import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/LoginPage'; 

// Import các Module chính của hệ thống
import DashboardPage from './pages/DashboardPage';
import PersonnelPage from './pages/PersonnelPage';
import DepartmentPage from './pages/DepartmentPage';
import VehiclePage from './pages/VehiclePage';
import DocumentPage from './pages/DocumentPage'; 
import PolicyPage from './pages/PolicyPage'; 
import EquipmentPage from './pages/EquipmentPage'; 
import FireSafetyPage from './pages/FireSafetyPage';
import AtvsldPage from './pages/AtvsldPage'; // 🟢 ĐÃ THÊM: Import trang ATVSLĐ mới

// Import các trang Hệ thống
import AccountPage from './pages/AccountPage';
import LogPage from './pages/LogPage';

function AppContent() {
  const { user } = useAuth();
  
  // Tùy chỉnh: Đặt 'dashboard' làm trang mặc định hiển thị đầu tiên
  const [activeTab, setActiveTab] = useState('dashboard');

  // LỚP 1: KIỂM TRA ĐĂNG NHẬP
  if (!user) {
    return <Login />;
  }

  // LỚP 2: HIỂN THỊ GIAO DIỆN CHÍNH (Đã đăng nhập)
  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans">
      
      {/* Thanh Menu bên trái */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Khu vực nội dung bên phải */}
      <main className="flex-1 h-full overflow-hidden bg-[#f4f7f9] relative">
        
        {/* TUYỆT CHIÊU GIỮ CACHE */}
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'dashboard' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <DashboardPage />
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'personnel' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <PersonnelPage />
        </div>

        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'firesafety' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <FireSafetyPage />
        </div>

        {/* 🟢 ĐÃ THÊM: KHỐI HIỂN THỊ TRANG ATVSLĐ */}
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'atvsld' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <AtvsldPage />
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'vehicles' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <VehiclePage />
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'equipments' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <EquipmentPage />
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'documents' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <DocumentPage />
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'policies' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <PolicyPage />
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'departments' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <DepartmentPage />
        </div>

        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'accounts' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <AccountPage />
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'logs' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <LogPage />
        </div>
        
      </main>
    </div>
  );
}

// Bọc toàn bộ ứng dụng bằng AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}