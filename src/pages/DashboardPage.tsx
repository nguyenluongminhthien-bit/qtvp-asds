import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DonVi, Personnel, ThietBi } from '../types';
import { getUnitEmoji } from '../utils/hierarchy';
import { formatCurrency, parseDateStrict } from '../utils/formatters';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import ExpiryAlert from '../components/ExpiryAlert';

import { 
  Building2, MapPin, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Search, Loader2, Filter, LayoutDashboard, Users, MonitorSmartphone,
  Flame, AlertTriangle, Activity, Briefcase, BellRing, FileText, ShieldAlert, ShieldCheck, Video, Tag, Car
} from 'lucide-react';

import { buildHierarchicalOptions, sortDonViByThuTu, groupParentUnits } from '../utils/hierarchy'; 

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

export default function DashboardPage() {
  const { user } = useAuth();
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  
  // Dữ liệu thô từ APIs
  const [nsData, setNsData] = useState<Personnel[]>([]);
  const [tbData, setTbData] = useState<ThietBi[]>([]);
  const [tsPcccData, setTsPcccData] = useState<any[]>([]); 
  const [vbData, setVbData] = useState<any[]>([]); 
  const [anNinhData, setAnNinhData] = useState<any[]>([]); 
  
  const [loading, setLoading] = useState(true);

  // --- SLICER STATES ---
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);
  
  const currentYear = new Date().getFullYear();
  const [docYear, setDocYear] = useState<number>(currentYear);

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
        const [dvRes, nsRes, tbRes, tsPcccRes, vbRes, anNinhRes] = await Promise.all([
          safeCall(apiService.getDonVi),
          safeCall(apiService.getPersonnel),
          safeCall(apiService.getThietBi),
          safeCall((apiService as any).getTsPCCC),
          safeCall((apiService as any).getVanBan),
          safeCall((apiService as any).getAnNinh) 
        ]);

        setDonViList(dvRes);
        setNsData(nsRes);
        setTbData(tbRes);
        setTsPcccData(tsPcccRes);
        setVbData(vbRes);
        setAnNinhData(anNinhRes);
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

  const allowedDonViIds = useMemo(() => {
    if (!user) return [];
    if (user.id_don_vi === 'ALL') return donViList.map(dv => dv.id);
    const level1 = [user.id_don_vi];
    const level2 = donViList.filter(dv => level1.includes(dv.cap_quan_ly)).map(dv => dv.id);
    const level3 = donViList.filter(dv => level2.includes(dv.cap_quan_ly)).map(dv => dv.id);
    return [...level1, ...level2, ...level3];
  }, [user, donViList]);

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
        if (role.includes('PT DVHT KD')) dvht++;
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

  if (loading) return <DashboardSkeleton />;
  return (
    <div className="flex h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (
        <button onClick={() => setIsListCollapsed(false)} className="absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all">
          <PanelLeftOpen size={20} />
        </button>
      )}

      <div className={`${isListCollapsed ? 'w-0 opacity-0 -ml-80 lg:ml-0' : 'w-80 opacity-100 absolute lg:relative inset-y-0 left-0'} transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col h-full shadow-2xl lg:shadow-sm z-50 lg:z-10 shrink-0 overflow-hidden`}>
        <div className="p-4 border-b border-gray-100 bg-blue-50/50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-[#05469B] flex items-center gap-2"><Filter size={20} /> Bộ lọc Báo cáo</h2>
            <button onClick={() => setIsListCollapsed(true)} className="p-1.5 text-gray-400 hover:text-[#05469B] hover:bg-blue-100 rounded-md"><PanelLeftClose size={18} /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#05469B]/50" size={16} />
            <input type="text" placeholder="Tìm tên đơn vị để lọc..." className="w-full pl-9 pr-4 py-2 bg-white border border-blue-100 rounded-lg text-sm focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm" value={unitSearchTerm} onChange={(e) => setUnitSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 min-w-[319px] custom-scrollbar">
          <button onClick={() => setSelectedUnitFilter(null)} className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-black mb-4 transition-all ${selectedUnitFilter === null ? 'bg-gradient-to-r from-[#05469B] to-[#0a5bc4] text-white shadow-md' : 'text-gray-600 hover:bg-blue-50'}`}>
            <Building2 size={18} className={selectedUnitFilter === null ? 'text-blue-100' : 'text-[#05469B]'} /> Báo cáo tổng hợp
          </button>
          <hr className="border-gray-100 mb-4 mx-2"/>
          {loading ? (<div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#05469B]" /></div>) : (
            <div className="space-y-6">
              {vpdhUnits.length > 0 && (<div><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2 flex items-center gap-1">VPĐH / TCT</p>{vpdhUnits.map(dv => renderUnitTree(dv))}</div>)}
              {ctttNamUnits.length > 0 && (<div><p className="px-3 text-[10px] font-black text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1">CTTT Phía Nam</p>{ctttNamUnits.map(dv => renderUnitTree(dv))}</div>)}
              {ctttBacUnits.length > 0 && (<div><p className="px-3 text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">CTTT Phía Bắc</p>{ctttBacUnits.map(dv => renderUnitTree(dv))}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative transition-all duration-300">
        
        <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 transition-all duration-300 ${isListCollapsed ? 'pl-10 lg:pl-12' : ''}`}>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#05469B] flex items-center gap-2 tracking-tight"><LayoutDashboard size={32} /> Tổng Quan Hệ Thống</h1>
            <p className="text-gray-500 font-medium mt-1 flex items-center gap-2">Đang phân tích dữ liệu: <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold text-sm shadow-sm">{selectedUnitName}</span></p>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Loader2 className="w-10 h-10 animate-spin text-[#05469B] mb-4" />
            <p className="text-gray-500 font-bold animate-pulse">Đang tổng hợp số liệu báo cáo...</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* 🟢 CHÈN CẢNH BÁO TỰ ĐỘNG VÀO ĐÂY */}
            <ExpiryAlert 
              selectedUnitId={selectedUnitFilter} 
              donViMap={donViMap} 
            />
            
            {/* 🟢 VÙNG 1: WIDGETS TỔNG QUAN QUY MÔ (ĐÃ CẬP NHẬT GIAO DIỆN 1 HÀNG) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center hover:shadow-md transition-shadow">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 size={14}/>Hệ thống Quản trị</p>
                <div className="flex items-center justify-between px-2">
                  <div className="text-center">
                    <p className="text-2xl font-black text-[#05469B]">{vpdhUnits.length}</p>
                    <p className="text-[10px] font-bold text-gray-400">VPĐH</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100"></div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-orange-600">{ctttNamUnits.length}</p>
                    <p className="text-[10px] font-bold text-gray-400">PHÍA NAM</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100"></div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-emerald-600">{ctttBacUnits.length}</p>
                    <p className="text-[10px] font-bold text-gray-400">PHÍA BẮC</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 z-10"><Building2 size={28}/></div>
                <div className="z-10">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cơ sở / SR Trực thuộc</p>
                  <p className="text-3xl font-black text-gray-800">{widgetStats.totalUnits}</p>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-5"><Building2 size={100}/></div>
              </div>

              {/* Ô TỔNG NHÂN SỰ VÀ CƠ CẤU (CHIẾM 2 CỘT NGANG) */}
              <div className="xl:col-span-2 bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between relative overflow-hidden gap-4 h-full">
                
                {/* Khối bên trái: Số lượng Tổng */}
                <div className="flex items-center gap-3 shrink-0 z-10 pl-2 border-r border-gray-100 pr-4 sm:pr-6 h-full">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm border border-emerald-100">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Tổng Nhân sự</p>
                    <p className="text-2xl sm:text-3xl font-black text-gray-800 leading-none">{widgetStats.totalStaff}</p>
                  </div>
                </div>
                
                {/* Khối bên phải: 3 cột cơ cấu nhỏ */}
                <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-3 z-10 h-full py-1">
                  <div className="bg-blue-50/70 rounded-xl p-1.5 sm:p-2 text-center border border-blue-100/50 hover:bg-blue-100 transition-colors cursor-help flex flex-col justify-between h-full" title="Nhân sự Phụ trách Quản trị văn phòng & An sinh đời sống">
                    <div className="h-8 flex items-center justify-center mb-1 sm:mb-2">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#05469B]/70 uppercase leading-tight line-clamp-2">NS PT QTVP & ASĐS</p>
                    </div>
                    <p className="font-black text-[#05469B] text-lg sm:text-xl leading-none">{staffRolesStats.dvht}</p>
                  </div>
                  
                  <div className="bg-blue-50/70 rounded-xl p-1.5 sm:p-2 text-center border border-blue-100/50 hover:bg-blue-100 transition-colors cursor-help flex flex-col justify-between h-full" title="Nhân sự Bảo vệ, Đón tiếp Khách hàng">
                    <div className="h-8 flex items-center justify-center mb-1 sm:mb-2">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#05469B]/70 uppercase leading-tight line-clamp-2">NS BV, ĐTKH</p>
                    </div>
                    <p className="font-black text-[#05469B] text-lg sm:text-xl leading-none">{staffRolesStats.bv}</p>
                  </div>
                  
                  <div className="bg-blue-50/70 rounded-xl p-1.5 sm:p-2 text-center border border-blue-100/50 hover:bg-blue-100 transition-colors cursor-help flex flex-col justify-between h-full" title="Nhân sự Phục vụ Hành chính">
                    <div className="h-8 flex items-center justify-center mb-1 sm:mb-2">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#05469B]/70 uppercase leading-tight line-clamp-2">NS PVHC</p>
                    </div>
                    <p className="font-black text-[#05469B] text-lg sm:text-xl leading-none">{staffRolesStats.pvhc}</p>
                  </div>
                </div>

                <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none"><Users size={150}/></div>
              </div>
            </div>

            {/* VÙNG 1.5: THỐNG KÊ QUY MÔ THEO MIỀN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-orange-50 pb-3">
                  <h3 className="text-sm font-black text-orange-600 uppercase tracking-wider flex items-center gap-2"><MapPin size={18}/> Quy mô CTTT Phía Nam</h3>
                  <span className="text-xs font-bold text-gray-400">Số cơ sở trực thuộc</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-2 space-y-3">
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
                          <div className="h-5 bg-gradient-to-r from-orange-100 to-orange-400 rounded-md transition-all duration-1000 ease-out shadow-sm" style={{ width: `${Math.max((item.count / maxScaleNam) * 100, 2)}%` }}></div>
                          <span className="text-xs font-black text-gray-600 w-6">{item.count}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-emerald-50 pb-3">
                  <h3 className="text-sm font-black text-emerald-600 uppercase tracking-wider flex items-center gap-2"><MapPin size={18}/> Quy mô CTTT Phía Bắc</h3>
                  <span className="text-xs font-bold text-gray-400">Số cơ sở trực thuộc</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-2 space-y-3">
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
                          <div className="h-5 bg-gradient-to-r from-emerald-100 to-emerald-400 rounded-md transition-all duration-1000 ease-out shadow-sm" style={{ width: `${Math.max((item.count / maxScaleBac) * 100, 2)}%` }}></div>
                          <span className="text-xs font-black text-gray-600 w-6">{item.count}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 🟢 VÙNG 3: BỐ CỤC 3 CỘT MỚI DÀNH CHO CÁC BẢNG CẢNH BÁO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* BẢNG 1: CẢNH BÁO THIẾT BỊ PCCC */}
              <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-red-600 shrink-0" size={20}/>
                    <h3 className="font-black text-red-800 text-sm uppercase tracking-wider">Theo dõi Nạp/Sạc TB PCCC</h3>
                  </div>
                  <span className="bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded-full">{pcccWarningsGrouped.length}</span>
                </div>
                <div className="p-0 overflow-x-auto flex-1 max-h-[350px] custom-scrollbar">
                  {pcccWarningsGrouped.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                      <Flame size={40} className="mb-2 opacity-30 text-emerald-500"/>
                      <p className="font-medium text-sm text-emerald-600">Tất cả thiết bị đều an toàn.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm cursor-default">
                      <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="p-3">Đơn vị</th>
                          <th className="p-3 text-center">Hạn Kiểm định</th>
                          <th className="p-3 text-right">Tình trạng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pcccWarningsGrouped.map((warn, idx) => {
                          const tooltipText = Object.entries(warn.items).map(([name, count]) => `• ${name}: ${count} thiết bị`).join('\n');
                          return (
                            <tr key={idx} className="hover:bg-red-50/30 transition-colors cursor-help" title={tooltipText}>
                              <td className="p-3 font-bold text-[#05469B] text-xs" title={tooltipText}>{warn.unitName}</td>
                              <td className="p-3 text-center font-semibold text-xs text-gray-700" title={tooltipText}>{warn.dateStr}</td>
                              <td className="p-3 text-right" title={tooltipText}>
                                {warn.daysLeft < 0 ? (
                                  <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 font-black rounded border border-red-200 text-[10px] animate-pulse">Trễ {Math.abs(warn.daysLeft)} ngày!</span>
                                ) : warn.daysLeft === 0 ? (
                                  <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 font-black rounded border border-red-200 text-[10px] animate-pulse">Hết hạn Hôm nay!</span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 font-bold rounded border border-orange-200 text-[10px]">Còn {warn.daysLeft} ngày</span>
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

              {/* 🟢 BẢNG 2: HỆ THỐNG CAMERA GIÁM SÁT*/}
              <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Video className="text-indigo-600 shrink-0" size={20}/>
                    <h3 className="font-black text-indigo-800 text-sm uppercase tracking-wider">Hệ thống Camera Giám sát</h3>
                  </div>
                  <span className="bg-indigo-600 text-white text-xs font-black px-2 py-0.5 rounded-full">{cameraStatsList.length}</span>
                </div>
                <div className="p-0 overflow-x-auto flex-1 max-h-[350px] custom-scrollbar">
                  {cameraStatsList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                      <MonitorSmartphone size={40} className="mb-2 opacity-30 text-gray-400"/>
                      <p className="font-medium text-sm text-gray-500">Chưa có dữ liệu hệ thống Camera.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm cursor-default">
                      <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="p-3">Đơn vị</th>
                          <th className="p-3 text-center">Tổng SL</th>
                          <th className="p-3 text-center">Hoạt động</th>
                          <th className="p-3 text-right">Hư/Hỏng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cameraStatsList.map((cam, idx) => {
                          const tooltipText = cam.camHu > 0 ? `Lý do hỏng: ${cam.lyDoHu}` : 'Hệ thống Camera hoạt động tốt';
                          return (
                            <tr key={idx} className="hover:bg-indigo-50/30 transition-colors cursor-help" title={tooltipText}>
                              <td className="p-3 font-bold text-[#05469B] text-xs" title={tooltipText}>{cam.unitName}</td>
                              <td className="p-3 text-center font-black text-gray-700 text-xs" title={tooltipText}>{cam.tongCam}</td>
                              <td className="p-3 text-center font-bold text-emerald-600 text-xs" title={tooltipText}>{cam.camHD}</td>
                              <td className="p-3 text-right" title={tooltipText}>
                                {cam.camHu > 0 ? (
                                  <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 font-black rounded border border-red-200 text-[10px] animate-pulse">{cam.camHu} lỗi</span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold rounded border border-emerald-200 text-[10px]">Tốt</span>
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

              {/* BẢNG 3: HỢP ĐỒNG THUÊ DỊCH VỤ BẢO VỆ */}
              <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-blue-600 shrink-0" size={20}/>
                    <h3 className="font-black text-blue-800 text-sm uppercase tracking-wider">HĐ Thuê DV Bảo vệ</h3>
                  </div>
                  <span className="bg-blue-600 text-white text-xs font-black px-2 py-0.5 rounded-full">{anNinhStatsList.length}</span>
                </div>
                <div className="p-0 overflow-x-auto flex-1 max-h-[350px] custom-scrollbar">
                  {anNinhStatsList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                      <ShieldAlert size={40} className="mb-2 opacity-30 text-gray-400"/>
                      <p className="font-medium text-sm text-gray-500">Chưa có đơn vị thuê dịch vụ ngoài.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm cursor-default">
                      <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="p-3">Đơn vị thuê</th>
                          <th className="p-3 text-center">Hạn HĐ</th>
                          <th className="p-3 text-right">Tình trạng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {anNinhStatsList.map((stat, idx) => {
                          const isWarning = stat.daysLeft !== null && stat.daysLeft <= 30;
                          const tooltipText = `NCC: ${stat.provider}\nChi phí: ${stat.cost}`;
                          
                          return (
                            <tr key={idx} className={`transition-colors cursor-help ${isWarning ? 'hover:bg-red-50/30' : 'hover:bg-blue-50/30'}`} title={tooltipText}>
                              <td className="p-3 font-bold text-[#05469B] text-xs truncate max-w-[120px]" title={tooltipText}>{stat.unitName}</td>
                              <td className="p-3 text-center font-semibold text-xs text-gray-600" title={tooltipText}>
                                {stat.dateStr}
                                {/* 🟢 HIỂN THỊ DẤU HIỆU CỘNG THÊM THÁNG GIA HẠN */}
                                {stat.giaHanThem > 0 && <span className="block text-[9px] text-emerald-600 font-bold mt-0.5">(+ {stat.giaHanThem} tháng)</span>}
                              </td>
                              <td className="p-3 text-right" title={tooltipText}>
                                {stat.daysLeft === null ? (
                                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 font-bold rounded border border-gray-200 text-[10px]">Chưa rõ</span>
                                ) : stat.daysLeft < 0 ? (
                                  <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 font-black rounded border border-red-200 text-[10px] animate-pulse">Quá hạn {Math.abs(stat.daysLeft)}</span>
                                ) : stat.daysLeft === 0 ? (
                                  <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 font-black rounded border border-red-200 text-[10px] animate-pulse">Hết hôm nay!</span>
                                ) : stat.daysLeft <= 30 ? (
                                  <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 font-bold rounded border border-orange-200 text-[10px]">Còn {stat.daysLeft} ngày</span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold rounded border border-emerald-200 text-[10px]">Hiệu lực</span>
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

            </div> 

            {/* VÙNG 2: 3 BIỂU ĐỒ TRỰC QUAN */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 1. BIỂU ĐỒ CƠ CẤU NHÂN SỰ */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[450px]">
                <div className="mb-6 shrink-0">
                  <h3 className="text-lg font-bold text-[#05469B] flex items-center gap-2"><Briefcase size={20}/>Phân loại Nhân sự</h3>
                  <p className="text-[11px] font-semibold text-gray-500 mt-1">Số lượng nhân sự theo từng nhóm nghiệp vụ</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                  {staffChartData.data.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <Users size={40} className="mb-2 opacity-50"/>
                      <p className="font-medium text-sm">Chưa có dữ liệu.</p>
                    </div>
                  ) : (
                    staffChartData.data.map((item, idx) => {
                      const widthPct = Math.max((item.count / staffChartData.maxCount) * 100, 2);
                      return (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-end">
                            <p className="text-xs font-bold text-gray-700 truncate pr-2">{item.name}</p>
                            <span className="text-xs font-black text-[#05469B] shrink-0">{item.count}</span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-300 to-[#05469B] rounded-full transition-all duration-1000 ease-out" style={{ width: `${widthPct}%` }}></div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* 2. BIỂU ĐỒ THỐNG KÊ THÔNG BÁO VĂN BẢN */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[450px]">
                <div className="mb-6 shrink-0 flex justify-between items-start gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-[#05469B] flex items-center gap-2"><BellRing size={20}/> Thông báo Ban hành</h3>
                    <p className="text-[11px] font-semibold text-gray-500 mt-1">Top 10 Phòng/Bộ phận phát hành nhiều nhất</p>
                  </div>
                  <select 
                    value={docYear} 
                    onChange={(e) => setDocYear(Number(e.target.value))} 
                    className="bg-blue-50 text-[#05469B] text-xs font-bold py-1.5 px-2 rounded-lg outline-none border border-blue-100 cursor-pointer shadow-sm"
                  >
                    {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>Năm {y}</option>)}
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                  {docChartData.data.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <FileText size={40} className="mb-2 opacity-50"/>
                      <p className="font-medium text-sm">Chưa có dữ liệu năm {docYear}.</p>
                    </div>
                  ) : (
                    docChartData.data.map((item, idx) => {
                      const widthPct = Math.max((item.count / docChartData.maxCount) * 100, 2);
                      return (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-end">
                            <p className="text-xs font-bold text-gray-700 truncate pr-2">{item.name}</p>
                            <span className="text-xs font-black text-[#05469B] shrink-0">{item.count}</span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-300 to-[#05469B] rounded-full transition-all duration-1000 ease-out" style={{ width: `${widthPct}%` }}></div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* 3. BIỂU ĐỒ TÌNH TRẠNG TÀI SẢN CHI TIẾT THEO NHÓM */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[450px]">
                <div className="mb-4 shrink-0">
                  <h3 className="text-lg font-bold text-[#05469B] flex items-center gap-2"><Activity size={20}/> Tình trạng Tài sản</h3>
                  <p className="text-[11px] font-semibold text-gray-500 mt-1">Trạng thái chi tiết theo từng nhóm thiết bị</p>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-2 mb-4 text-[10px] font-bold text-gray-600 bg-gray-50 p-2 rounded-lg shrink-0 border border-gray-100">
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Sử dụng</div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>Lưu kho</div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>Sửa chữa</div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Hỏng/TL</div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-5">
                  {assetChartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <MonitorSmartphone size={40} className="mb-2 opacity-50"/>
                      <p className="font-medium text-sm">Chưa có dữ liệu tài sản.</p>
                    </div>
                  ) : (
                    assetChartData.map((item, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-gray-700 truncate pr-2" title={item.name}>{item.name}</span>
                          <span className="font-black text-[#05469B] shrink-0 text-xs bg-blue-50 px-2 py-0.5 rounded">Tổng: {item.total}</span>
                        </div>
                        
                        <div className="flex h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                          {item.dangSuDung > 0 && <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${(item.dangSuDung/item.total)*100}%` }}></div>}
                          {item.luuKho > 0 && <div className="bg-blue-400 transition-all duration-1000" style={{ width: `${(item.luuKho/item.total)*100}%` }}></div>}
                          {item.suaChua > 0 && <div className="bg-orange-400 transition-all duration-1000" style={{ width: `${(item.suaChua/item.total)*100}%` }}></div>}
                          {item.thanhLy > 0 && <div className="bg-red-500 transition-all duration-1000" style={{ width: `${(item.thanhLy/item.total)*100}%` }}></div>}
                        </div>
                        
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-bold">
                          {item.dangSuDung > 0 && <span className="text-emerald-600">ĐSD: {item.dangSuDung}</span>}
                          {item.luuKho > 0 && <span className="text-blue-500">LK: {item.luuKho}</span>}
                          {item.suaChua > 0 && <span className="text-orange-500">SC: {item.suaChua}</span>}
                          {item.thanhLy > 0 && <span className="text-red-500">TL: {item.thanhLy}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div> 

          </div>
        )}

      </div>
    </div>
  );
}