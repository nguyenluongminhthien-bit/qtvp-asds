import React, { useState, useEffect, useMemo } from 'react';
import { 
  HardHat, Search, Edit, Trash2, AlertCircle, Loader2, ShieldCheck, 
  Building2, MapPin, PanelLeftClose, PanelLeftOpen, ChevronRight, ChevronDown, Plus,
  FileText, Users, Settings, Link as LinkIcon, CheckCircle2, XCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from '../utils/toast';
import AtvsldModal from '../components/department/AtvsldModal';
import { useAuth } from '../contexts/AuthContext';
import { DonVi } from '../types';
import { groupParentUnits, sortDonViByThuTu, getUnitEmoji } from '../utils/hierarchy';

export default function AtvsldPage() {
  const { user } = useAuth(); 

  const [donViData, setDonViList] = useState<DonVi[]>([]);
  const [atvsldData, setAtvsldData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [expandedParents, setExpandedParents] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentData, setCurrentData] = useState<any | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dvResult, atResult] = await Promise.all([
        apiService.getDonVi(),
        apiService.getATVSLD ? apiService.getATVSLD().catch(() => []) : Promise.resolve([])
      ]);
      setDonViList(dvResult || []);
      setAtvsldData(atResult || []);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu ATVSLĐ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViData.forEach(dv => { map[String(dv.id)] = dv.ten_don_vi; });
    return map;
  }, [donViData]);

  const allowedDonViIds = useMemo(() => {
    if (!user) return [];
    const userIdDonVi = user.id_don_vi || (user as any).idDonVi;
    if (userIdDonVi === 'ALL' || String(user.quyen).toLowerCase() === 'admin') return donViData.map(dv => dv.id);
    
    const level1 = [userIdDonVi];
    const level2 = donViData.filter(dv => level1.includes(dv.cap_quan_ly || '')).map(dv => dv.id);
    const level3 = donViData.filter(dv => level2.includes(dv.cap_quan_ly || '')).map(dv => dv.id);
    const allAllowed = [...level1, ...level2, ...level3];
    return donViData.filter(dv => allAllowed.includes(dv.id)).map(dv => dv.id);
  }, [user, donViData]);

  const filteredUnits = useMemo(() => {
    let baseUnits = donViData.filter(dv => allowedDonViIds.includes(dv.id));
    if (!unitSearchTerm) return baseUnits;
    const lower = unitSearchTerm.toLowerCase();
    const matchedIds = new Set<string>();

    baseUnits.forEach(u => {
      if (String(u.ten_don_vi || '').toLowerCase().includes(lower) || String(u.id || '').toLowerCase().includes(lower)) {
        matchedIds.add(u.id);
        let parentId = u.cap_quan_ly;
        while (parentId && parentId !== 'HO') {
          matchedIds.add(parentId);
          const parentUnit = baseUnits.find(p => p.id === parentId);
          parentId = parentUnit ? parentUnit.cap_quan_ly : null;
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
  }, [donViData, unitSearchTerm, allowedDonViIds]);

  const parentUnits = useMemo(() => filteredUnits.filter(item => item.cap_quan_ly === 'HO' || !item.cap_quan_ly), [filteredUnits]);
  const getChildUnits = (parentId: string) => sortDonViByThuTu(filteredUnits.filter(item => item.cap_quan_ly === parentId));

  const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = useMemo(() => {
    return groupParentUnits(parentUnits);
  }, [parentUnits]);

  const toggleParent = (parentId: string) => {
    setExpandedParents(prev => prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]);
  };

  const getAllSubordinateIds = (unitId: string, allUnits: DonVi[]): string[] => {
    const subordinates = allUnits.filter(u => u.cap_quan_ly === unitId);
    let ids = subordinates.map(u => u.id);
    subordinates.forEach(sub => { ids = [...ids, ...getAllSubordinateIds(sub.id, allUnits)]; });
    return ids;
  };

  const selectedUnitSubordinates = useMemo(() => {
    if (!selectedUnitFilter) return [];
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViData);
    return [selectedUnitFilter, ...subIds];
  }, [selectedUnitFilter, donViData]);

  const filteredData = useMemo(() => {
    return atvsldData.filter(item => {
      if (!allowedDonViIds.includes(item.id_don_vi)) return false;
      if (selectedUnitFilter && !selectedUnitSubordinates.includes(item.id_don_vi)) return false;
      const dvName = donViMap[item.id_don_vi] || '';
      const searchStr = `${dvName} ${item.nguoi_phu_trach || ''} ${item.id_don_vi}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });
  }, [atvsldData, donViMap, searchTerm, selectedUnitFilter, selectedUnitSubordinates, allowedDonViIds]);

  const selectedUnitName = useMemo(() => {
    if (!selectedUnitFilter) return 'Tất cả Đơn vị';
    const unit = donViData.find(d => d.id === selectedUnitFilter);
    return unit ? unit.ten_don_vi : 'Đơn vị không xác định';
  }, [selectedUnitFilter, donViData]);

  const stats = useMemo(() => {
    let totalThietBi = 0, totalLoi = 0, totalTaiNan = 0, totalNhanSuHL = 0;
    filteredData.forEach(item => {
      totalThietBi += Number(item.so_luong_thiet_bi_nghiem_ngat) || 0;
      totalLoi += Number(item.so_luong_thiet_bi_qua_han_kt) || 0;
      totalTaiNan += Number(item.so_tai_nan_trong_nam) || 0;
      if (item.thong_ke_hl) {
        let hlStats = item.thong_ke_hl;
        if (typeof hlStats === 'string') {
          try { hlStats = JSON.parse(hlStats); } catch (e) { hlStats = null; }
        }
        if (hlStats) {
          ['1', '2', '3', '4', '6'].forEach(nhom => {
            if (hlStats[nhom]) totalNhanSuHL += (hlStats[nhom].total || 0);
          });
        }
      }
    });
    return { totalThietBi, totalLoi, totalTaiNan, totalNhanSuHL };
  }, [filteredData]);

  const openModal = (unitId: string, data: any = null) => {
    setSelectedUnitId(unitId);
    setCurrentData(data);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hồ sơ này?')) return;
    try {
      await apiService.delete(id, 'hs_an_toan_lao_dong');
      setAtvsldData(prev => prev.filter(item => item.id !== id));
      toast.success('Đã xóa hồ sơ!');
    } catch (err) {
      toast.error('Lỗi khi xóa hồ sơ.');
    }
  };

  const renderUnitTree = (parent: DonVi, level: number = 1) => {
    const children = getChildUnits(parent.id);
    const isExpanded = expandedParents.includes(parent.id) || !!unitSearchTerm;
    const isParentDimmed = parent.trang_thai === 'Đại lý' || parent.trang_thai === 'Đầu tư mới';

    return (
      <div key={parent.id} className={level === 1 ? "mb-1" : "mt-1"}>
        <button 
          onClick={() => { setSelectedUnitFilter(parent.id); if (children.length > 0) toggleParent(parent.id); }} 
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedUnitFilter === parent.id ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-50'} ${isParentDimmed ? 'opacity-50' : ''}`}
        >
          {children.length > 0 ? (isExpanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />) : <div className="w-4 shrink-0" />}
          <span className="shrink-0">{getUnitEmoji(parent.loai_hinh)}</span>
          <span className="truncate text-left">{parent.ten_don_vi}</span>
        </button>
        {isExpanded && children.length > 0 && (
          <div className={`mt-1 border-l-2 border-gray-100 pl-2 space-y-1 ${level === 1 ? 'ml-6' : 'ml-4'}`}>
            {children.map(child => renderUnitTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  return (
    <div className="flex h-full bg-[#f4f7f9] overflow-hidden relative">
      
      {isListCollapsed && (
        <button onClick={() => setIsListCollapsed(false)} className="absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-emerald-700 hover:bg-emerald-50 transition-all" title="Mở bộ lọc đơn vị">
          <PanelLeftOpen size={20} />
        </button>
      )}

      {/* CỘT TRÁI: BỘ LỌC */}
      <div className={`${isListCollapsed ? 'w-0 opacity-0 -ml-80 lg:ml-0' : 'w-80 opacity-100 absolute lg:relative inset-y-0 left-0'} transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col h-full shadow-2xl lg:shadow-sm z-50 lg:z-10 shrink-0 overflow-hidden`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-emerald-700 flex items-center gap-2 whitespace-nowrap"><MapPin size={20} /> Bộ lọc Đơn vị</h2>
            <button onClick={() => setIsListCollapsed(true)} className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"><PanelLeftClose size={18} /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Tìm tên showroom..." className="w-full pl-9 pr-4 py-2 bg-[#FFFFF0] border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={unitSearchTerm} onChange={(e) => setUnitSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-w-[319px] custom-scrollbar">
          <button onClick={() => { setSelectedUnitFilter(null); if(window.innerWidth < 1024) setIsListCollapsed(true); }} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold mb-4 transition-colors ${selectedUnitFilter === null ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-gray-700 hover:bg-gray-50'}`}>
            <Building2 size={18} className={selectedUnitFilter === null ? 'text-emerald-700' : 'text-gray-400'} /> Tất cả Cơ sở Toàn quốc
          </button>
          <hr className="border-gray-100 mb-4 mx-2"/>

          {parentUnits.length === 0 ? (
            <div className="text-center p-4 text-sm text-gray-500">Không tìm thấy đơn vị.</div>
          ) : (
            <>
              {vpdhUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-2">VPĐH</p>{vpdhUnits.map(dv => renderUnitTree(dv, 1))}</div>)}
              {ctttNamUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-2">CTTT Phía Nam</p>{ctttNamUnits.map(dv => renderUnitTree(dv, 1))}</div>)}
              {ctttBacUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-2">CTTT Phía Bắc</p>{ctttBacUnits.map(dv => renderUnitTree(dv, 1))}</div>)}
              {otherUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Đơn vị khác</p>{otherUnits.map(dv => renderUnitTree(dv, 1))}</div>)}
            </>
          )}
        </div>
      </div>

      {/* CỘT PHẢI: NỘI DUNG CHÍNH */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative transition-all duration-300 custom-scrollbar">
        <div className={`flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'pl-10 lg:pl-12' : ''}`}>
          <div>
            <h2 className="text-2xl font-black text-emerald-700 flex items-center gap-2"><HardHat size={28} /> Quản lý Hồ sơ ATVSLĐ</h2>
            <p className="text-sm font-medium text-gray-500 mt-1">Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({filteredData.length} cơ sở khai báo)</p>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full xl:w-auto">
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Tìm phụ trách, cơ sở..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              
              {user?.quyen === 'ADMIN' && (
                <button onClick={() => openModal(selectedUnitFilter || '')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap"><Plus className="w-5 h-5" /> Thêm Hồ sơ</button>
              )}
            </div>
          </div>
        </div>

        <div className={`transition-all duration-300 ${isListCollapsed ? 'ml-10 lg:ml-0' : ''}`}>
          <div className="max-w-[1400px] mx-auto space-y-6">
            
            {/* THẺ TỔNG QUAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Building2 size={20}/></div>
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">Cơ sở khai báo</p><p className="text-xl font-black text-emerald-700">{filteredData.length}</p></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><ShieldCheck size={20}/></div>
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">Nhân sự Huấn Luyện</p><p className="text-xl font-black text-emerald-700">{stats.totalNhanSuHL}</p></div>
              </div>
              <div className={`bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4 transition-all hover:shadow-md ${stats.totalLoi > 0 ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${stats.totalLoi > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}><AlertCircle size={20}/></div>
                <div><p className={`text-[10px] font-bold uppercase ${stats.totalLoi > 0 ? 'text-orange-600' : 'text-gray-500'}`}>TB Nghiêm ngặt (Quá hạn)</p><p className={`text-xl font-black ${stats.totalLoi > 0 ? 'text-orange-700' : 'text-gray-700'}`}>{stats.totalThietBi} <span className="text-xs text-red-500 font-bold">{stats.totalLoi > 0 ? `(${stats.totalLoi} Lỗi)` : ''}</span></p></div>
              </div>
              <div className={`bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4 transition-all hover:shadow-md ${stats.totalTaiNan > 0 ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${stats.totalTaiNan > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}><HardHat size={20}/></div>
                <div><p className={`text-[10px] font-bold uppercase ${stats.totalTaiNan > 0 ? 'text-red-600' : 'text-gray-500'}`}>Tai nạn LĐ (Năm)</p><p className={`text-xl font-black ${stats.totalTaiNan > 0 ? 'text-red-700' : 'text-gray-700'}`}>{stats.totalTaiNan} Vụ</p></div>
              </div>
            </div>

            {/* 🟢 DANH SÁCH CHI TIẾT DẠNG THẺ (CARD LAYOUT) */}
            {filteredData.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
                <Search size={48} className="mx-auto mb-4 text-gray-300"/>
                <p className="text-lg font-medium text-gray-500">Không tìm thấy hồ sơ an toàn lao động.</p>
                {user?.quyen === 'ADMIN' && <p className="text-sm mt-1">Bấm nút "Thêm Hồ sơ" để tạo mới.</p>}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredData.map(item => {
                  // Phân tích dữ liệu JSON cho bảng nhóm
                  let hlStats: Record<string, {total: number, dat: number, khong_dat: number}> | null = null;
                  if (item.thong_ke_hl) {
                    try { hlStats = typeof item.thong_ke_hl === 'string' ? JSON.parse(item.thong_ke_hl) : item.thong_ke_hl; } 
                    catch (e) {}
                  }

                  let sumTotal = 0, sumDat = 0, sumKhongDat = 0;
                  const activeGroups: any[] = [];
                  ['1', '2', '3', '4', '6'].forEach(g => {
                    if (hlStats && hlStats[g] && hlStats[g].total > 0) {
                      sumTotal += hlStats[g].total;
                      sumDat += hlStats[g].dat;
                      sumKhongDat += hlStats[g].khong_dat;
                      activeGroups.push({ nhom: `Nhóm ${g}`, ...hlStats[g] });
                    }
                  });

                  return (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden hover:shadow-md transition-shadow">
                      
                      {/* Card Header */}
                      <div className="bg-emerald-50/70 border-b border-emerald-100 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0 border border-emerald-200">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-emerald-800 tracking-wide uppercase">{donViMap[String(item.id_don_vi)] || item.id_don_vi}</h3>
                            <p className="text-[11px] font-bold text-emerald-600/70 uppercase">MÃ HỒ SƠ: {item.id}</p>
                          </div>
                        </div>
                        
                        {user?.quyen === 'ADMIN' && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => openModal(item.id_don_vi, item)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"><Edit size={14}/> Sửa</button>
                            <button onClick={() => handleDelete(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm"><Trash2 size={14}/> Xóa</button>
                          </div>
                        )}
                      </div>

                      <div className="p-5 sm:p-6 space-y-6">
                        {/* SECTION 1: HUẤN LUYỆN */}
                        <div className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm">
                          <div className="p-4 bg-white border-b border-gray-100">
                            <p className="text-sm font-bold text-gray-800 mb-1 leading-relaxed">
                              {item.can_cu_quyet_dinh || 'Chưa cập nhật Quyết định Huấn luyện'}
                            </p>
                            <p className="text-[13px] font-semibold text-emerald-600 flex items-center gap-1.5">
                              <ShieldCheck size={16}/> Khoá huấn luyện: {item.khoa_huan_luyen_tu ? new Date(item.khoa_huan_luyen_tu).toLocaleDateString('vi-VN') : '---'} - {item.khoa_huan_luyen_den ? new Date(item.khoa_huan_luyen_den).toLocaleDateString('vi-VN') : '---'}
                            </p>
                          </div>
                          
                          {/* 3 Summary Boxes */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-gray-100 bg-gray-50/50">
                            <div className="p-4 text-center border-b md:border-b-0 md:border-r border-gray-100">
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TỔNG SỐ NGƯỜI</p>
                              <p className="text-3xl font-black text-blue-700">{sumTotal}</p>
                            </div>
                            <div className="p-4 text-center border-b md:border-b-0 md:border-r border-gray-100">
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">ĐẠT YÊU CẦU</p>
                              <p className="text-3xl font-black text-emerald-600">{sumDat}</p>
                            </div>
                            <div className="p-4 text-center">
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">KHÔNG ĐẠT</p>
                              <p className={`text-3xl font-black ${sumKhongDat > 0 ? 'text-red-600' : 'text-gray-400'}`}>{sumKhongDat}</p>
                            </div>
                          </div>

                          {/* Table Detail */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-center text-sm">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  <th className="p-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nhóm</th>
                                  <th className="p-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Số lượng</th>
                                  <th className="p-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tỉ lệ (%)</th>
                                  <th className="p-3 text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Đạt (SL & %)</th>
                                  <th className="p-3 text-[11px] font-bold text-red-500 uppercase tracking-wider">Không đạt (SL & %)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {activeGroups.map((g, idx) => {
                                  const pctNhom = sumTotal > 0 ? ((g.total / sumTotal) * 100).toFixed(2) : 0;
                                  const pctDat = g.total > 0 ? ((g.dat / g.total) * 100).toFixed(0) : 0;
                                  const pctKhongDat = g.total > 0 ? ((g.khong_dat / g.total) * 100).toFixed(0) : 0;
                                  return (
                                    <tr key={idx} className="hover:bg-gray-50/50">
                                      <td className="p-3 font-bold text-[#05469B]">{g.nhom}</td>
                                      <td className="p-3 font-semibold text-gray-700">{g.total}</td>
                                      <td className="p-3 font-semibold text-gray-700">{pctNhom}%</td>
                                      <td className="p-3 font-bold text-emerald-600">{g.dat} <span className="text-xs text-gray-400 font-medium">({pctDat}%)</span></td>
                                      <td className={`p-3 font-bold ${g.khong_dat > 0 ? 'text-red-500' : 'text-gray-400'}`}>{g.khong_dat} <span className="text-xs text-gray-300 font-medium">({pctKhongDat}%)</span></td>
                                    </tr>
                                  );
                                })}
                                {activeGroups.length > 0 && (
                                  <tr className="bg-gray-50/80 border-t-2 border-gray-200">
                                    <td className="p-3 font-black text-gray-800 uppercase">TỔNG CỘNG</td>
                                    <td className="p-3 font-black text-blue-700">{sumTotal}</td>
                                    <td className="p-3 font-black text-blue-700">{sumTotal > 0 ? '100' : '0'}%</td>
                                    <td className="p-3 font-black text-emerald-600">{sumDat} <span className="text-xs text-gray-500">({sumTotal > 0 ? Math.round((sumDat/sumTotal)*100) : 0}%)</span></td>
                                    <td className={`p-3 font-black ${sumKhongDat > 0 ? 'text-red-500' : 'text-gray-500'}`}>{sumKhongDat} <span className="text-xs text-gray-400">({sumTotal > 0 ? Math.round((sumKhongDat/sumTotal)*100) : 0}%)</span></td>
                                  </tr>
                                )}
                                {activeGroups.length === 0 && (
                                  <tr><td colSpan={5} className="p-6 text-gray-400 italic">Chưa có số liệu huấn luyện</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                            <p className="text-[13px] font-semibold text-gray-600 flex items-center gap-2">
                              Tỷ lệ hoàn thành HL Chung: <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-black rounded-md">{item.ty_le_hoan_thanh_hl || '0%'}</span>
                            </p>
                            {item.link_ho_so_quy_dinh ? (
                              <a href={item.link_ho_so_quy_dinh} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-[#05469B] flex items-center gap-1.5 hover:underline">
                                <LinkIcon size={14}/> Xem Hồ sơ gốc
                              </a>
                            ) : (
                              <span className="text-[12px] text-gray-400 italic flex items-center gap-1"><LinkIcon size={12}/> Chưa có Link Hồ sơ gốc</span>
                            )}
                          </div>
                        </div>

                        {/* SECTION 2 & 3: GRID 2 CỘT */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* 2. Tổ chức & Y tế */}
                          <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm">
                            <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-blue-100 pb-2">
                              <Users size={18} className="text-blue-500"/> 2. Tổ chức & Y tế
                            </h4>
                            <div className="space-y-3 text-[13px]">
                              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Phụ trách ATVSLĐ:</span>
                                <span className="font-bold text-[#05469B]">{item.nguoi_phu_trach || '---'}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Mạng lưới ATVS Viên:</span>
                                <span className="font-bold text-gray-800">{item.so_luong_mang_luoi || '0'} Người</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Khám SK / Bệnh nghề nghiệp:</span>
                                <span className="font-bold text-gray-800">
                                  {item.ngay_ksk ? new Date(item.ngay_ksk).toLocaleDateString('vi-VN') : '---'} / {item.ngay_kham_bnn ? new Date(item.ngay_kham_bnn).toLocaleDateString('vi-VN') : '---'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">Cấp phát BHLĐ:</span>
                                <span className={`font-bold ${item.ty_le_cap_bhld === 'Đầy đủ' ? 'text-emerald-600' : 'text-orange-500'}`}>{item.ty_le_cap_bhld || '---'}</span>
                              </div>
                            </div>
                          </div>

                          {/* 3. Máy móc & Hiện trường */}
                          <div className="bg-white border border-red-100 rounded-xl p-5 shadow-sm">
                            <h4 className="font-bold text-red-700 text-sm uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-red-100 pb-2">
                              <Settings size={18} className="text-red-500"/> 3. Máy móc & Hiện trường
                            </h4>
                            <div className="space-y-3 text-[13px]">
                              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Đo kiểm Môi trường:</span>
                                <span className="font-bold text-gray-800">{item.ngay_quan_trac_mt ? new Date(item.ngay_quan_trac_mt).toLocaleDateString('vi-VN') : 'Chưa đo'}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">TB Nghiêm ngặt (Tổng / Quá hạn):</span>
                                <span className="font-black text-gray-800">
                                  {item.so_luong_thiet_bi_nghiem_ngat || '0'} / <span className={Number(item.so_luong_thiet_bi_qua_han_kt) > 0 ? 'text-red-600' : 'text-emerald-600'}>{item.so_luong_thiet_bi_qua_han_kt || '0'}</span>
                                </span>
                              </div>
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-gray-500 font-medium">Số vụ Tai nạn (Năm):</span>
                                <span className={`font-black ${Number(item.so_tai_nan_trong_nam) > 0 ? 'text-red-600' : 'text-gray-800'}`}>{item.so_tai_nan_trong_nam || '0'} Vụ</span>
                              </div>
                              
                              <div className="pt-2">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">TUẦN TRA & LỖI HIỆN TRƯỜNG:</span>
                                {item.cac_loi_hien_truong ? (
                                  <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-medium flex items-start gap-2">
                                    <XCircle size={14} className="shrink-0 mt-0.5 text-red-500"/>
                                    <span className="leading-relaxed">{item.cac_loi_hien_truong}</span>
                                  </div>
                                ) : (
                                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-emerald-500"/> 
                                    Không có lỗi / Đã xử lý (Kiểm tra: {item.ngay_tu_kiem_tra ? new Date(item.ngay_tu_kiem_tra).toLocaleDateString('vi-VN') : '---'})
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
          </div>
        </div>
      </div>

      <AtvsldModal
        isOpen={isModalOpen}
        currentData={currentData}
        selectedUnitId={selectedUnitId}
        onSaved={(data, isCreate) => {
          if (isCreate) setAtvsldData(prev => [data, ...prev]);
          else setAtvsldData(prev => prev.map(item => item.id === data.id ? data : item));
        }}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}