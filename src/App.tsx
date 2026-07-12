import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/LoginPage'; 

// Lazy load các Module chính của hệ thống để giảm dung lượng bundle ban đầu (Code Splitting)
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const PersonnelPage = React.lazy(() => import('./pages/PersonnelPage'));
const DepartmentPage = React.lazy(() => import('./pages/DepartmentPage'));
const VehiclePage = React.lazy(() => import('./pages/VehiclePage'));
const DocumentPage = React.lazy(() => import('./pages/DocumentPage')); 
const PolicyPage = React.lazy(() => import('./pages/PolicyPage')); 
const EquipmentPage = React.lazy(() => import('./pages/EquipmentPage')); 
const FireSafetyPage = React.lazy(() => import('./pages/FireSafetyPage'));
const AtvsldPage = React.lazy(() => import('./pages/AtvsldPage'));
const AccountPage = React.lazy(() => import('./pages/AccountPage'));
const LogPage = React.lazy(() => import('./pages/LogPage'));
const ReportPage = React.lazy(() => import('./pages/ReportPage'));

function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#f4f7f9] dark:bg-[#0b1329] gap-3">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Đang tải giao diện...</p>
    </div>
  );
}

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
      <React.Suspense fallback={<PageLoadingFallback />}>
        {children}
      </React.Suspense>
    </div>
  );
}

function AppContent() {
  const { user, checkPermission } = useAuth();
  
  // Tùy chỉnh: Đặt 'dashboard' làm trang mặc định hiển thị đầu tiên
  const [activeTab, setActiveTab] = useState('dashboard');

  // 🟢 TỰ ĐỘNG CHUYỂN TAB NẾU KHÔNG CÓ QUYỀN TRUY CẬP TAB HIỆN TẠI (Ví dụ: Dashboard)
  useEffect(() => {
    if (!user) return;

    const canAccess = (tab: string) => {
      if (tab === 'dashboard') return checkPermission('TongQuan');
      if (tab === 'personnel') return checkPermission('NhanSu');
      if (tab === 'firesafety') return checkPermission('PCCC');
      if (tab === 'atvsld') return checkPermission('ATVSLD');
      if (tab === 'vehicles') return checkPermission('Xe');
      if (tab === 'equipments') return checkPermission('ThietBi');
      if (tab === 'documents') return checkPermission('VanBan');
      if (tab === 'policies') return checkPermission('QuyDinh');
      if (tab === 'departments') return checkPermission('CongTy');
      if (tab === 'accounts') return true;
      if (tab === 'logs') return String(user?.quyen).toUpperCase() === 'ADMIN';
      if (tab === 'reports') return checkPermission('BaoCao');
      return false;
    };

    if (!canAccess(activeTab)) {
      const order = [
        { tab: 'dashboard', key: 'TongQuan' },
        { tab: 'departments', key: 'CongTy' },
        { tab: 'personnel', key: 'NhanSu' },
        { tab: 'firesafety', key: 'PCCC' },
        { tab: 'atvsld', key: 'ATVSLD' },
        { tab: 'vehicles', key: 'Xe' },
        { tab: 'equipments', key: 'ThietBi' },
        { tab: 'documents', key: 'VanBan' },
        { tab: 'policies', key: 'QuyDinh' },
        { tab: 'reports', key: 'BaoCao' }
      ];

      const allowedTab = order.find(item => checkPermission(item.key));
      if (allowedTab) {
        setActiveTab(allowedTab.tab);
      } else if (String(user?.quyen).toUpperCase() === 'ADMIN') {
        setActiveTab('accounts');
      } else {
        setActiveTab('');
      }
    }
  }, [user, activeTab]);

  // 🟢 XỬ LÝ DEEP LINK TỰ ĐỘNG CHUYỂN TAB & MỞ CHI TIẾT TÀI SẢN
  useEffect(() => {
    // 1. Kiểm tra tham số query ?tab=... hoặc ?qr=...
    const params = new URLSearchParams(window.location.search);
    const qrParam = params.get('qr');
    const tabParam = params.get('tab');
    
    if (qrParam || tabParam === 'equipment') {
      setActiveTab('equipments');
      return;
    }

    // 2. Kiểm tra pathname trực tiếp (Ví dụ: /T24ATTS32120025)
    const path = window.location.pathname.replace(/^\//, ''); // Bỏ dấu / ở đầu
    if (path && path.length >= 5 && !['dashboard', 'personnel', 'firesafety', 'atvsld', 'vehicles', 'equipments', 'documents', 'policies', 'departments', 'accounts', 'logs', 'reports'].includes(path.toLowerCase())) {
      // Coi đây là Mã tài sản quét trực tiếp từ QR!
      // Thiết lập lại URL thành dạng query để EquipmentPage xử lý đồng bộ
      const newUrl = `${window.location.origin}/?tab=equipment&qr=${path}`;
      window.history.replaceState({}, document.title, newUrl);
      setActiveTab('equipments');
    }
  }, []);

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
      <main className="flex-1 min-w-0 max-w-full h-full overflow-hidden bg-[#f4f7f9] relative">
        
        {/* TUYỆT CHIÊU GIỮ CACHE */}
        {checkPermission('TongQuan') && (
          <TabContainer active={activeTab === 'dashboard'}>
            <DashboardPage />
          </TabContainer>
        )}
        
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

        {checkPermission('BaoCao') && (
          <TabContainer active={activeTab === 'reports'}>
            <ReportPage />
          </TabContainer>
        )}

        <TabContainer active={activeTab === 'accounts'}>
          <AccountPage />
        </TabContainer>
        
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