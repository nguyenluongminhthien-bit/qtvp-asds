import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DonVi, Personnel, ThietBi, TS_Xe } from '../types';
import { getUnitEmoji } from '../utils/hierarchy';
import { formatCurrency, parseDateStrict } from '../utils/formatters';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import ExpiryAlert from '../components/ExpiryAlert';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';

import { 
  Building2, MapPin, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Search, Loader2, Filter, LayoutDashboard, Users, MonitorSmartphone,
  Flame, AlertTriangle, Activity, Briefcase, BellRing, FileText, ShieldAlert, ShieldCheck, Video, Tag, Car,
  Cake, Calendar, Star, Settings
} from 'lucide-react';

import { buildHierarchicalOptions, sortDonViByThuTu, groupParentUnits } from '../utils/hierarchy'; 
import DashboardCustomizerModal, { WidgetConfig } from '../components/dashboard/DashboardCustomizerModal'; 
import PersonnelDoughnutChart from '../components/dashboard/PersonnelDoughnutChart';
import ExpiryAlertPanel from '../components/dashboard/ExpiryAlertPanel';
import KpiSection from '../components/dashboard/KpiSection';

// 🟢 2. THUẬT TOÁN TỰ ĐỘNG CỘNG THÁNG VÀO NGÀY BẮT ĐẦU
const extractDateAndAddDuration = (durationRaw: any, startDateRaw: any): Date | null => {
  const baseDate = parseDateStrict(startDateRaw);
  if (!baseDate) return null;
  
  let monthsToAdd = 0;
  const s = String(durationRaw).toLowerCase().trim();
  
  if (/^\d+$/.test(s)) {
    monthsToAdd = parseInt(s, 10);
  } else {
    const monthMatch = s.match(/(\d+)\s*tháng/);
    const yearMatch = s.match(/(\d+)\s*năm/);
    if (monthMatch) monthsToAdd = parseInt(monthMatch[1], 10);
    else if (yearMatch) monthsToAdd = parseInt(yearMatch[1], 10) * 12;
  }
  
  if (monthsToAdd > 0) {
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
  }
  return baseDate;
};



// 🟢 BIỂU ĐỒ 2: THỐNG KÊ VĂN BẢN BAN HÀNH (INTERACTIVE HORIZONTAL BAR CHART)
function DocumentBarChart({ data, maxCount }: { data: { name: string; count: number }[]; maxCount: number }) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar w-full space-y-3 pr-1 py-1 h-full">
      {data.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-16">
          <FileText size={44} className="mb-3 opacity-30 text-gray-400"/>
          <p className="font-bold text-sm">Chưa có dữ liệu</p>
        </div>
      ) : (
        data.map((item, idx) => {
          const widthPct = Math.max((item.count / maxCount) * 100, 3);
          return (
            <div key={idx} className="flex flex-col gap-1 relative group cursor-pointer">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700 truncate pr-2 group-hover:text-[#05469B] transition-colors">{item.name}</span>
                <span className="font-black text-[#05469B] bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-100/50">{item.count} VB</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden relative shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-300 to-[#05469B] rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${widthPct}%` }}
                ></div>
              </div>
            </div>
          )
        })
      )}
    </div>
  );
}

// 🟢 BIỂU ĐỒ 3: TÌNH TRẠNG THIẾT BỊ/TÀI SẢN (SEGMENTED INTERACTIVE BAR CHART)
interface AssetGroupData {
  name: string;
  total: number;
  dangSuDung: number;
  luuKho: number;
  suaChua: number;
  thanhLy: number;
}

function AssetSegmentedChart({ data }: { data: AssetGroupData[] }) {
  const [hoveredSegment, setHoveredSegment] = useState<{ groupIdx: number; status: string; count: number } | null>(null);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-5 h-full">
      {data.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400">
          <MonitorSmartphone size={40} className="mb-2 opacity-55"/>
          <p className="font-medium text-sm">Chưa có dữ liệu tài sản.</p>
        </div>
      ) : (
        data.map((item, gIdx) => (
          <div key={gIdx} className="flex flex-col gap-1.5 relative">
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-gray-700 truncate pr-2" title={item.name}>{item.name}</span>
              <span className="font-black text-[#05469B] shrink-0 text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100/50">Tổng: {item.total}</span>
            </div>
            
            <div className="flex h-3 w-full bg-gray-100 rounded-full overflow-hidden relative shadow-inner">
              {item.dangSuDung > 0 && (
                <div 
                  className={`bg-emerald-500 cursor-help transition-all duration-300 ${hoveredSegment?.groupIdx === gIdx && hoveredSegment?.status === 'use' ? 'brightness-110 scale-y-110 shadow-md' : ''}`}
                  style={{ width: `${(item.dangSuDung/item.total)*100}%` }}
                  onMouseEnter={() => setHoveredSegment({ groupIdx: gIdx, status: 'use', count: item.dangSuDung })}
                  onMouseLeave={() => setHoveredSegment(null)}
                ></div>
              )}
              {item.luuKho > 0 && (
                <div 
                  className={`bg-blue-400 cursor-help transition-all duration-300 ${hoveredSegment?.groupIdx === gIdx && hoveredSegment?.status === 'store' ? 'brightness-110 scale-y-110 shadow-md' : ''}`}
                  style={{ width: `${(item.luuKho/item.total)*100}%` }}
                  onMouseEnter={() => setHoveredSegment({ groupIdx: gIdx, status: 'store', count: item.luuKho })}
                  onMouseLeave={() => setHoveredSegment(null)}
                ></div>
              )}
              {item.suaChua > 0 && (
                <div 
                  className={`bg-orange-400 cursor-help transition-all duration-300 ${hoveredSegment?.groupIdx === gIdx && hoveredSegment?.status === 'repair' ? 'brightness-110 scale-y-110 shadow-md' : ''}`}
                  style={{ width: `${(item.suaChua/item.total)*100}%` }}
                  onMouseEnter={() => setHoveredSegment({ groupIdx: gIdx, status: 'repair', count: item.suaChua })}
                  onMouseLeave={() => setHoveredSegment(null)}
                ></div>
              )}
              {item.thanhLy > 0 && (
                <div 
                  className={`bg-red-500 cursor-help transition-all duration-300 ${hoveredSegment?.groupIdx === gIdx && hoveredSegment?.status === 'liquid' ? 'brightness-110 scale-y-110 shadow-md' : ''}`}
                  style={{ width: `${(item.thanhLy/item.total)*100}%` }}
                  onMouseEnter={() => setHoveredSegment({ groupIdx: gIdx, status: 'liquid', count: item.thanhLy })}
                  onMouseLeave={() => setHoveredSegment(null)}
                ></div>
              )}
            </div>
            
            {hoveredSegment?.groupIdx === gIdx && (
              <div className="absolute right-0 top-6 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none z-20 animate-in fade-in slide-in-from-top-1 duration-100 border border-slate-700">
                {hoveredSegment.status === 'use' && `🟢 Đang sử dụng: ${hoveredSegment.count}`}
                {hoveredSegment.status === 'store' && `🔵 Lưu kho: ${hoveredSegment.count}`}
                {hoveredSegment.status === 'repair' && `🟠 Sửa chữa: ${hoveredSegment.count}`}
                {hoveredSegment.status === 'liquid' && `🔴 Hỏng/Thanh lý: ${hoveredSegment.count}`}
                {` (${((hoveredSegment.count / item.total) * 100).toFixed(0)}%)`}
              </div>
            )}

            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-bold">
              {item.dangSuDung > 0 && <span className="text-emerald-600">Dùng: {item.dangSuDung}</span>}
              {item.luuKho > 0 && <span className="text-blue-500">Kho: {item.luuKho}</span>}
              {item.suaChua > 0 && <span className="text-orange-500">Sửa: {item.suaChua}</span>}
              {item.thanhLy > 0 && <span className="text-red-500">Hỏng: {item.thanhLy}</span>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// 🟢 BIỂU ĐỒ 4: TÌNH TRẠNG & CƠ CẤU ĐỘI XE (VEHICLE FLEET STATS)
function VehicleFleetChart({ vehicles }: { vehicles: TS_Xe[] }) {
  const brandStats = useMemo(() => {
    const map: Record<string, { count: number; active: number }> = {};
    vehicles.forEach(v => {
      const brand = String(v.loai_xe || 'Khác').split('-')[0].trim() || 'Khác';
      if (!map[brand]) map[brand] = { count: 0, active: 0 };
      map[brand].count++;
      if (String(v.tinh_trang).toLowerCase().includes('hoạt') || String(v.tinh_trang).toLowerCase().includes('tốt')) {
        map[brand].active++;
      }
    });
    return Object.entries(map)
      .map(([brand, data]) => ({ brand, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [vehicles]);

  const totalVehicles = vehicles.length;
  const totalActive = vehicles.filter(v => String(v.tinh_trang).toLowerCase().includes('hoạt') || String(v.tinh_trang).toLowerCase().includes('tốt')).length;

  if (totalVehicles === 0) {
    return <p className="font-medium text-sm text-gray-400 py-6 text-center">Chưa có dữ liệu đội xe.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-slate-800/60 rounded-xl border border-blue-100 dark:border-slate-700">
        <div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">Tổng số phương tiện</p>
          <p className="text-xl font-black text-[#05469B] dark:text-blue-400">{totalVehicles} <span className="text-xs font-normal text-gray-600 dark:text-slate-300">xe</span></p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">Đang hoạt động tốt</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{totalActive} <span className="text-xs font-normal text-gray-600 dark:text-slate-300">({((totalActive/totalVehicles)*100).toFixed(0)}%)</span></p>
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Phân bố theo Hãng xe</p>
        {brandStats.map(item => {
          const pct = Math.round((item.count / totalVehicles) * 100);
          return (
            <div key={item.brand} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-700 dark:text-slate-200">{item.brand}</span>
                <span className="text-gray-600 dark:text-slate-300 font-bold">{item.count} xe <span className="text-[10px] text-gray-400">({pct}%)</span></span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden flex">
                <div 
                  className="bg-gradient-to-r from-[#05469B] to-blue-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${pct}%` }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'notif_hub', title: 'Trung tâm Thông báo & Cảnh báo Sắp hết hạn', category: 'CHUNG', icon: '🔔', visible: true, pinned: true, order: 1 },
  { id: 'overview_cards', title: 'Thẻ chỉ số KPI Tổng quan (Đơn vị, Nhân sự, PCCC, Ô tô)', category: 'CHUNG', icon: '📊', visible: true, pinned: true, order: 2 },
  { id: 'chart_personnel', title: 'Biểu đồ Cơ cấu Nhân sự (Phòng ban, Chức vụ)', category: 'BIỂU ĐỒ CHUYÊN SÂU', icon: '👥', visible: true, pinned: false, order: 3 },
  { id: 'chart_docs', title: 'Biểu đồ Thống kê Văn bản ban hành', category: 'BIỂU ĐỒ CHUYÊN SÂU', icon: '📑', visible: true, pinned: false, order: 4 },
  { id: 'chart_assets', title: 'Biểu đồ Tình trạng Tài sản / Thiết bị Văn phòng', category: 'BIỂU ĐỒ CHUYÊN SÂU', icon: '💻', visible: true, pinned: false, order: 5 },
  { id: 'chart_vehicles', title: 'Biểu đồ Chi phí & Cơ cấu Đội xe (Thương hiệu, Tình trạng)', category: 'BIỂU ĐỒ CHUYÊN SÂU', icon: '🚙', visible: true, pinned: false, order: 6 },
  { id: 'regional_stats', title: 'Quy mô bộ máy quản trị theo khu vực (VPĐH, Nam, Bắc)', category: 'CHUNG', icon: '🏢', visible: true, pinned: false, order: 7 },
  { id: 'table_pccc', title: 'Bảng theo dõi & Cảnh báo hạn kiểm định PCCC', category: 'BẢNG CẢNH BÁO', icon: '🔥', visible: true, pinned: false, order: 8 },
  { id: 'table_camera', title: 'Bảng theo dõi Hệ thống An ninh Camera', category: 'BẢNG CẢNH BÁO', icon: '📹', visible: true, pinned: false, order: 9 },
  { id: 'table_security', title: 'Bảng theo dõi Hợp đồng Bảo vệ Dịch vụ & Chi phí', category: 'BẢNG CẢNH BÁO', icon: '🛡️', visible: true, pinned: false, order: 10 },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  
  // Dữ liệu thô từ APIs
  const [nsData, setNsData] = useState<Personnel[]>([]);
  const [tbData, setTbData] = useState<ThietBi[]>([]);
  const [tsPcccData, setTsPcccData] = useState<any[]>([]); 
  const [vbData, setVbData] = useState<any[]>([]); 
  const [anNinhData, setAnNinhData] = useState<any[]>([]); 
  const [xeData, setXeData] = useState<TS_Xe[]>([]);
  const [atvsldData, setAtvsldData] = useState<any[]>([]);
  const [pcccData, setPcccData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  // --- SLICER STATES ---
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);
  
  const currentYear = new Date().getFullYear();
  const [docYear, setDocYear] = useState<number>(currentYear);

  // 🟢 STATE BỘ LỌC CẢNH BÁO
  const [activeNotifTab, setActiveNotifTab] = useState<'all' | 'vehicle' | 'equipment' | 'personnel_cert' | 'personnel_event'>('all');
  const [isNotifHubOpen, setIsNotifHubOpen] = useState(false);

  // 🟢 STATE TÙY CHỈNH & GHIM WIDGET DASHBOARD
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem('dashboard_widget_prefs_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        const ids = new Set(parsed.map((w: any) => w.id));
        const merged = [...parsed, ...DEFAULT_WIDGETS.filter(w => !ids.has(w.id))];
        return merged;
      }
    } catch (e) {}
    return DEFAULT_WIDGETS;
  });

  const handleUpdateWidgets = (updated: WidgetConfig[]) => {
    setWidgetConfigs(updated);
    localStorage.setItem('dashboard_widget_prefs_v3', JSON.stringify(updated));
  };

  const handleResetWidgets = () => {
    setWidgetConfigs(DEFAULT_WIDGETS);
    localStorage.removeItem('dashboard_widget_prefs_v3');
  };

  const togglePinWidget = (id: string) => {
    handleUpdateWidgets(
      widgetConfigs.map(w => w.id === id ? { ...w, pinned: !w.pinned } : w)
    );
  };

  const toggleHideWidget = (id: string) => {
    handleUpdateWidgets(
      widgetConfigs.map(w => w.id === id ? { ...w, visible: false } : w)
    );
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const safeCall = async (apiFunc: any) => {
        if (typeof apiFunc !== 'function') return [];
        try {
          const res = await apiFunc();
          return Array.isArray(res) ? res : [];
        } catch (e) {
          console.warn("API Call Failed, fallback to empty array.");
          return [];
        }
      };

      try {
        const [dvRes, nsRes, tbRes, tsPcccRes, vbRes, anNinhRes, xeRes, atvsldRes, pcccRes] = await Promise.all([
          safeCall(apiService.getDonVi),
          safeCall(apiService.getPersonnel),
          safeCall(apiService.getThietBi),
          safeCall((apiService as any).getTsPCCC),
          safeCall((apiService as any).getVanBan),
          safeCall((apiService as any).getAnNinh),
          safeCall((apiService as any).getXe),
          safeCall((apiService as any).getATVSLD),
          safeCall((apiService as any).getPCCC)
        ]);

        setDonViList(dvRes);
        setNsData(nsRes);
        setTbData(tbRes);
        setTsPcccData(tsPcccRes);
        setVbData(vbRes);
        setAnNinhData(anNinhRes);
        setXeData(xeRes);
        setAtvsldData(atvsldRes);
        setPcccData(pcccRes);
      } catch (error) {
        console.error("Lỗi tải dữ liệu Dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[dv.id] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  const getAllSubIds = (unitId: string, allUnits: DonVi[]): string[] => {
    const subs = allUnits.filter(u => u.cap_quan_ly === unitId);
    let ids = subs.map(u => u.id);
    subs.forEach(s => { ids = [...ids, ...getAllSubIds(s.id, allUnits)]; });
    return ids;
  };

  const isCountableUnit = (dv: DonVi) => {
    const status = String(dv.trang_thai || '').toLowerCase();
    return !status.includes('đại lý') && !status.includes('dự án') && !status.includes('đầu tư mới');
  };

  const allowedDonViIds = useAllowedUnits(donViList);

  const filteredUnits = useMemo(() => {
    let baseUnits = donViList.filter(dv => allowedDonViIds.includes(dv.id));
    if (!unitSearchTerm) return baseUnits;

    const lower = unitSearchTerm.toLowerCase();
    const matchedIds = new Set<string>();

    baseUnits.forEach(u => {
      if (String(u.ten_don_vi || '').toLowerCase().includes(lower) || String(u.id || '').toLowerCase().includes(lower)) {
        matchedIds.add(u.id);
        let parentId = u.cap_quan_ly;
        let safeCounter = 0;
        while (parentId && parentId !== 'HO' && safeCounter < 10) {
          matchedIds.add(parentId);
          const parentUnit = baseUnits.find(p => p.id === parentId);
          parentId = parentUnit ? parentUnit.cap_quan_ly : null;
          safeCounter++;
        }
      }
    });

    const addChildren = (parentId: string) => {
      baseUnits.forEach(u => {
        if (u.cap_quan_ly === parentId && !matchedIds.has(u.id)) {
          matchedIds.add(u.id);
          addChildren(u.id);
        }
      });
    };
    
    Array.from(matchedIds).forEach(id => addChildren(id));
    return baseUnits.filter(item => matchedIds.has(item.id));
  }, [donViList, unitSearchTerm, allowedDonViIds]);
  
  const parentUnits = useMemo(() => filteredUnits.filter(item => item.cap_quan_ly === 'HO' || !item.cap_quan_ly), [filteredUnits]);
  const getChildUnits = (parentId: string) => sortDonViByThuTu(filteredUnits.filter(item => item.cap_quan_ly === parentId));

  const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = useMemo(() => {
    return groupParentUnits(parentUnits);
  }, [parentUnits]);

  const toggleParent = (parentId: string) => setExpandedParents(prev => prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]);

  const renderUnitTree = (parent: DonVi, level: number = 1) => {
    const children = getChildUnits(parent.id);
    const isExpanded = expandedParents.includes(parent.id) || !!unitSearchTerm;
    const isParentDimmed = !isCountableUnit(parent);

    return (
      <div key={parent.id} className={level === 1 ? "mb-1" : "mt-1"}>
        <button 
          onClick={() => { setSelectedUnitFilter(parent.id); if (children.length > 0) toggleParent(parent.id); }} 
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedUnitFilter === parent.id ? 'bg-[#05469B] text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'} ${isParentDimmed ? 'opacity-50' : ''}`}
        >
          {children.length > 0 ? (isExpanded ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />) : <div className="w-4 shrink-0" />}
          <span className="shrink-0">{getUnitEmoji(parent.loai_hinh)}</span>
          <span className="truncate text-left">{parent.ten_don_vi}</span>
        </button>
        {isExpanded && children.length > 0 && (
          <div className={`ml-${level === 1 ? '6' : '4'} mt-1 border-l-2 border-gray-100 pl-2 space-y-1`}>
            {children.map(child => renderUnitTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const selectedUnitName = useMemo(() => {
    if (!selectedUnitFilter) return 'Toàn bộ Hệ thống';
    const unit = donViList.find(d => d.id === selectedUnitFilter);
    return unit ? unit.ten_don_vi : 'Toàn bộ Hệ thống';
  }, [selectedUnitFilter, donViList]);

  const currentSubordinateIds = useMemo(() => {
    if (!selectedUnitFilter) return donViList.map(u => u.id);
    return [selectedUnitFilter, ...getAllSubIds(selectedUnitFilter, donViList)];
  }, [selectedUnitFilter, donViList]);

  // 🟢 TÍNH TOÁN DỮ LIỆU NHÂN SỰ CHO WIDGET GỘP TRÊN CÙNG
  const { widgetStats, staffRolesStats } = useMemo(() => {
    const totalUnits = donViList.filter(dv => currentSubordinateIds.includes(dv.id) && dv.id !== selectedUnitFilter && isCountableUnit(dv)).length || 0;
    
    let totalStaff = 0;
    let dvht = 0;
    let bv = 0;
    let pvhc = 0;

    nsData.forEach(ns => {
      if (currentSubordinateIds.includes(ns.id_don_vi) && ns.trang_thai !== 'Đã nghỉ việc') {
        totalStaff++;
        const role = String(ns.phan_loai || '').toUpperCase();
        if (role.includes('PT QTVP & ASĐS') || role.includes('PT QTVP') || role.includes('QTVP & ASĐS') || role.includes('PT QTVT') || role.includes('PT DVHT KD')) dvht++;
        if (role.includes('BV, ĐTKH') || role.includes('BẢO VỆ')) bv++;
        if (role.includes('PVHC')) pvhc++;
      }
    });

    return { 
      widgetStats: { totalUnits, totalStaff }, 
      staffRolesStats: { dvht, bv, pvhc } 
    };
  }, [currentSubordinateIds, donViList, nsData, selectedUnitFilter]);

  const companyScaleStats = useMemo(() => {
    const activeNam = ctttNamUnits.filter(u => currentSubordinateIds.includes(u.id));
    const activeBac = ctttBacUnits.filter(u => currentSubordinateIds.includes(u.id));

    const processScale = (units: DonVi[]) => {
      return units.map(u => {
        const subIds = getAllSubIds(u.id, donViList);
        const activeSubCount = subIds.filter(id => {
          if (!currentSubordinateIds.includes(id)) return false;
          const dv = donViList.find(d => d.id === id);
          return dv ? isCountableUnit(dv) : false;
        }).length;
        return { id: u.id, name: u.ten_don_vi, count: activeSubCount };
      }).sort((a, b) => b.count - a.count); 
    };
    return { nam: processScale(activeNam), bac: processScale(activeBac) };
  }, [ctttNamUnits, ctttBacUnits, currentSubordinateIds, donViList]);

  const maxScaleNam = Math.max(...companyScaleStats.nam.map(i => i.count), 1);
  const maxScaleBac = Math.max(...companyScaleStats.bac.map(i => i.count), 1);

  // 🟢 [BẢNG 1: PCCC GOM NHÓM - CHỈ LẤY THIẾT BỊ SẮP HẾT HẠN]
  const pcccWarningsGrouped = useMemo(() => {
    const groups: Record<string, any> = {};
    const today = new Date();
    today.setHours(0,0,0,0);

    tsPcccData.forEach(eq => {
      if (currentSubordinateIds.includes(eq.id_don_vi)) {
        const expDate = parseDateStrict(eq.ngay_het_han || eq.han_kiem_dinh);
        if (expDate) {
          const diffTime = expDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 30) {
            const unitName = donViMap[eq.id_don_vi] || eq.id_don_vi;
            const dateStr = expDate.toLocaleDateString('vi-VN');
            const key = `${unitName}_${dateStr}`;
            
            if(!groups[key]) {
              groups[key] = {
                unitName,
                dateStr,
                daysLeft: diffDays,
                items: {} 
              };
            }
            
            const itemName = eq.loai_thiet_bi || 'Thiết bị';
            groups[key].items[itemName] = (groups[key].items[itemName] || 0) + 1;
          }
        }
      }
    });
    return Object.values(groups).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [tsPcccData, currentSubordinateIds, donViMap]);

  // 🟢 [BẢNG 2: THỐNG KÊ CAMERA TỪ SHEET AN NINH - CẬP NHẬT CÁC CỘT]
  const cameraStatsList = useMemo(() => {
    const list: any[] = [];
    anNinhData.forEach(an => {
      if (currentSubordinateIds.includes(an.id_don_vi)) {
        // Lấy Tổng SL
        const tongCam = parseInt(String(an.sl_camera || 0).replace(/\D/g,''), 10) || 0;
        // Lấy SL Hư Hỏng
        const camHu = parseInt(String(an.camera_hu || 0).replace(/\D/g,''), 10) || 0; 
        // Lấy SL Đang Hoạt Động
        const camHD = parseInt(String(an.camera_hoat_dong || 0).replace(/\D/g,''), 10) || (tongCam > 0 ? tongCam - camHu : 0);
        
        const lyDoHu = an.ly_do_camera_hu || 'Chưa cập nhật lý do';
        
        if (tongCam > 0 || camHu > 0 || camHD > 0) {
          list.push({
            unitName: donViMap[an.id_don_vi] || an.id_don_vi,
            tongCam,
            camHD,
            camHu,
            lyDoHu
          });
        }
      }
    });
    // Sắp xếp: Đơn vị hư nhiều xếp trước
    return list.sort((a, b) => b.camHu - a.camHu);
  }, [anNinhData, currentSubordinateIds, donViMap]);

  // 🟢 [BẢNG 3: HỢP ĐỒNG BẢO VỆ DỊCH VỤ - BỔ SUNG CHI PHÍ]
  const anNinhStatsList = useMemo(() => {
    const list: any[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    anNinhData.forEach(an => {
      if (currentSubordinateIds.includes(an.id_don_vi) && an.ncc_dich_vu && String(an.ncc_dich_vu).trim() !== '') {
        let expDate = null;
        const directExpRaw = an.ngay_het_han || an.ngay_het_han_hd || an.ngay_ket_thuc || an.ngay_kt;
        
        if (directExpRaw) {
           expDate = parseDateStrict(directExpRaw);
        }

        if (!expDate) {
           const durationRaw = an.han_hop_dong || an.han_hd || an.thoi_han_hd || an.thoi_gian_hd || an.thoi_han || an.thoi_gian_luu || ''; 
           const startRaw = an.ngay_ky_hd || an.ngay_cd || an.ngay_ky || an.ngay_bat_dau || '';
           expDate = extractDateAndAddDuration(durationRaw, startRaw);
        }

        let diffDays = null;
        let dateStr = 'Chưa rõ hạn';
        const giaHanThem = Number(an.gia_han_them) || 0; // 🟢 LẤY BIẾN GIA HẠN THÊM

        if (expDate) {
          // 🟢 CỘNG DỒN SỐ THÁNG GIA HẠN VÀO TỔNG THỜI GIAN
          if (giaHanThem > 0) {
            expDate.setMonth(expDate.getMonth() + giaHanThem);
          }

          const diffTime = expDate.getTime() - today.getTime();
          diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          dateStr = expDate.toLocaleDateString('vi-VN');
        }

        const costRaw = an.chi_phi_thue || an.chi_phi || an.gia_tri_hd || an.tong_chi_phi || '';

        list.push({
          unitName: donViMap[an.id_don_vi] || an.id_don_vi,
          provider: an.ncc_dich_vu,
          daysLeft: diffDays,
          dateStr: dateStr,
          cost: formatCurrency(costRaw),
          giaHanThem: giaHanThem // 🟢 TRUYỀN XUỐNG GIAO DIỆN HIỂN THỊ
        });
      }
    });
    return list.sort((a, b) => {
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    });
  }, [anNinhData, currentSubordinateIds, donViMap]);

  const staffChartData = useMemo(() => {
    const roleCounts: Record<string, number> = {};
    nsData.forEach(ns => {
      if (currentSubordinateIds.includes(ns.id_don_vi) && ns.trang_thai !== 'Đã nghỉ việc') {
        const roleName = ns.phan_loai || 'Chưa phân loại';
        roleCounts[roleName] = (roleCounts[roleName] || 0) + 1;
      }
    });

    const sortedData = Object.keys(roleCounts)
      .map(key => ({ name: key, count: roleCounts[key] }))
      .sort((a, b) => b.count - a.count);

    const maxCount = sortedData.length > 0 ? sortedData[0].count : 1;
    return { data: sortedData, maxCount };
  }, [nsData, currentSubordinateIds]);

  const docChartData = useMemo(() => {
    const deptDocCounts: Record<string, number> = {};
    
    vbData.forEach(vb => {
      if (currentSubordinateIds.includes(vb.id_don_vi) && String(vb.phan_loai || '').toLowerCase().includes('thông báo')) {
        const d = parseDateStrict(vb.ngay_ban_hanh);
        if (d && d.getFullYear() === docYear) {
          const deptName = vb.bo_phan_lay_so || 'Khác';
          deptDocCounts[deptName] = (deptDocCounts[deptName] || 0) + 1;
        }
      }
    });

    const sortedData = Object.keys(deptDocCounts)
      .map(key => ({ name: key, count: deptDocCounts[key] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); 

    const maxCount = sortedData.length > 0 ? sortedData[0].count : 1;
    return { data: sortedData, maxCount };
  }, [vbData, currentSubordinateIds, docYear]);

  const assetChartData = useMemo(() => {
    const groupStats: Record<string, { total: number, dangSuDung: number, luuKho: number, suaChua: number, thanhLy: number }> = {};
    
    tbData.filter(tb => currentSubordinateIds.includes(tb.id_don_vi)).forEach(tb => {
      const groupName = tb.nhom_thiet_bi || 'Chưa phân nhóm';
      const tt = String(tb.tinh_trang || '').toLowerCase();
      
      if (!groupStats[groupName]) { groupStats[groupName] = { total: 0, dangSuDung: 0, luuKho: 0, suaChua: 0, thanhLy: 0 }; }
      groupStats[groupName].total++;
      
      if (tt.includes('đang sử dụng')) { groupStats[groupName].dangSuDung++; } 
      else if (tt.includes('sửa chữa')) { groupStats[groupName].suaChua++; } 
      else if (tt.includes('thanh lý') || tt.includes('hỏng')) { groupStats[groupName].thanhLy++; } 
      else { groupStats[groupName].luuKho++; }
    });

    return Object.keys(groupStats).map(key => ({ name: key, ...groupStats[key] })).sort((a, b) => b.total - a.total); 
  }, [tbData, currentSubordinateIds]);

  // 🟢 TRUNG TÂM THÔNG BÁO (NOTIFICATION HUB)
  const notifications = useMemo(() => {
    const list: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const WARNING_DAYS = 30;

    const parseDate = (dStr: any) => {
      if (!dStr) return null;
      const d = new Date(dStr);
      return isNaN(d.getTime()) ? null : d;
    };

    // 1. Quét Xe cộ
    xeData.forEach((xe: any) => {
      if (!currentSubordinateIds.includes(xe.id_don_vi)) return;
      if (xe.hien_trang !== 'Đang hoạt động') return;

      const checkXeDate = (dateStr: any, typeLabel: string) => {
        const d = parseDate(dateStr);
        if (!d) return;
        d.setHours(0, 0, 0, 0);
        const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        if (diff <= WARNING_DAYS) {
          list.push({
            id: `xe-${xe.id}-${typeLabel}`,
            category: 'vehicle',
            title: typeLabel,
            detail: `${xe.hieu_xe} ${xe.loai_xe} (${xe.bien_so})`,
            dateStr: d.toLocaleDateString('vi-VN'),
            daysLeft: diff,
            type: diff < 0 ? 'expired' : 'warning',
            unitName: donViMap[xe.id_don_vi] || xe.id_don_vi
          });
        }
      };

      checkXeDate(xe.han_dang_kiem, 'Hạn Đăng kiểm');
      checkXeDate(xe.han_bh_vc, 'Hạn Bảo hiểm Vật chất');
      checkXeDate(xe.han_bh_tnds, 'Hạn Bảo hiểm TNDS');
    });

    // 2. Quét Thiết bị
    tbData.forEach((tb: any) => {
      if (!currentSubordinateIds.includes(tb.id_don_vi)) return;
      if (tb.tinh_trang !== 'Đang sử dụng') return;

      // Hạn bảo hành (Chỉ cảnh báo khi sắp hết hạn trong 30 ngày, bỏ qua thiết bị đã hết bảo hành)
      const d = parseDate(tb.han_bao_hanh);
      if (d) {
        d.setHours(0,0,0,0);
        const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        if (diff >= 0 && diff <= WARNING_DAYS) {
          list.push({
            id: `tb-bh-${tb.id}`,
            category: 'equipment',
            title: 'Hết hạn bảo hành',
            detail: `${tb.ten_thiet_bi} (${tb.ma_tai_san || 'Không mã'})`,
            dateStr: d.toLocaleDateString('vi-VN'),
            daysLeft: diff,
            type: 'warning',
            unitName: donViMap[tb.id_don_vi] || tb.id_don_vi
          });
        }
      }

      // Kỳ bảo dưỡng định kỳ 6 tháng dựa trên ngày mua
      const pDate = parseDate(tb.ngay_mua);
      if (pDate) {
        const diffMonths = (today.getFullYear() - pDate.getFullYear()) * 12 + today.getMonth() - pDate.getMonth();
        const nextCheckMonths = Math.max(Math.ceil((diffMonths || 1) / 6) * 6, 6);
        const nextCheckDate = new Date(pDate);
        nextCheckDate.setMonth(pDate.getMonth() + nextCheckMonths);
        nextCheckDate.setHours(0,0,0,0);

        const diff = Math.ceil((nextCheckDate.getTime() - today.getTime()) / 86400000);
        if (diff >= 0 && diff <= WARNING_DAYS) {
          list.push({
            id: `tb-bd-${tb.id}-${nextCheckMonths}`,
            category: 'equipment',
            title: `Bảo dưỡng định kỳ (${nextCheckMonths} tháng)`,
            detail: `${tb.ten_thiet_bi} (${tb.ma_tai_san || 'Không mã'})`,
            dateStr: nextCheckDate.toLocaleDateString('vi-VN'),
            daysLeft: diff,
            type: 'warning',
            unitName: donViMap[tb.id_don_vi] || tb.id_don_vi
          });
        }
      }
    });

    // 3. Quét Chứng chỉ & HĐ (ATVSLĐ, PCCC & Security)
    // Chứng chỉ ATVSLĐ của Nhân sự
    nsData.forEach((ns: any) => {
      if (!currentSubordinateIds.includes(ns.id_don_vi)) return;
      if (ns.trang_thai === 'Đã nghỉ việc') return;
      if (!ns.cc_atvsld) return;

      let expDate = parseDate(ns.gia_tri_den);
      if (!expDate && ns.huan_luyen_den) {
        const hlDen = parseDate(ns.huan_luyen_den);
        if (hlDen) {
          hlDen.setFullYear(hlDen.getFullYear() + (String(ns.nhom_doi_tuong || '').includes('4') ? 1 : 2));
          expDate = hlDen;
        }
      }

      if (expDate) {
        expDate.setHours(0,0,0,0);
        const diff = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
        if (diff <= WARNING_DAYS) {
          list.push({
            id: `ns-cert-${ns.id}`,
            category: 'personnel_cert',
            title: 'Hết hạn chứng nhận ATVSLĐ nhân sự',
            detail: `${ns.ho_ten} (${ns.ma_so_nhan_vien}) - Nhóm ${ns.nhom_doi_tuong || 'Khác'}`,
            dateStr: expDate.toLocaleDateString('vi-VN'),
            daysLeft: diff,
            type: diff < 0 ? 'expired' : 'warning',
            unitName: donViMap[ns.id_don_vi] || ns.id_don_vi
          });
        }
      }
    });

    // An toàn lao động đơn vị & KSK đơn vị
    atvsldData.forEach((at: any) => {
      if (!currentSubordinateIds.includes(at.id_don_vi)) return;
      
      const checkAtvsldDate = (dateStr: any, typeLabel: string, intervalYears = 1) => {
        const d = parseDate(dateStr);
        if (!d) return;
        d.setFullYear(d.getFullYear() + intervalYears);
        d.setHours(0,0,0,0);
        const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        if (diff <= WARNING_DAYS) {
          list.push({
            id: `atvsld-${at.id}-${typeLabel}`,
            category: 'personnel_cert',
            title: typeLabel,
            detail: `Hồ sơ An toàn lao động đơn vị`,
            dateStr: d.toLocaleDateString('vi-VN'),
            daysLeft: diff,
            type: diff < 0 ? 'expired' : 'warning',
            unitName: donViMap[at.id_don_vi] || at.id_don_vi
          });
        }
      };

      checkAtvsldDate(at.ngay_ksk, 'Đến kỳ khám sức khỏe định kỳ đơn vị');
      checkAtvsldDate(at.ngay_tu_kiem_tra, 'Đến kỳ tự kiểm tra ATVSLĐ đơn vị');
    });

    // PCCC đơn vị
    pcccData.forEach((p: any) => {
      if (!currentSubordinateIds.includes(p.id_don_vi)) return;

      const bhDate = parseDate(p.ngay_het_han_bh);
      if (bhDate) {
        bhDate.setHours(0,0,0,0);
        const diff = Math.ceil((bhDate.getTime() - today.getTime()) / 86400000);
        if (diff <= WARNING_DAYS) {
          list.push({
            id: `pccc-bh-${p.id}`,
            category: 'personnel_cert',
            title: 'Hết hạn bảo hiểm cháy nổ đơn vị',
            detail: `Bảo hiểm cháy nổ của cơ sở`,
            dateStr: bhDate.toLocaleDateString('vi-VN'),
            daysLeft: diff,
            type: diff < 0 ? 'expired' : 'warning',
            unitName: donViMap[p.id_don_vi] || p.id_don_vi
          });
        }
      }

      const dtDate = parseDate(p.ngay_dien_tap);
      if (dtDate) {
        dtDate.setFullYear(dtDate.getFullYear() + 1);
        dtDate.setHours(0,0,0,0);
        const diff = Math.ceil((dtDate.getTime() - today.getTime()) / 86400000);
        if (diff <= WARNING_DAYS) {
          list.push({
            id: `pccc-dt-${p.id}`,
            category: 'personnel_cert',
            title: 'Đến kỳ diễn tập PCCC định kỳ đơn vị',
            detail: `Diễn tập PCCC cơ sở thường niên`,
            dateStr: dtDate.toLocaleDateString('vi-VN'),
            daysLeft: diff,
            type: diff < 0 ? 'expired' : 'warning',
            unitName: donViMap[p.id_don_vi] || p.id_don_vi
          });
        }
      }
    });

    // Quét Hợp đồng Bảo vệ (Security contracts) từ anNinhData
    anNinhData.forEach((a: any) => {
      if (!currentSubordinateIds.includes(a.id_don_vi)) return;

      let expDate = parseDate(a.ngay_het_han || a.ngay_het_han_hd || a.ngay_ket_thuc || a.ngay_kt);
      if (!expDate) {
        const durationRaw = a.han_hop_dong || a.han_hd || a.thoi_han_hd || a.thoi_gian_hd || a.thoi_han || a.thoi_gian_luu || ''; 
        const startRaw = a.ngay_ky_hd || a.ngay_cd || a.ngay_ky || a.ngay_bat_dau || '';
        const baseDate = parseDate(startRaw);
        if (baseDate) {
          let monthsToAdd = 0;
          const s = String(durationRaw).toLowerCase().trim();
          if (/^\d+$/.test(s)) {
            monthsToAdd = parseInt(s, 10);
          } else {
            const monthMatch = s.match(/(\d+)\s*tháng/);
            const yearMatch = s.match(/(\d+)\s*năm/);
            if (monthMatch) monthsToAdd = parseInt(monthMatch[1], 10);
            else if (yearMatch) monthsToAdd = parseInt(yearMatch[1], 10) * 12;
          }
          if (monthsToAdd > 0) {
            baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
          }
          expDate = baseDate;
        }
      }

      const giaHanThem = Number(a.gia_han_them) || 0;
      if (expDate && giaHanThem > 0) {
        expDate.setMonth(expDate.getMonth() + giaHanThem);
      }

      if (expDate) {
        expDate.setHours(0, 0, 0, 0);
        const diff = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
        if (diff <= WARNING_DAYS) {
          list.push({
            id: `security-${a.id}`,
            category: 'personnel_cert',
            title: 'Hạn hợp đồng bảo vệ đơn vị',
            detail: `Đối tác: ${a.don_vi_phoi_hop || 'Công ty BV'} - Số HĐ: ${a.so_hop_dong || '---'}`,
            dateStr: expDate.toLocaleDateString('vi-VN'),
            daysLeft: diff,
            type: diff < 0 ? 'expired' : 'warning',
            unitName: donViMap[a.id_don_vi] || a.id_don_vi
          });
        }
      }
    });

    // 4. Quét Sinh nhật trong tháng
    nsData.forEach((ns: any) => {
      if (!currentSubordinateIds.includes(ns.id_don_vi)) return;
      if (ns.trang_thai === 'Đã nghỉ việc') return;

      const bDate = parseDate(ns.nam_sinh);
      if (bDate) {
        const todayMonth = today.getMonth();
        if (bDate.getMonth() === todayMonth) {
          const bDay = bDate.getDate();
          const todayDay = today.getDate();
          const isPassed = bDay < todayDay;
          const isToday = bDay === todayDay;

          const unitLabel = donViMap[ns.id_don_vi] || ns.id_don_vi || 'Công ty';
          list.push({
            id: `ns-sn-${ns.id}`,
            category: 'personnel_event',
            title: `🎂 Sinh nhật: ${ns.ho_ten}`,
            detail: `${ns.ma_so_nhan_vien || '---'} - ${ns.ho_ten} - ${ns.chuc_vu || 'Nhân viên'} - ${unitLabel}`,
            dateStr: `${bDay < 10 ? '0' + bDay : bDay}/${todayMonth + 1 < 10 ? '0' + (todayMonth + 1) : todayMonth + 1}`,
            daysLeft: bDay - todayDay,
            dayOfMonth: bDay,
            isPassed: isPassed,
            isToday: isToday,
            type: 'event',
            unitName: unitLabel
          });
        }
      }
    });

    return list.sort((a, b) => {
      // Nếu cả 2 đều là sinh nhật -> sắp xếp theo thứ tự ngày trong tháng (1 -> 31)
      if (a.category === 'personnel_event' && b.category === 'personnel_event') {
        return (a.dayOfMonth || 0) - (b.dayOfMonth || 0);
      }
      // Đẩy sinh nhật xuống sau các cảnh báo quan trọng khi xem Tất cả
      if (a.category === 'personnel_event') return 1;
      if (b.category === 'personnel_event') return -1;
      return a.daysLeft - b.daysLeft;
    });
  }, [xeData, tbData, nsData, atvsldData, pcccData, anNinhData, currentSubordinateIds, donViMap]);

  const { expiredCount, warningCount, birthdayCount } = useMemo(() => {
    let exp = 0;
    let warn = 0;
    let birth = 0;
    notifications.forEach(n => {
      if (n.category === 'personnel_event') {
        birth++;
        return;
      }
      if (n.type === 'expired') exp++;
      else warn++;
    });
    return { expiredCount: exp, warningCount: warn, birthdayCount: birth };
  }, [notifications]);

  // Tự động mở rộng trung tâm thông báo nếu có cảnh báo quá hạn khi dữ liệu tải xong
  useEffect(() => {
    if (expiredCount > 0) {
      setIsNotifHubOpen(true);
    }
  }, [expiredCount]);

  const filteredNotifications = useMemo(() => {
    if (activeNotifTab === 'all') return notifications;
    return notifications.filter(n => n.category === activeNotifTab);
  }, [notifications, activeNotifTab]);

    // --- RENDERING CHUNG CHO WIDGET (DÙNG CHO VÙNG GHIM VÀ VÙNG THƯỜNG) ---
  const renderCustomWidgetCard = (widget: WidgetConfig) => {
    if (!widget.visible) return null;

    const renderHeader = (title: string, subtitle: string, icon: React.ReactNode) => (
      <div className="mb-4 shrink-0 border-b border-gray-100 dark:border-slate-700 pb-3">
        <h3 className="text-base font-black text-[#05469B] dark:text-blue-400 flex items-center gap-2">{icon} {title}</h3>
        <p className="text-[11px] font-bold text-gray-400 dark:text-slate-400 mt-1">{subtitle}</p>
      </div>
    );

    switch (widget.id) {
      case 'chart_vehicles':
        return (
          <div key={widget.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col h-[480px] hover:shadow-md transition-all">
            {renderHeader('Đội xe & Phương tiện', 'Cơ cấu hãng xe & trạng thái vận hành', <Car size={20} />)}
            <div className="flex-1 w-full h-full min-h-0 overflow-y-auto custom-scrollbar">
              <VehicleFleetChart vehicles={xeData} />
            </div>
          </div>
        );

      case 'chart_personnel':
        return (
          <div key={widget.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col h-[480px] hover:shadow-md transition-all">
            {renderHeader('Cơ cấu Nhân sự', 'Phân bố nhân sự theo nghiệp vụ', <Briefcase size={20} />)}
            <div className="flex-1 w-full h-full min-h-0 overflow-hidden">
              <PersonnelDoughnutChart data={staffChartData.data} />
            </div>
          </div>
        );

      case 'chart_docs':
        return (
          <div key={widget.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col h-[480px] hover:shadow-md transition-all">
            <div className="mb-4 shrink-0 border-b border-gray-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-black text-[#05469B] dark:text-blue-400 flex items-center gap-2"><BellRing size={20}/> Văn bản - Thông báo</h3>
              <p className="text-[11px] font-bold text-gray-400 dark:text-slate-400 mt-1">Phòng ban ban hành nhiều nhất</p>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">Lọc năm ban hành:</span>
                <select 
                  value={docYear} 
                  onChange={(e) => setDocYear(Number(e.target.value))} 
                  className="bg-blue-50 dark:bg-slate-700 text-[#05469B] dark:text-blue-300 text-xs font-bold py-1 px-3 rounded-xl outline-none border border-blue-100 dark:border-slate-600 cursor-pointer shadow-sm"
                >
                  {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map(y => <option key={y} value={y}>Năm {y}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-1 w-full h-full min-h-0 overflow-hidden">
              <DocumentBarChart data={docChartData.data} maxCount={docChartData.maxCount} />
            </div>
          </div>
        );

      case 'chart_assets':
        return (
          <div key={widget.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col h-[480px] hover:shadow-md transition-all">
            {renderHeader('Thiết bị Văn phòng', 'Trạng thái sử dụng theo nhóm', <Activity size={20} />)}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-4 text-[9px] font-bold text-gray-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/60 p-2.5 rounded-xl shrink-0 border border-slate-100 dark:border-slate-600">
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Sử dụng</div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>Lưu kho</div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>Sửa chữa</div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Hỏng/TL</div>
            </div>
            <div className="flex-1 w-full h-full min-h-0 overflow-hidden">
              <AssetSegmentedChart data={assetChartData} />
            </div>
          </div>
        );

      case 'table_pccc':
        return (
          <div key={widget.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-red-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="bg-red-50/50 dark:bg-red-950/30 p-4 border-b border-red-100 dark:border-slate-700 flex items-start justify-between shrink-0">
              <div>
                <h3 className="font-black text-red-800 dark:text-red-300 text-xs uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0 animate-bounce" size={18}/> Hạn Nạp/Sạc Thiết bị PCCC
                </h3>
                <p className="text-[11px] font-bold text-red-600/70 dark:text-red-400/70 mt-1">Danh sách thiết bị PCCC sắp hoặc đã quá hạn kiểm định</p>
              </div>
              <span className="bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm shrink-0">{pcccWarningsGrouped.length}</span>
            </div>
            <div className="p-0 overflow-x-auto flex-1 max-h-[350px] custom-scrollbar">
              {pcccWarningsGrouped.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-16">
                  <Flame size={44} className="mb-3 opacity-30 text-emerald-500"/>
                  <p className="font-bold text-sm text-emerald-600">Tất cả thiết bị đều an toàn</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm cursor-default">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 font-bold uppercase text-[9px] tracking-wider sticky top-0 z-10 border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Đơn vị</th>
                      <th className="p-3 text-center">Hạn Kiểm định</th>
                      <th className="p-3 text-right">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                    {pcccWarningsGrouped.map((warn, idx) => {
                      const tooltipText = Object.entries(warn.items).map(([name, count]) => `• ${name}: ${count} thiết bị`).join('\n');
                      return (
                        <tr key={idx} className="hover:bg-red-50/30 dark:hover:bg-slate-700/30 transition-colors cursor-help" title={tooltipText}>
                          <td className="p-3 font-bold text-[#05469B] dark:text-blue-400 text-xs" title={tooltipText}>{warn.unitName}</td>
                          <td className="p-3 text-center font-semibold text-xs text-gray-600 dark:text-slate-300" title={tooltipText}>{warn.dateStr}</td>
                          <td className="p-3 text-right text-xs">
                            {warn.daysLeft <= 0 ? (
                              <span className="font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded-full text-[11px] animate-pulse">Quá hạn</span>
                            ) : (
                              <span className="font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/50 px-2 py-0.5 rounded-full text-[11px]">Còn {warn.daysLeft} ngày</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );

      case 'table_camera':
        return (
          <div key={widget.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-4 border-b border-indigo-100 dark:border-slate-700 flex items-start justify-between shrink-0">
              <div>
                <h3 className="font-black text-indigo-800 dark:text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Video className="text-indigo-600 dark:text-indigo-400 shrink-0" size={18}/> Hệ thống Camera Giám sát
                </h3>
                <p className="text-[11px] font-bold text-indigo-600/70 dark:text-indigo-400/70 mt-1">Tình trạng hoạt động và cảnh báo lỗi camera toàn hệ thống</p>
              </div>
              <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm shrink-0">{cameraStatsList.length}</span>
            </div>
            <div className="p-0 overflow-x-auto flex-1 max-h-[350px] custom-scrollbar">
              {cameraStatsList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-16">
                  <MonitorSmartphone size={44} className="mb-3 opacity-30 text-gray-400"/>
                  <p className="font-bold text-sm text-gray-500">Chưa có dữ liệu hệ thống Camera</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm cursor-default">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 font-bold uppercase text-[9px] tracking-wider sticky top-0 z-10 border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Đơn vị</th>
                      <th className="p-3 text-center">Tổng SL</th>
                      <th className="p-3 text-center">Hoạt động</th>
                      <th className="p-3 text-right">Lỗi / Hỏng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                    {cameraStatsList.map((cam, idx) => {
                      const tooltipText = cam.camHu > 0 ? `Lý do hỏng: ${cam.lyDoHu}` : 'Hệ thống Camera hoạt động bình thường';
                      return (
                        <tr key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-slate-700/30 transition-colors cursor-help" title={tooltipText}>
                          <td className="p-3 font-bold text-[#05469B] dark:text-blue-400 text-xs" title={tooltipText}>{cam.unitName}</td>
                          <td className="p-3 text-center font-black text-gray-700 dark:text-slate-300 text-xs" title={tooltipText}>{cam.tongCam}</td>
                          <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400 text-xs" title={tooltipText}>{cam.camHD}</td>
                          <td className="p-3 text-right" title={tooltipText}>
                            {cam.camHu > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 font-black rounded border border-red-200 dark:border-red-800 text-[9px] animate-pulse">
                                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span></span>
                                {cam.camHu} Cam lỗi
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold rounded border border-emerald-200 dark:border-emerald-800 text-[9px]">Tốt</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );

      case 'table_security':
        return (
          <div key={widget.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="bg-blue-50/50 dark:bg-blue-950/30 p-4 border-b border-blue-100 dark:border-slate-700 flex items-start justify-between shrink-0">
              <div>
                <h3 className="font-black text-blue-800 dark:text-blue-300 text-xs uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="text-blue-600 dark:text-blue-400 shrink-0" size={18}/> Hợp đồng thuê Bảo vệ
                </h3>
                <p className="text-[11px] font-bold text-blue-600/70 dark:text-blue-400/70 mt-1">Quản lý các hợp đồng dịch vụ an ninh và chi phí bảo vệ</p>
              </div>
              <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm shrink-0">{anNinhStatsList.length}</span>
            </div>
            <div className="p-0 overflow-x-auto flex-1 max-h-[350px] custom-scrollbar">
              {anNinhStatsList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-16">
                  <ShieldAlert size={44} className="mb-3 opacity-30 text-gray-400"/>
                  <p className="font-bold text-sm text-gray-500">Không có đơn vị thuê dịch vụ ngoài</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm cursor-default">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 font-bold uppercase text-[9px] tracking-wider sticky top-0 z-10 border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Đơn vị thuê</th>
                      <th className="p-3 text-center">Hạn hợp đồng</th>
                      <th className="p-3 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                    {anNinhStatsList.map((stat, idx) => {
                      const isWarning = stat.daysLeft !== null && stat.daysLeft <= 30;
                      const tooltipText = `Đơn vị cung cấp dịch vụ bảo vệ ngoài: ${stat.provider}\nTổng chi phí thuê: ${stat.cost}`;
                      
                      return (
                        <tr key={idx} className={`transition-colors cursor-help ${isWarning ? 'hover:bg-red-50/30 dark:hover:bg-red-950/30' : 'hover:bg-blue-50/30 dark:hover:bg-slate-700/30'}`} title={tooltipText}>
                          <td className="p-3 font-bold text-[#05469B] dark:text-blue-400 text-xs truncate max-w-[120px]" title={tooltipText}>{stat.unitName}</td>
                          <td className="p-3 text-center font-semibold text-xs text-gray-600 dark:text-slate-300" title={tooltipText}>
                            {stat.dateStr}
                            {stat.giaHanThem > 0 && <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 font-black mt-0.5">(+ {stat.giaHanThem} tháng gia hạn)</span>}
                          </td>
                          <td className="p-3 text-right" title={tooltipText}>
                            {stat.daysLeft === null ? (
                              <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 font-bold rounded border border-gray-200 dark:border-slate-600 text-[9px]">Chưa rõ</span>
                            ) : stat.daysLeft < 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 font-black rounded border border-red-200 dark:border-red-800 text-[9px] animate-pulse">
                                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span></span>
                                Hết hạn
                              </span>
                            ) : stat.daysLeft === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 font-black rounded border border-red-200 dark:border-red-800 text-[9px] animate-pulse">
                                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span></span>
                                Hết hôm nay
                              </span>
                            ) : stat.daysLeft <= 30 ? (
                              <span className="inline-block px-2 py-0.5 bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 font-bold rounded border border-orange-200 dark:border-orange-800 text-[9px]">Còn {stat.daysLeft} ngày</span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold rounded border border-emerald-200 dark:border-emerald-800 text-[9px]">Hiệu lực</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex w-full max-w-full h-full bg-[#f8fafc] overflow-hidden relative">
      {isListCollapsed && (
        <button 
          onClick={() => setIsListCollapsed(false)} 
          className="hidden md:block absolute top-6 left-6 z-20 bg-white p-2.5 rounded-xl shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all hover:scale-105"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

      {/* 🟢 SIDEBAR BỘ LỌC ĐỒNG BỘ */}
      <UnitFilterSidebar
        donViList={donViList}
        selectedUnitFilter={selectedUnitFilter}
        setSelectedUnitFilter={setSelectedUnitFilter}
        allowedDonViIds={allowedDonViIds}
        unitSearchTerm={unitSearchTerm}
        setUnitSearchTerm={setUnitSearchTerm}
        expandedParents={expandedParents}
        setExpandedParents={setExpandedParents}
        isListCollapsed={isListCollapsed}
        setIsListCollapsed={setIsListCollapsed}
        themeColor="blue"
        allUnitsLabel="Báo cáo tổng hợp hệ thống"
      />

      <div className="flex-1 min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 lg:p-8 relative transition-all duration-300">
        
        {/* Header Dashboard */}
        <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
          <div className="flex items-center gap-2.5">
            {isListCollapsed && (
              <button 
                onClick={() => setIsListCollapsed(false)} 
                className="lg:hidden bg-white p-2 rounded-xl shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all flex items-center justify-center shrink-0"
                title="Mở bộ lọc đơn vị"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#05469B] dark:text-blue-400 flex items-center gap-2.5 tracking-tight"><LayoutDashboard size={32} /> Tổng Quan Hệ Thống</h1>
              <p className="text-gray-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2 text-sm">
                Đang phân tích dữ liệu: 
                <span className="px-3 py-1 bg-blue-50 dark:bg-slate-800 text-[#05469B] dark:text-blue-300 border border-blue-100 dark:border-slate-700 rounded-lg font-bold text-xs shadow-sm">
                  {selectedUnitName}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCustomizerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-[#05469B] dark:text-blue-300 border border-blue-200 dark:border-slate-700 rounded-xl font-bold text-sm shadow-sm transition-all hover:scale-105"
            >
              <Settings size={18} className="animate-spin-slow" />
              <span>Tùy chỉnh & Ghim Widget</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Loader2 className="w-10 h-10 animate-spin text-[#05469B] mb-4" />
            <p className="text-gray-500 font-bold animate-pulse">Đang tổng hợp số liệu báo cáo...</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* 🌟 VÙNG WIDGET ƯU TIÊN ĐÃ GHIM THEO CHUYÊN MÔN (PINNED WIDGETS) */}
            {widgetConfigs.some(w => w.pinned && w.visible && (w.id.startsWith('chart_') || w.id.startsWith('table_'))) && (
              <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/80 dark:from-slate-800/80 dark:via-slate-800 dark:to-slate-800/80 p-5 rounded-3xl border border-amber-200/80 dark:border-amber-700/60 shadow-md mb-8 animate-in fade-in">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-amber-200/60 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-amber-400 text-white rounded-xl shadow-sm"><Star size={20} className="fill-current animate-spin-slow"/></span>
                    <div>
                      <h2 className="text-base font-black text-amber-900 dark:text-amber-300 tracking-wide uppercase">Biểu đồ & Số liệu Ưu tiên đã Ghim</h2>
                      <p className="text-xs font-bold text-amber-700/80 dark:text-amber-400/80">Hiển thị tức thì các Widget theo đúng chuyên môn quản lý của bạn</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCustomizerOpen(true)}
                    className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1"
                  >
                    <span>⚙️ Cấu hình ghim</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {widgetConfigs
                    .filter(w => w.pinned && w.visible && (w.id.startsWith('chart_') || w.id.startsWith('table_')))
                    .sort((a, b) => a.order - b.order)
                    .map(widget => renderCustomWidgetCard(widget))}
                </div>
              </div>
            )}

            {/* 🟢 TRUNG TÂM THÔNG BÁO (NOTIFICATION HUB) */}
            <ExpiryAlertPanel
              isNotifHubOpen={isNotifHubOpen}
              setIsNotifHubOpen={setIsNotifHubOpen}
              expiredCount={expiredCount}
              warningCount={warningCount}
              activeNotifTab={activeNotifTab}
              setActiveNotifTab={setActiveNotifTab}
              notifications={notifications}
              filteredNotifications={filteredNotifications}
            />

            {/* 🟢 VÙNG 1: CARD SỐ LIỆU WIDGETS (GLASSMORPHISM STYLE) */}
            <KpiSection
              vpdhUnits={vpdhUnits}
              ctttNamUnits={ctttNamUnits}
              ctttBacUnits={ctttBacUnits}
              widgetStats={widgetStats}
              staffRolesStats={staffRolesStats}
            />

            {/* VÙNG 1.5: QUY MÔ HỆ THỐNG THEO MIỀN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Showroom Miền Nam */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-5 border-b border-gray-50 pb-3">
                  <h3 className="text-sm font-black text-orange-600 uppercase tracking-wider flex items-center gap-2"><MapPin size={18}/> Quy mô CTTT Phía Nam</h3>
                  <span className="text-xs font-bold text-gray-400">Số cơ sở trực thuộc</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-2 space-y-3.5">
                  {companyScaleStats.nam.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-4">Không có dữ liệu</p>
                  ) : (
                    companyScaleStats.nam.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-3 group">
                        <div className="w-[140px] sm:w-[180px] xl:w-[220px] text-left shrink-0">
                          <p className="text-xs font-bold text-gray-700 truncate group-hover:text-orange-600 transition-colors" title={item.name}>
                            {idx + 1}. {item.name}
                          </p>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="h-3.5 bg-gradient-to-r from-orange-100 to-orange-400 rounded-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `${Math.max((item.count / maxScaleNam) * 100, 3)}%` }}></div>
                          <span className="text-xs font-black text-gray-500 w-6">{item.count}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Showroom Miền Bắc */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-5 border-b border-gray-50 pb-3">
                  <h3 className="text-sm font-black text-emerald-600 uppercase tracking-wider flex items-center gap-2"><MapPin size={18}/> Quy mô CTTT Phía Bắc</h3>
                  <span className="text-xs font-bold text-gray-400">Số cơ sở trực thuộc</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-2 space-y-3.5">
                  {companyScaleStats.bac.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-4">Không có dữ liệu</p>
                  ) : (
                    companyScaleStats.bac.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-3 group">
                        <div className="w-[140px] sm:w-[180px] xl:w-[220px] text-left shrink-0">
                          <p className="text-xs font-bold text-gray-700 truncate group-hover:text-emerald-600 transition-colors" title={item.name}>
                            {idx + 1}. {item.name}
                          </p>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="h-3.5 bg-gradient-to-r from-emerald-100 to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `${Math.max((item.count / maxScaleBac) * 100, 3)}%` }}></div>
                          <span className="text-xs font-black text-gray-500 w-6">{item.count}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 🟢 VÙNG 2: BẢNG THEO DÕI & CẢNH BÁO TỰ ĐỘNG */}
            {widgetConfigs.some(w => w.id.startsWith('table_') && w.visible && !w.pinned) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {widgetConfigs
                  .filter(w => w.id.startsWith('table_') && w.visible && !w.pinned)
                  .sort((a, b) => a.order - b.order)
                  .map(widget => renderCustomWidgetCard(widget))}
              </div>
            )}

            {/* 🟢 VÙNG 3: BIỂU ĐỒ THỐNG KÊ CHI TIẾT */}
            {widgetConfigs.some(w => w.id.startsWith('chart_') && w.visible && !w.pinned) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {widgetConfigs
                  .filter(w => w.id.startsWith('chart_') && w.visible && !w.pinned)
                  .sort((a, b) => a.order - b.order)
                  .map(widget => renderCustomWidgetCard(widget))}
              </div>
            )}

          </div>
        )}

        {/* MODAL TÙY CHỈNH DASHBOARD */}
        <DashboardCustomizerModal
          isOpen={isCustomizerOpen}
          onClose={() => setIsCustomizerOpen(false)}
          widgets={widgetConfigs}
          onUpdateWidgets={handleUpdateWidgets}
          onReset={handleResetWidgets}
        />

      </div>
    </div>
  );
}