import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, BarChart3, BarChart2, Tag, Building2, PanelLeftOpen, 
  Wallet, RefreshCw, Loader2, Search, RotateCcw, Sparkles, ChevronDown, PlusCircle, Layers, FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import { 
  DonVi, PhapNhan, DmKmp, DmBoPhan, BoPhanCap1, BoPhanCap2, 
  DNTT, DnttChiTiet, DnttPhanBo, ChiPhiChotKy, ChiPhiThongKe, DmNhomChiPhi
} from '../types';
import DnttTab from '../components/cost/DnttTab';
import CostStatisticsTab from '../components/cost/CostStatisticsTab';
import CostDashboardTab from '../components/cost/CostDashboardTab';
import KmpConfigTab from '../components/cost/KmpConfigTab';
import AdminLegalTab from '../components/cost/AdminLegalTab';
import { toast } from '../utils/toast';
import { isCostManagementUnit, getUserPermittedUnitIds, getAllSubordinateIds } from '../utils/hierarchy';

export default function CostManagementPage() {
  const { user } = useAuth();

  // Unit Filter Sidebar States
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  // Sub-tabs State (Mặc định: 'dntt')
  const [activeTab, setActiveTab] = useState<'dntt' | 'thong_ke' | 'dashboard' | 'kmp' | 'admin'>('dntt');
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'bophan' | 'phapnhan'>('bophan');
  const [activeThongKeSubTab, setActiveThongKeSubTab] = useState<'phan_tich' | 'quan_tri'>('phan_tich');
  const [costSearchTerm, setCostSearchTerm] = useState('');
  const [isFeaturesDropdownOpen, setIsFeaturesDropdownOpen] = useState(false);
  const [dnttCreateTrigger, setDnttCreateTrigger] = useState<number>(0);

  const isLevel2Open = activeTab === 'admin' || activeTab === 'thong_ke';

  // Dữ liệu State
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [phapNhanList, setPhapNhanList] = useState<PhapNhan[]>([]);
  const [kmpList, setKmpList] = useState<DmKmp[]>([]);
  const [nhomChiPhiList, setNhomChiPhiList] = useState<DmNhomChiPhi[]>([]);
  const [boPhanList, setBoPhanList] = useState<DmBoPhan[]>([]);
  const [cap1List, setCap1List] = useState<BoPhanCap1[]>([]);
  const [cap2List, setCap2List] = useState<BoPhanCap2[]>([]);
  const [dnttList, setDnttList] = useState<DNTT[]>([]);
  const [chiTietList, setChiTietList] = useState<DnttChiTiet[]>([]);
  const [phanBoList, setPhanBoList] = useState<DnttPhanBo[]>([]);
  const [chotKyList, setChotKyList] = useState<ChiPhiChotKy[]>([]);
  const [thongKeList, setThongKeList] = useState<ChiPhiThongKe[]>([]);
  const [loading, setLoading] = useState(true);

  // Danh sách Đơn vị chuẩn Quản trị chi phí (Chỉ gồm: Văn phòng, Công ty Tỉnh Thành, Showroom Quản trị)
  const costDonViList = useMemo(() => {
    return donViList.filter(isCostManagementUnit);
  }, [donViList]);

  // Phân quyền đơn vị của người dùng: Đơn vị mẹ + các đơn vị trực thuộc
  const userPermittedUnitIds = useMemo(() => {
    return getUserPermittedUnitIds(user, donViList);
  }, [user, donViList]);

  // Phân quyền đơn vị (áp dụng trên danh sách đơn vị quản trị chi phí)
  const allowedDonViIds = useMemo(() => {
    if (!userPermittedUnitIds) return costDonViList.map(dv => String(dv.id));
    return costDonViList.filter(dv => userPermittedUnitIds.has(String(dv.id))).map(dv => String(dv.id));
  }, [costDonViList, userPermittedUnitIds]);

  // Tìm đơn vị mẹ quản lý của tài khoản (dành cho tài khoản cấp đơn vị)
  const rootParentUnit = useMemo(() => {
    if (!userPermittedUnitIds) return null;
    return donViList.find(d => 
      userPermittedUnitIds.has(String(d.id)) && 
      (!d.cap_quan_ly || d.cap_quan_ly === 'HO' || d.cap_quan_ly === 'DV_HO')
    ) || null;
  }, [userPermittedUnitIds, donViList]);

  // Nhãn hiển thị cho nút Tất cả Đơn vị trong bộ lọc
  const allUnitsLabel = useMemo(() => {
    if (!userPermittedUnitIds) return 'Tất cả Đơn vị Quản trị';
    return 'Tất cả Đơn vị trực thuộc';
  }, [userPermittedUnitIds]);

  // Danh sách DNTT thuộc phạm vi phân quyền của tài khoản (Đơn vị mẹ + các đơn vị trực thuộc)
  const permittedDnttList = useMemo(() => {
    if (!userPermittedUnitIds) return dnttList;
    return dnttList.filter(d => {
      if (d.id_don_vi && userPermittedUnitIds.has(String(d.id_don_vi))) return true;
      if (d.don_vi_hien_thi) {
        const lower = d.don_vi_hien_thi.toLowerCase();
        for (const uid of userPermittedUnitIds) {
          const u = donViList.find(x => String(x.id) === uid);
          if (u?.ten_don_vi && lower.includes(u.ten_don_vi.toLowerCase())) return true;
        }
      }
      return false;
    });
  }, [dnttList, userPermittedUnitIds, donViList]);

  // Danh sách Phân bổ DNTT thuộc phạm vi phân quyền của tài khoản
  const permittedPhanBoList = useMemo(() => {
    if (!userPermittedUnitIds) return phanBoList;
    const permittedDnttIds = new Set(permittedDnttList.map(d => String(d.id)));
    return phanBoList.filter(pb => permittedDnttIds.has(String(pb.dntt_id)));
  }, [phanBoList, permittedDnttList, userPermittedUnitIds]);

  // Danh sách Thống kê chốt kỳ thuộc phạm vi phân quyền của tài khoản
  const permittedThongKeList = useMemo(() => {
    if (!userPermittedUnitIds) return thongKeList;
    return thongKeList.filter(tk => tk.id_don_vi && userPermittedUnitIds.has(String(tk.id_don_vi)));
  }, [thongKeList, userPermittedUnitIds]);

  // Tải dữ liệu toàn bộ module
  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [
        dvRes, pnRes, kmpRes, bpRes, dnttRes, ctRes, pbRes, ckRes, tkRes, ncpRes
      ] = await Promise.all([
        apiService.getDonVi ? apiService.getDonVi().catch(() => []) : Promise.resolve([]),
        apiService.getPhapNhan ? apiService.getPhapNhan().catch(() => []) : Promise.resolve([]),
        apiService.getDmKmp ? apiService.getDmKmp(true).catch(() => []) : Promise.resolve([]),
        apiService.getDmBoPhan ? apiService.getDmBoPhan(true).catch(() => []) : Promise.resolve([]),
        apiService.getDntt ? apiService.getDntt(true).catch(() => []) : Promise.resolve([]),
        apiService.getDnttChiTiet ? apiService.getDnttChiTiet(true).catch(() => []) : Promise.resolve([]),
        apiService.getDnttPhanBo ? apiService.getDnttPhanBo(true).catch(() => []) : Promise.resolve([]),
        apiService.getChiPhiChotKy ? apiService.getChiPhiChotKy().catch(() => []) : Promise.resolve([]),
        apiService.getChiPhiThongKe ? apiService.getChiPhiThongKe().catch(() => []) : Promise.resolve([]),
        apiService.getDmNhomChiPhi ? apiService.getDmNhomChiPhi().catch(() => []) : Promise.resolve([])
      ]);

      setDonViList(dvRes || []);
      setPhapNhanList(pnRes || []);
      setKmpList(kmpRes || []);
      setNhomChiPhiList(ncpRes || []);
      setBoPhanList(bpRes || []);
      setChotKyList(ckRes || []);
      setThongKeList(tkRes || []);

      // Tự động phân tách Cấp 1 & Cấp 2 từ dm_bo_phan đồng bộ tuyệt đối
      const cap1Seen = new Set<string>();
      const cap1ListDerived: BoPhanCap1[] = [];
      (bpRes || []).forEach(b => {
        if (b.ma_cap1 && !cap1Seen.has(b.ma_cap1)) {
          cap1Seen.add(b.ma_cap1);
          cap1ListDerived.push({
            id: b.ma_cap1,
            ma: b.ma_cap1,
            ten: b.ten_cap1,
            yeu_cau_cap2: b.yeu_cau_cap2,
            thu_tu: b.thu_tu || 0,
            active: b.active !== false
          });
        }
      });

      const cap2Seen = new Set<string>();
      const cap2ListDerived: BoPhanCap2[] = [];
      (bpRes || []).forEach(b => {
        if (b.ma_cap2 && !cap2Seen.has(b.ma_cap2)) {
          cap2Seen.add(b.ma_cap2);
          cap2ListDerived.push({
            id: b.ma_cap2,
            ma: b.ma_cap2,
            ten: b.ten_cap2,
            thu_tu: b.thu_tu || 0,
            active: b.active !== false
          });
        }
      });

      setCap1List(cap1ListDerived);
      setCap2List(cap2ListDerived);
      setDnttList(dnttRes || []);
      setChiTietList(ctRes || []);
      setPhanBoList(pbRes || []);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu Quản lý Chi phí:', err);
      toast.error('Không thể tải dữ liệu chi phí. Đang dùng dữ liệu offline!');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllData();
  }, []);

  // Đơn vị hiện tại đang chọn
  const currentUnitName = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') {
      return allUnitsLabel;
    }
    const found = costDonViList.find(d => String(d.id) === String(selectedUnitFilter));
    return found ? found.ten_don_vi : selectedUnitFilter;
  }, [selectedUnitFilter, costDonViList, allUnitsLabel]);

  // Số lượng DNTT đang hiển thị theo bộ lọc đơn vị đang chọn (tài khoản cấp đơn vị chỉ tính Đơn vị mẹ và đơn vị trực thuộc)
  const activeDnttCount = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') {
      return permittedDnttList.length;
    }
    const allowed = new Set([selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, donViList)]);
    return permittedDnttList.filter(d => {
      if (d.id_don_vi && allowed.has(String(d.id_don_vi))) return true;
      if (d.don_vi_hien_thi) {
        const target = donViList.find(u => String(u.id) === String(selectedUnitFilter));
        if (target?.ten_don_vi && d.don_vi_hien_thi.toLowerCase().includes(target.ten_don_vi.toLowerCase())) return true;
      }
      return false;
    }).length;
  }, [permittedDnttList, selectedUnitFilter, donViList]);

  // Thiết lập danh sách Tab
  const tabs = useMemo(() => [
    {
      id: 'dntt',
      label: 'Đề nghị thanh toán',
      icon: <FileText size={16} />,
      count: activeDnttCount
    },
    {
      id: 'thong_ke',
      label: 'Thống kê',
      icon: <BarChart2 size={16} />
    },
    {
      id: 'dashboard',
      label: 'Dashboard chi phí',
      icon: <BarChart3 size={16} />
    },
    {
      id: 'kmp',
      label: 'Cấu hình KMP',
      icon: <Tag size={16} />,
      count: kmpList.length
    },
    {
      id: 'admin',
      label: 'Quản trị và Pháp nhân',
      icon: <Building2 size={16} />
    }
  ], [activeDnttCount, kmpList.length]);

  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] dark:bg-slate-900 overflow-hidden relative font-sans">
      
      {/* Nút mở UnitFilterSidebar khi bị thu nhỏ */}
      {isListCollapsed && (
        <button
          onClick={() => setIsListCollapsed(false)}
          className="hidden md:block absolute top-5 left-5 z-50 bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 text-[#D97706] hover:bg-amber-50 transition-all cursor-pointer"
          title="Mở bộ lọc đơn vị"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

      {/* 1. BỘ LỌC ĐƠN VỊ DÙNG CHUNG CỦA QTVP-ASDS */}
      <UnitFilterSidebar
        donViList={costDonViList}
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
        allUnitsLabel={allUnitsLabel}
        searchPlaceholder="Tìm đơn vị quản trị..."
      />

      {/* 2. KHU VỰC NỘI DUNG CHÍNH */}
      <div className="flex-1 min-w-0 max-w-full overflow-hidden p-3 sm:p-5 relative transition-all duration-300 w-full flex flex-col">
        
        {/* Header Module Chuẩn 3 Dòng */}
        <div className="shrink-0 z-20 flex flex-col mb-4">
          
          {/* DÒNG 1 & DÒNG 2 */}
          <div className={`flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
            
            {/* Cột trái: Dòng 1 (Tiêu đề) & Dòng 2 (Đang xem) */}
            <div className="flex items-center gap-2.5">
              {isListCollapsed && (
                <button
                  onClick={() => setIsListCollapsed(false)}
                  className="md:hidden bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 text-[#D97706] hover:bg-amber-50 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                  title="Mở bộ lọc đơn vị"
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
              <div>
                <h2 className="text-2xl font-bold text-[#D97706] flex items-center gap-2">
                  <Wallet size={28} /> Quản lý Chi phí
                </h2>
                <p className="text-sm font-medium text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Đang xem: <span className="text-emerald-600 font-bold">{currentUnitName}</span> ({activeDnttCount} phiếu DNTT)</span>
                </p>
              </div>
            </div>

            {/* Cột phải: Cụm controls chuẩn (Ô tìm kiếm + Nút Refresh + Nút Tính năng) */}
            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto relative z-30">
              
              {/* 1. Ô tìm kiếm: 256 x 32 px, nền #FFFFF0 */}
              <div className="relative w-full sm:w-[256px] h-[32px] shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Tìm theo số phiếu, người đề nghị, nội dung..."
                  className="w-full sm:w-[256px] h-[32px] pl-8 pr-3 bg-[#FFFFF0] border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#D97706] focus:border-[#D97706] outline-none shadow-xs text-xs font-medium transition-all"
                  value={costSearchTerm}
                  onChange={(e) => setCostSearchTerm(e.target.value)}
                />
              </div>

              {/* 2. Nút Đồng bộ dữ liệu (24 x 24 px) */}
              <button
                type="button"
                onClick={() => {
                  loadAllData(true);
                  toast.success('Đang đồng bộ dữ liệu Chi phí mới nhất từ Supabase...');
                }}
                title="Đồng bộ / Tải lại dữ liệu mới nhất từ Supabase"
                disabled={loading}
                className="w-[24px] h-[24px] min-w-[24px] p-0 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 hover:text-[#D97706] rounded-md border border-gray-200 dark:border-slate-700 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <RotateCcw size={13} className={loading ? 'animate-spin text-[#D97706]' : ''} />
              </button>

              {/* 3. Nút Tính năng (119 x 32 px) - Màu Amber vàng đồng */}
              <div className="relative z-50">
                <button
                  type="button"
                  onClick={() => setIsFeaturesDropdownOpen(!isFeaturesDropdownOpen)}
                  className={`w-[119px] h-[32px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all shadow-xs whitespace-nowrap cursor-pointer shrink-0 ${
                    isFeaturesDropdownOpen
                      ? 'bg-gradient-to-r from-[#D97706] to-[#b45309] text-white border-[#D97706] shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-slate-700 hover:bg-gray-50 hover:text-[#D97706]'
                  }`}
                >
                  <Sparkles size={14} className={isFeaturesDropdownOpen ? 'text-amber-200 animate-pulse' : 'text-[#D97706]'} />
                  <span>Tính năng</span>
                  <ChevronDown size={12} className={`transition-transform duration-200 ${isFeaturesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFeaturesDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[40]" onClick={() => setIsFeaturesDropdownOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 p-2 z-[50] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('dntt');
                          setDnttCreateTrigger(Date.now());
                          setIsFeaturesDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-amber-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 hover:text-[#D97706] cursor-pointer"
                      >
                        <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-slate-700 text-[#D97706]">
                          <PlusCircle size={15} />
                        </div>
                        <div>
                          <div className="text-gray-800 dark:text-gray-100 font-bold text-xs">Lập ĐNTT mới</div>
                          <div className="text-[10px] text-gray-400 font-normal">Tạo phiếu đề nghị thanh toán</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('dashboard');
                          setIsFeaturesDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-blue-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 hover:text-blue-600 cursor-pointer"
                      >
                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-slate-700 text-blue-600">
                          <BarChart3 size={15} />
                        </div>
                        <div>
                          <div className="text-gray-800 dark:text-gray-100 font-bold text-xs">Dashboard phân tích</div>
                          <div className="text-[10px] text-gray-400 font-normal">Xem cơ cấu và biểu đồ chi phí</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('kmp');
                          setIsFeaturesDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-emerald-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 hover:text-emerald-600 cursor-pointer"
                      >
                        <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-slate-700 text-emerald-600">
                          <Tag size={15} />
                        </div>
                        <div>
                          <div className="text-gray-800 dark:text-gray-100 font-bold text-xs">Danh mục KMP</div>
                          <div className="text-[10px] text-gray-400 font-normal">Cấu hình mã B7, B10, Trọng yếu</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('admin');
                          setIsFeaturesDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-purple-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 hover:text-purple-600 cursor-pointer"
                      >
                        <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-slate-700 text-purple-600">
                          <Building2 size={15} />
                        </div>
                        <div>
                          <div className="text-gray-800 dark:text-gray-100 font-bold text-xs">Quản trị Khối &amp; Bộ phận</div>
                          <div className="text-[10px] text-gray-400 font-normal">Khối/Nghiệp vụ - Thương hiệu/Bộ phận</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* DÒNG 3: KHU VỰC TABS PHÂN CẤP LIỀN KHỐI (NESTED CONNECTED TABS) */}
          <div className={`w-full flex flex-col select-none shrink-0 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 transition-all duration-300 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
            {/* --- CẤP 1 --- */}
            <div className={`w-full bg-gray-100 dark:bg-slate-800 flex flex-wrap gap-1 pt-1 px-1 items-center transition-all duration-300 ${isLevel2Open ? 'pb-0 border-b-0' : 'pb-1'}`}>
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap outline-none border-none bg-transparent ${
                      isActive
                        ? `text-white font-black z-10 ${isLevel2Open ? 'pb-2.5 sm:pb-3' : ''}`
                        : 'text-gray-500 hover:text-[#D97706] dark:hover:text-amber-300 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-xl'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="costMainTabSlide"
                        className={`absolute inset-0 z-0 shadow-xs ${isLevel2Open ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'}`}
                        style={{ backgroundColor: '#D97706' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    {tab.icon && <span className="relative z-10 shrink-0 flex items-center">{tab.icon}</span>}
                    <span className="relative z-10">{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* --- CẤP 2 (Mở khi chọn Quản trị và Pháp nhân HOẶC Thống kê) --- */}
            <AnimatePresence initial={false}>
              {isLevel2Open && (
                <motion.div
                  key={`level2-${activeTab}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden bg-[#D97706] dark:bg-[#b45309]"
                >
                  {activeTab === 'thong_ke' && (
                    <div className="w-full flex flex-wrap gap-3 px-4 py-1.5 items-center transition-all duration-300">
                      {[
                        { id: 'phan_tich', label: 'Phân tích & Đối sánh', icon: <BarChart2 className="w-4 h-4" /> },
                        { id: 'quan_tri', label: 'Quản trị Chi phí', icon: <FileSpreadsheet className="w-4 h-4" /> }
                      ].map(st => {
                        const isSubActive = activeThongKeSubTab === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setActiveThongKeSubTab(st.id as any)}
                            className={`relative py-1.5 px-4 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer rounded-lg bg-transparent ${
                              isSubActive
                                ? 'text-white font-black'
                                : 'text-white/80 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {isSubActive && (
                              <motion.div
                                layoutId="costThongKeSubTabSlide"
                                className="absolute inset-0 bg-amber-800 dark:bg-amber-950 rounded-lg shadow-sm ring-1 ring-amber-400/30 z-0"
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            <span className="relative z-10 flex items-center gap-1.5">
                              {st.icon}
                              <span>{st.label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === 'admin' && (
                    <div className="w-full flex flex-wrap gap-4 px-4 py-1.5 items-center transition-all duration-300">
                      {[
                        { id: 'bophan', label: 'Danh mục Bộ phận', icon: <Layers className="w-4 h-4" />, count: boPhanList.length > 0 ? boPhanList.length : 16 },
                        { id: 'phapnhan', label: 'Pháp nhân & Showroom', icon: <Building2 className="w-4 h-4" />, count: phapNhanList.length }
                      ].map(st => {
                        const isSubActive = activeAdminSubTab === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setActiveAdminSubTab(st.id as any)}
                            className={`relative py-1.5 px-4 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer rounded-lg bg-transparent ${
                              isSubActive
                                ? 'text-white font-black'
                                : 'text-white/80 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {isSubActive && (
                              <motion.div
                                layoutId="costAdminSubTabSlide"
                                className="absolute inset-0 bg-amber-800 dark:bg-amber-950 rounded-lg shadow-sm ring-1 ring-amber-400/30 z-0"
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            <span className="relative z-10 flex items-center gap-1.5">
                              {st.icon}
                              <span>{st.label}</span>
                            </span>
                            <span className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isSubActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>
                              {st.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Nội dung Tab */}
        <div className="flex-1 min-h-0 relative">
          {loading ? (
            <div className="h-full flex items-center justify-center flex-col gap-2 text-gray-400">
              <Loader2 size={32} className="animate-spin text-[#D97706]" />
              <span className="text-xs font-semibold">Đang tải dữ liệu chi phí...</span>
            </div>
          ) : (
            <>
              {activeTab === 'dntt' && (
                <DnttTab
                  dnttList={permittedDnttList}
                  chiTietList={chiTietList}
                  phanBoList={phanBoList}
                  kmpList={kmpList}
                  boPhanList={boPhanList}
                  cap1List={cap1List}
                  cap2List={cap2List}
                  donViList={costDonViList}
                  allDonViList={donViList}
                  phapNhanList={phapNhanList}
                  chotKyList={chotKyList}
                  selectedUnitFilter={selectedUnitFilter}
                  onRefresh={() => loadAllData(true)}
                  loading={loading}
                  externalSearchTerm={costSearchTerm}
                  createTrigger={dnttCreateTrigger}
                />
              )}

              {activeTab === 'thong_ke' && (
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-3 sm:p-4">
                  <CostStatisticsTab
                    thongKeList={permittedThongKeList}
                    chotKyList={chotKyList}
                    dnttList={permittedDnttList}
                    phanBoList={permittedPhanBoList}
                    kmpList={kmpList}
                    nhomChiPhiList={nhomChiPhiList}
                    boPhanList={boPhanList}
                    cap1List={cap1List}
                    cap2List={cap2List}
                    donViList={costDonViList}
                    fullDonViList={donViList}
                    phapNhanList={phapNhanList}
                    selectedUnitFilter={selectedUnitFilter}
                    onRefresh={() => loadAllData(true)}
                    loading={loading}
                    activeSubTab={activeThongKeSubTab}
                    onSubTabChange={setActiveThongKeSubTab}
                  />
                </div>
              )}

              {activeTab === 'dashboard' && (
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                  <CostDashboardTab
                    dnttList={permittedDnttList}
                    phanBoList={permittedPhanBoList}
                    kmpList={kmpList}
                    boPhanList={boPhanList}
                    cap1List={cap1List}
                    cap2List={cap2List}
                    donViList={costDonViList}
                    selectedUnitFilter={selectedUnitFilter}
                    onRefresh={() => loadAllData(true)}
                    loading={loading}
                  />
                </div>
              )}

              {activeTab === 'kmp' && (
                <KmpConfigTab
                  kmpList={kmpList}
                  onRefresh={() => loadAllData(true)}
                  loading={loading}
                />
              )}

              {activeTab === 'admin' && (
                <AdminLegalTab
                  boPhanList={boPhanList}
                  cap1List={cap1List}
                  cap2List={cap2List}
                  donViList={costDonViList}
                  allDonViList={donViList}
                  phapNhanList={phapNhanList}
                  selectedUnitFilter={selectedUnitFilter}
                  onRefresh={() => loadAllData(true)}
                  loading={loading}
                  activeSubTab={activeAdminSubTab}
                  setActiveSubTab={setActiveAdminSubTab}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
