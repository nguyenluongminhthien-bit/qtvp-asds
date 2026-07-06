import React, { useState, useEffect } from 'react';
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
import AccountPage from './pages/AccountPage';
import LogPage from './pages/LogPage';

interface TabContainerProps {
  active: boolean;
  children: React.ReactNode;
}

function TabContainer({ active, children }: TabContainerProps) {
  const [hasBeenVisited, setHasBeenVisited] = useState(false);

  useEffect(() => {
    if (active) {
      setHasBeenVisited(true);
    }
  }, [active]);

  if (!hasBeenVisited) return null;

  return (
    <div className={`absolute inset-0 transition-opacity duration-200 ${active ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
      {children}
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  
  // Tùy chỉnh: Đặt 'dashboard' làm trang mặc định hiển thị đầu tiên
  const [activeTab, setActiveTab] = useState('dashboard');

  // LỚP 1: KIỂM TRA ĐĂNG NHẬP
  if (!user) {
    return <Login />;
  }

  // LỚP 2: HIỂN THỊ GIAO DIỆN CHÍNH (Đã đăng nhập)
  const checkPermission = (moduleId: string) => {
    if (!user) return false;
    if (String(user.quyen).toUpperCase() === 'ADMIN' || String(user.quyen_truy_cap).includes('ALL')) {
      return true;
    }
    return String(user.quyen_truy_cap || '').includes(moduleId);
  };

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans">
      
      {/* Thanh Menu bên trái */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Khu vực nội dung bên phải */}
      <main className="flex-1 min-w-0 max-w-full h-full overflow-hidden bg-[#f4f7f9] relative">
        
        {/* TUYỆT CHIÊU GIỮ CACHE */}
        <TabContainer active={activeTab === 'dashboard'}>
          <DashboardPage />
        </TabContainer>
        
        {checkPermission('NhanSu') && (
          <TabContainer active={activeTab === 'personnel'}>
            <PersonnelPage />
          </TabContainer>
        )}

        {checkPermission('PCCC') && (
          <TabContainer active={activeTab === 'firesafety'}>
            <FireSafetyPage />
          </TabContainer>
        )}

        {checkPermission('ATVSLD') && (
          <TabContainer active={activeTab === 'atvsld'}>
            <AtvsldPage />
          </TabContainer>
        )}
        
        {checkPermission('Xe') && (
          <TabContainer active={activeTab === 'vehicles'}>
            <VehiclePage />
          </TabContainer>
        )}
        
        {checkPermission('ThietBi') && (
          <TabContainer active={activeTab === 'equipments'}>
            <EquipmentPage />
          </TabContainer>
        )}
        
        {checkPermission('VanBan') && (
          <TabContainer active={activeTab === 'documents'}>
            <DocumentPage />
          </TabContainer>
        )}
        
        {checkPermission('QuyDinh') && (
          <TabContainer active={activeTab === 'policies'}>
            <PolicyPage />
          </TabContainer>
        )}
        
        {checkPermission('CongTy') && (
          <TabContainer active={activeTab === 'departments'}>
            <DepartmentPage />
          </TabContainer>
        )}

        {String(user?.quyen).toUpperCase() === 'ADMIN' && (
          <TabContainer active={activeTab === 'accounts'}>
            <AccountPage />
          </TabContainer>
        )}
        
        {String(user?.quyen).toUpperCase() === 'ADMIN' && (
          <TabContainer active={activeTab === 'logs'}>
            <LogPage />
          </TabContainer>
        )}
        
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