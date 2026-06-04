import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits } from '../utils/hierarchy';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, 
  FileText, Building2, MapPin, ChevronDown, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Link as LinkIcon, Calendar, CheckCircle2, Bookmark, Eye, Lock, Zap, Clock, Send,
  PenTool, Hash, Briefcase, Layers, ExternalLink
} from 'lucide-react';
import { apiService } from '../services/api';
import { DonVi, VB_TB } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';

// HÀM KIỂM TRA VĂN BẢN MẬT
const isMatDocument = (val: any) => {
  if (val === true || val === 'TRUE' || val === 'true' || val === 'Có' || String(val).trim() === '1') return true;
  return false;
};

// HÀM LẤY NHÃN HIỂN THỊ ĐỘNG CHO NƠI GỬI/NHẬN
const getNoiGuiNhanLabel = (phanLoai: string) => {
  switch(phanLoai) {
    case 'Công văn đến': return 'Cơ quan / Đơn vị gửi đến';
    case 'Công văn đi': return 'Nơi nhận (Kính gửi / Đồng kính gửi)';
    case 'Quyết định': return 'Đơn vị / Cá nhân nhận Quyết định';
    case 'Tờ trình': return 'Kính gửi (Nơi nhận Tờ trình)';
    case 'Thông báo': return 'Nơi nhận Thông báo';
    default: return 'Nơi nhận / Gửi';
  }
};

// COMPONENT AUTOCOMPLETE TÙY CHỈNH (HỖ TRỢ NÚT XÓA)
const CustomAutocomplete = ({ name, value, onChange, placeholder, suggestions, onRemove, className }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = suggestions.filter((s: string) => s.toLowerCase().includes((value || '').toLowerCase()));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        name={name}
        value={value || ''}
        onChange={(e) => { onChange(e); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto custom-scrollbar">
          {filtered.map((item: string) => (
            <li
              key={item}
              className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center group text-sm text-gray-700 border-b border-gray-50 last:border-0"
              onClick={() => {
                onChange({ target: { name, value: item } });
                setIsOpen(false);
              }}
            >
              <span className="truncate pr-2">{item}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item);
                }}
                className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="Xóa khỏi danh sách gợi ý"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default function DocumentPage() {
  const { user } = useAuth();
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [vbData, setVbData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layout & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [selectedPhanLoai, setSelectedPhanLoai] = useState<string | null>('Thông báo');
  const [selectedYear, setSelectedYear] = useState<string>('all'); 
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update'>('create');
  const [formData, setFormData] = useState<any>({});
  
  // View Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<any | null>(null);

  // Delete Confirm
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // --- STATE LƯU TRỮ DANH SÁCH BỊ XÓA GỢI Ý ---
  const [blacklist, setBlacklist] = useState<string[]>(() => {
    const saved = localStorage.getItem('doc_suggestions_blacklist');
    return saved ? JSON.parse(saved) : [
      'Phạm Đăng Châu',
      'Đàm Đình Thông',
      'Nguyễn Thiện Mỹ'
    ];
  });

  const handleRemoveSuggestion = (item: string) => {
    if (window.confirm(`Bạn có chắc muốn ẩn "${item}" khỏi danh sách gợi ý vĩnh viễn?`)) {
      const next = [...blacklist, item];
      setBlacklist(next);
      localStorage.setItem('doc_suggestions_blacklist', JSON.stringify(next));
    }
  };

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [dvResult, vbResult] = await Promise.all([
        apiService.getDonVi(),
        apiService.getVanBan()
      ]);
      setDonViList(dvResult || []);
      setVbData(vbResult || []);
    } catch (err: any) { 
      setError(err.message || 'Lỗi tải dữ liệu Văn bản.'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[String(dv.id)] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  // PHÂN QUYỀN HIỂN THỊ VĂN BẢN
  const visibleDocuments = useMemo(() => {
    if (!user) return [];
    const userIdDonVi = user.id_don_vi || (user as any).idDonVi;

    if (userIdDonVi === 'ALL' || String(user.quyen).toLowerCase() === 'admin') return vbData;
    
    const level1 = [userIdDonVi];
    const level2 = donViList.filter(dv => level1.includes(dv.cap_quan_ly)).map(dv => dv.id);
    const level3 = donViList.filter(dv => level2.includes(dv.cap_quan_ly)).map(dv => dv.id);
    const myUnits = [...level1, ...level2, ...level3];
    
    return vbData.filter(vb => {
      return myUnits.includes(vb.id_don_vi) || 
             myUnits.includes(vb.pham_vi_ap_dung) || 
             vb.pham_vi_ap_dung === 'Toàn hệ thống';
    });
  }, [vbData, user, donViList]);

  // TẠO DANH SÁCH GỢI Ý TỪ LỊCH SỬ NHẬP LIỆU (ĐÃ LỌC BLACKLIST ĐỂ XÓA)
  const { suggestNguoiky, suggestChucvu, suggestNguoilayso, suggestBPlayso, suggestNghiepvu, suggestDonViXuLy } = useMemo(() => {
    const getUnique = (field: string) => {
      const allValues = vbData.map(item => item[field]).filter(Boolean);
      const uniqueValues = Array.from(new Set(allValues)) as string[];
      return uniqueValues.filter(val => !blacklist.includes(val.trim()));
    };

    return {
      suggestNguoiky: getUnique('nguoi_ky'),
      suggestChucvu: getUnique('chuc_vu'),
      suggestNguoilayso: getUnique('nguoi_lay_so'),
      suggestBPlayso: getUnique('bo_phan_lay_so'),
      suggestNghiepvu: getUnique('nghiep_vu'),
      suggestDonViXuLy: getUnique('bo_phan_xu_ly')
    };
  }, [vbData, blacklist]);

  // LỌC VÀ TẠO CÂY ĐƠN VỊ BÊN TRÁI
  const allowedDonViIds = useMemo(() => {
    if (!user) return [];
    const userIdDonVi = user.id_don_vi || (user as any).idDonVi;

    if (userIdDonVi === 'ALL' || String(user.quyen).toLowerCase() === 'admin') return donViList.map(dv => dv.id);
    
    const level1 = [userIdDonVi];
    const level2 = donViList.filter(dv => level1.includes(dv.cap_quan_ly)).map(dv => dv.id);
    const level3 = donViList.filter(dv => level2.includes(dv.cap_quan_ly)).map(dv => dv.id);
    const allAllowed = [...level1, ...level2, ...level3];
    
    return donViList.filter(dv => allAllowed.includes(dv.id)).map(dv => dv.id);
  }, [user, donViList]);

  // FIX TÌM KIẾM CÂY THƯ MỤC CỰC THÔNG MINH
  const filteredUnits = useMemo(() => {
    let baseUnits = donViList.filter(dv => allowedDonViIds.includes(dv.id));
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
    
    const initialMatches = Array.from(matchedIds);
    initialMatches.forEach(id => addChildren(id));

    return baseUnits.filter(item => matchedIds.has(item.id));
  }, [donViList, unitSearchTerm, allowedDonViIds]);

  const parentUnits = useMemo(() => filteredUnits.filter(item => item.cap_quan_ly === 'HO' || !item.cap_quan_ly), [filteredUnits]);
  
  const getChildUnits = (parentId: string) => sortDonViByThuTu(filteredUnits.filter(item => item.cap_quan_ly === parentId));

  const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = useMemo(() => {
    return groupParentUnits(parentUnits);
  }, [parentUnits]);

  const toggleParent = (parentId: string) => {
    setExpandedParents(prev => prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]);
  };

  const availableYears = useMemo(() => {
    const years = new Set(
      visibleDocuments.map(item => {
        if (!item.ngay_ban_hanh) return null;
        return new Date(item.ngay_ban_hanh).getFullYear().toString();
      }).filter(Boolean) as string[]
    );
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [visibleDocuments]);

  // LỌC VĂN BẢN TRÊN BẢNG
  const filteredDocs = useMemo(() => {
    let result = [...visibleDocuments];
    
    if (selectedUnitFilter) result = result.filter(item => String(item.id_don_vi) === String(selectedUnitFilter) || String(item.pham_vi_ap_dung) === String(selectedUnitFilter));
    if (selectedPhanLoai) result = result.filter(item => item.phan_loai === selectedPhanLoai);
    if (selectedYear !== 'all') {
      result = result.filter(item => item.ngay_ban_hanh && new Date(item.ngay_ban_hanh).getFullYear().toString() === selectedYear);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(item => 
        String(item.so_hieu || '').toLowerCase().includes(lower) || 
        String(item.tieu_de || '').toLowerCase().includes(lower) ||
        String(item.nghiep_vu || '').toLowerCase().includes(lower)
      );
    }

    result.sort((a, b) => {
      const dateA = a.ngay_ban_hanh ? new Date(a.ngay_ban_hanh).getTime() : 0;
      const dateB = b.ngay_ban_hanh ? new Date(b.ngay_ban_hanh).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;

      const numA = parseInt(String(a.so_hieu || '').match(/^\d+/)?.[0] || '0', 10);
      const numB = parseInt(String(b.so_hieu || '').match(/^\d+/)?.[0] || '0', 10);
      return numB - numA;
    });

    return result;
  }, [visibleDocuments, searchTerm, selectedUnitFilter, selectedPhanLoai, selectedYear]);

  const selectedUnitName = useMemo(() => {
    if (!selectedUnitFilter) return 'Toàn hệ thống';
    const unit = donViList.find(d => String(d.id) === String(selectedUnitFilter));
    return unit ? unit.ten_don_vi : 'Đơn vị không xác định';
  }, [selectedUnitFilter, donViList]);

  // 🟢 BẮT ĐẦU: STATE VÀ LOGIC PHÂN TRANG (PAGINATION)
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | string>(100);

  const actualRowsPerPage = typeof rowsPerPage === 'number' && rowsPerPage > 0 ? rowsPerPage : 100;
  const totalPages = Math.ceil(filteredDocs.length / actualRowsPerPage) || 1;

  // Tự động quay về trang 1 nếu người dùng thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedUnitFilter, selectedPhanLoai, selectedYear, searchTerm]);

  // Lấy danh sách văn bản của trang hiện tại
  const paginatedDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * actualRowsPerPage;
    return filteredDocs.slice(startIndex, startIndex + actualRowsPerPage);
  }, [filteredDocs, currentPage, actualRowsPerPage]);
  // 🟢 KẾT THÚC: LOGIC PHÂN TRANG

  const openModal = (mode: 'create' | 'update', item?: any) => {
    setModalMode(mode);
    const defaultDonViId = user?.id_don_vi || (user as any)?.idDonVi;

    if (item) { 
      setFormData({ 
        ...item, 
        ngay_ban_hanh: item.ngay_ban_hanh ? item.ngay_ban_hanh.split('T')[0] : '', 
        ngay_nhan: item.ngay_nhan ? item.ngay_nhan.split('T')[0] : '', 
        han_xu_ly: item.han_xu_ly ? item.han_xu_ly.split('T')[0] : '', 
        mat: isMatDocument(item.mat) 
      }); 
    } else {
      setFormData({
        id: '', id_don_vi: selectedUnitFilter || (defaultDonViId !== 'ALL' ? defaultDonViId : ''), 
        phan_loai: 'Thông báo', muc_do_khan: 'Bình thường', so_hieu: '', ngay_ban_hanh: new Date().toISOString().split('T')[0], 
        tieu_de: '', noi_dung: '', link_vb: '', noi_goi_nhan: '', so_den: '', ngay_nhan: '', 
        bo_phan_xu_ly: '', han_xu_ly: '', trang_thai_xu_ly: 'Chờ xử lý',
        nguoi_ky: '', chuc_vu: '', nguoi_lay_so: '', bo_phan_lay_so: '', pham_vi_ap_dung: selectedUnitFilter || 'Toàn hệ thống', 
        hieu_luc: 'Còn hiệu lực', nghiep_vu: '', van_ban_thay_the: '', mat: false
      });
    }
    setIsModalOpen(true); setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị ban hành/lưu trữ!");
    if (formData.hieu_luc === 'Thay thế VB khác' && !formData.van_ban_thay_the) return toast.warning("Vui lòng dán Link văn bản bị thay thế!");
    
    let finalData = { ...formData };
    
    if (finalData.phan_loai !== 'Công văn đến') {
      finalData.so_den = null;
      finalData.ngay_nhan = null;
    }
    if (finalData.phan_loai !== 'Công văn đến' && finalData.phan_loai !== 'Tờ trình') {
      finalData.bo_phan_xu_ly = null;
      finalData.han_xu_ly = null;
      finalData.trang_thai_xu_ly = null;
    }

    Object.keys(finalData).forEach(key => {
      if (finalData[key] === '' || finalData[key] === ' ') {
        finalData[key] = null;
      }
    });

    finalData.mat = !!finalData.mat; 

    if (modalMode === 'create' && !finalData.id) {
      finalData.id = `VB-${Date.now()}`;
    }

    setSubmitting(true); setError(null);
    try {
      const response = await apiService.save(finalData, modalMode, "vb_tb");
      
      if (modalMode === 'create') {
        finalData.id = response.id || response.newId || finalData.id;
        setVbData(prev => [finalData, ...prev]); 
      } else {
        setVbData(prev => prev.map(item => String(item.id) === String(finalData.id) ? finalData : item));
      }
      setIsModalOpen(false); 
      
      // 🟢 Thêm thông báo thành công tại đây (Phân biệt hành động)
      if (modalMode === 'create') {
        toast.success("Ban hành văn bản thành công!");
      } else {
        toast.success("Cập nhật văn bản thành công!");
      }

    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu Văn bản.'); 
      
      // 🔴 Thêm thông báo lỗi tại đây
      toast.error(err.message || "Đã xảy ra lỗi khi lưu văn bản!");
      
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'hieu_luc' && value !== 'Thay thế VB khác') {
      setFormData((prev: any) => ({ ...prev, [name]: value, van_ban_thay_the: '' }));
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return; 
    setSubmitting(true);
    try {
      await apiService.delete(itemToDelete, "vb_tb");
      setVbData(prev => prev.filter(item => String(item.id) !== String(itemToDelete)));
      setIsConfirmOpen(false); 
      setItemToDelete(null); 
      // 🟢 Thêm thông báo thành công tại đây
      toast.success("Xóa văn bản thành công!");
    } catch (err: any) { 
      setError(err.message || 'Lỗi xóa dữ liệu.'); 
       // 🔴 Thêm thông báo lỗi tại đây
      toast.error(err.message || "Đã xảy ra lỗi khi xóa!");
    } finally { 
      setSubmitting(false); 
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
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedUnitFilter === parent.id ? 'bg-blue-50 text-[#05469B]' : 'text-gray-700 hover:bg-gray-50'} ${isParentDimmed ? 'opacity-50' : ''}`}
        >
          {children.length > 0 ? (isExpanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />) : <div className="w-4 shrink-0" />}
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

  if (loading) return <PageWithFilterSkeleton rows={8} />;
  return (
    <div className="flex h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (
        <button onClick={() => setIsListCollapsed(false)} className="absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all">
          <PanelLeftOpen size={20} />
        </button>
      )}

      {/* CỘT TRÁI: BỘ LỌC ĐƠN VỊ VÀ PHÂN LOẠI */}
      <div className={`${isListCollapsed ? 'w-0 opacity-0' : 'w-80 opacity-100'} transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10 shrink-0 overflow-hidden`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-[#05469B] flex items-center gap-2 whitespace-nowrap"><Bookmark size={20} /> Lọc & Phân loại</h2>
            <button onClick={() => setIsListCollapsed(true)} className="p-1.5 text-gray-400 hover:text-[#05469B] hover:bg-blue-50 rounded-md transition-colors"><PanelLeftClose size={18} /></button>
          </div>
          
          <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg mb-4">
            <button onClick={() => setSelectedPhanLoai('Thông báo')} className={`py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Thông báo' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}>T.Báo</button>
            <button onClick={() => setSelectedPhanLoai('Quyết định')} className={`py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Quyết định' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}>Q.Định</button>
            <button onClick={() => setSelectedPhanLoai('Công văn đến')} className={`py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Công văn đến' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}>CV Đến</button>
            <button onClick={() => setSelectedPhanLoai('Công văn đi')} className={`py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Công văn đi' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}>CV Đi</button>
            <button onClick={() => setSelectedPhanLoai('Tờ trình')} className={`py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Tờ trình' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}>T.Trình</button>
            <button onClick={() => setSelectedPhanLoai(null)} className={`py-1.5 text-xs font-bold rounded-md transition-all ${!selectedPhanLoai ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}>Tất cả</button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Tìm đơn vị áp dụng..." className="w-full pl-9 pr-4 py-2 bg-[#FFFFF0] border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#05469B] outline-none" value={unitSearchTerm} onChange={(e) => setUnitSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-w-[319px]">
          <button onClick={() => setSelectedUnitFilter(null)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold mb-4 transition-colors ${selectedUnitFilter === null ? 'bg-blue-50 text-[#05469B] border border-blue-100' : 'text-gray-700 hover:bg-gray-50'}`}>
            <Building2 size={18} className={selectedUnitFilter === null ? 'text-[#05469B]' : 'text-gray-400'} /> Toàn Hệ Thống
          </button>
          <hr className="border-gray-100 mb-4 mx-2"/>

          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#05469B]" /></div>
          ) : parentUnits.length === 0 ? (
            <div className="text-center p-4 text-sm text-gray-500">Không tìm thấy đơn vị.</div>
          ) : (
            <>
              {vpdhUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2">VPĐH</p>{vpdhUnits.map(dv => renderUnitTree(dv))}</div>)}
              {ctttNamUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2">CTTT Phía Nam</p>{ctttNamUnits.map(dv => renderUnitTree(dv))}</div>)}
              {ctttBacUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2">CTTT Phía Bắc</p>{ctttBacUnits.map(dv => renderUnitTree(dv))}</div>)}
              {otherUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Đơn vị khác</p>{otherUnits.map(dv => renderUnitTree(dv))}</div>)}
            </>
          )}
        </div>
      </div>

      {/* CỘT PHẢI: BẢNG DỮ LIỆU */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative transition-all duration-300 flex flex-col">
        <div className={`flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'pl-10' : ''} shrink-0`}>
          <div>
            <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2"><FileText size={28} /> Quản lý Văn bản - Tờ trình</h2>
            <p className="text-sm font-medium text-gray-500 mt-1">Lọc: <span className="text-emerald-600 font-bold">{selectedPhanLoai || 'Tất cả'}</span> • Khu vực: <span className="text-emerald-600 font-bold">{selectedUnitName}</span></p>
          </div>
          
          <div className="flex w-full sm:w-auto gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm font-bold text-[#05469B] cursor-pointer"
            >
              <option value="all">Tất cả năm</option>
              {availableYears.map(year => (
                <option key={year} value={year}>Năm {year}</option>
              ))}
            </select>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Tìm số hiệu, tiêu đề, nghiệp vụ..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => openModal('create')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#05469B] hover:bg-[#04367a] text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap"><Plus className="w-5 h-5" /> Ban hành</button>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg shadow-sm shrink-0"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p></div>}

        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 flex flex-col flex-1 ${isListCollapsed ? 'ml-10' : ''}`}>
          <div className="overflow-x-auto w-full custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="sticky top-0 bg-[#f8fafc] z-10 shadow-sm">
                <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-3 w-36 bg-[#f8fafc]">Số hiệu / Phân loại</th>
                  <th className="py-3 px-3 w-28 bg-[#f8fafc]">Ngày BH</th>
                  <th className="py-3 px-3 min-w-[250px] bg-[#f8fafc]">Tiêu đề & Nội dung</th>
                  <th className="py-3 px-3 w-44 bg-[#f8fafc]">Phạm vi áp dụng</th>
                  <th className="py-3 px-3 w-32 bg-[#f8fafc]">Nghiệp vụ</th>
                  <th className="py-3 px-3 w-28 bg-[#f8fafc]">Hiệu lực</th>
                  <th className="py-3 px-3 text-center w-28 bg-[#f8fafc]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="p-12 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#05469B]" />Đang tải dữ liệu...</td></tr>
                ) : filteredDocs.length === 0 ? (
                  <tr><td colSpan={7} className="p-16 text-center text-gray-500"><FileText size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-lg font-medium">Không tìm thấy văn bản phù hợp.</p></td></tr>
                ) : (
                  paginatedDocs.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center flex-wrap gap-1 mb-1">
                          <span className="font-black text-[#05469B] bg-blue-50 px-1.5 py-0.5 rounded text-xs whitespace-nowrap border border-blue-100">{item.so_hieu}</span>
                          {item.muc_do_khan === 'Hỏa tốc' && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black border border-red-200 uppercase">HỎA TỐC</span>}
                          {item.muc_do_khan === 'Khẩn' && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-black border border-orange-200 uppercase">KHẨN</span>}
                        </div>
                        <div className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded inline-block uppercase tracking-wide">{item.phan_loai}</div>
                      </td>
                      <td className="py-2.5 px-3 text-xs font-medium text-gray-700">
                        <div className="flex items-center gap-1.5"><Calendar size={13} className="text-gray-400 shrink-0"/> {item.ngay_ban_hanh ? new Date(item.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-start gap-1.5 mb-1">
                          {isMatDocument(item.mat) && (
                            <span className="flex items-center gap-0.5 bg-red-100 text-red-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-200 shrink-0 mt-0.5" title="Văn bản Mật">
                              <Lock size={10} /> MẬT
                            </span>
                          )}
                          <p className={`font-bold text-sm leading-tight ${isMatDocument(item.mat) ? 'text-red-700' : 'text-gray-800'}`}>{item.tieu_de}</p>
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-1 mb-1.5">{item.noi_dung}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.link_vb && (
                            <a href={item.link_vb} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              <LinkIcon size={10}/> File gốc
                            </a>
                          )}
                          {item.hieu_luc === 'Thay thế VB khác' && item.van_ban_thay_the && (
                             <a href={item.van_ban_thay_the} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:underline bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                               <LinkIcon size={10}/> File cũ
                             </a>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="text-xs font-semibold text-gray-700 line-clamp-1" title={item.pham_vi_ap_dung === 'Toàn hệ thống' ? 'Toàn hệ thống' : donViMap[String(item.pham_vi_ap_dung)] || item.pham_vi_ap_dung}>
                          {item.pham_vi_ap_dung === 'Toàn hệ thống' ? '🌍 Toàn hệ thống' : donViMap[String(item.pham_vi_ap_dung)] || item.pham_vi_ap_dung}
                        </p>
                        <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold truncate">Từ: {donViMap[String(item.id_don_vi)] || item.id_don_vi}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        {item.nghiep_vu ? <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[11px] font-bold border border-indigo-100 inline-block truncate max-w-full" title={item.nghiep_vu}>{item.nghiep_vu}</span> : <span className="text-gray-400 italic text-[11px]">Chưa PL</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 text-center whitespace-nowrap
                          ${item.hieu_luc === 'Còn hiệu lực' ? 'bg-green-50 text-green-700 border border-green-200' : 
                            item.hieu_luc === 'Hết hiệu lực' ? 'bg-gray-100 text-gray-600 border border-gray-300' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                          {item.hieu_luc === 'Còn hiệu lực' && <CheckCircle2 size={12}/>}
                          {item.hieu_luc}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-full max-w-[100px] mx-auto">
                          <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="p-1.5 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded transition-colors shadow-sm" title="Xem chi tiết"><Eye size={14} /></button>
                          <button onClick={() => openModal('update', item)} className="p-1.5 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded transition-colors shadow-sm" title="Sửa"><Edit size={14} /></button>
                          <button onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }} className="p-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded transition-colors shadow-sm" title="Xóa"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 🟢 GIAO DIỆN PHÂN TRANG (PAGINATION BAR) */}
          {filteredDocs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 h-[40px] bg-gray-50 border-t border-gray-200 gap-4 shrink-0">
              <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
                  className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <span className="flex items-center gap-2">
                  Trang 
                  <input 
                    type="number" 
                    min={1} 
                    max={totalPages} 
                    value={currentPage} 
                    onChange={(e) => {
                      let val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        if (val > totalPages) val = totalPages;
                        if (val < 1) val = 1;
                        setCurrentPage(val);
                      }
                    }}
                    className="w-12 text-center border border-gray-300 rounded p-1 outline-none focus:border-[#05469B] focus:ring-1 focus:ring-[#05469B]"
                  /> 
                  / {totalPages}
                </span>

                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages}
                  className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Trang tiếp theo"
                >
                  <ChevronRight size={16} />
                </button>

                <div className="flex items-center gap-2 ml-2 sm:ml-4 pl-2 sm:pl-4 border-l border-gray-300">
                  <input 
                    type="number" 
                    min={1} 
                    value={rowsPerPage} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setRowsPerPage(val === '' ? '' : parseInt(val));
                      setCurrentPage(1); 
                    }}
                    className="w-16 text-center border border-gray-300 rounded p-1 outline-none focus:border-[#05469B] focus:ring-1 focus:ring-[#05469B] text-[#05469B] font-bold"
                  />
                  <span>dòng</span>
                </div>
              </div>
              
              <div className="text-sm text-gray-500 hidden md:block">
                Hiển thị {(currentPage - 1) * actualRowsPerPage + 1} - {Math.min(currentPage * actualRowsPerPage, filteredDocs.length)} trong tổng số <span className="font-bold text-gray-800">{filteredDocs.length}</span> văn bản
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL THÊM / SỬA VĂN BẢN (FORM ĐỘNG) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between p-5 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-[#05469B] flex items-center gap-2"><FileText size={24}/> {modalMode === 'create' ? 'Ban hành Văn bản / Thông báo Mới' : 'Cập nhật Văn bản'}</h3>
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6">
              
              {/* KHỐI 1: THÔNG TIN HÀNH CHÍNH (CỐ ĐỊNH) */}
              <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-100">
                <h4 className="font-bold text-[#05469B] mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-[#05469B] rounded-full"></div> 1. Thông Điệp Hành chính</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị ban hành (Lưu trữ) *</label>
                    <select required name="id_don_vi" value={formData.id_don_vi || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]">
                      <option value="">-- Chọn đơn vị --</option>
                      {buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }) => (
                        <option key={unit.id} value={unit.id} className="font-normal text-gray-700">{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phân loại *</label>
                    <select required name="phan_loai" value={formData.phan_loai || 'Thông báo'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-800">
                      <option value="Thông báo">Thông báo</option>
                      <option value="Quyết định">Quyết định</option>
                      <option value="Tờ trình">Tờ trình</option>
                      <option value="Công văn đến">Công văn đến</option>
                      <option value="Công văn đi">Công văn đi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-red-600 mb-1">Độ khẩn *</label>
                    <select name="muc_do_khan" value={formData.muc_do_khan || 'Bình thường'} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-red-500 font-bold ${formData.muc_do_khan === 'Hỏa tốc' ? 'text-red-700 border-red-300' : formData.muc_do_khan === 'Khẩn' ? 'text-orange-600 border-orange-300' : 'text-gray-700 border-gray-200'}`}>
                      <option value="Bình thường">Bình thường</option><option value="Khẩn">Khẩn</option><option value="Hỏa tốc">Hỏa tốc</option>
                    </select>
                  </div>

                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Số hiệu *</label><input type="text" required name="so_hieu" value={formData.so_hieu || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-black text-gray-800 tracking-wider" placeholder="VD: 123/TB-THaco..." /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày ban hành *</label><input type="date" required name="ngay_ban_hanh" value={formData.ngay_ban_hanh || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold" /></div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phạm vi áp dụng (Hiển thị cho) *</label>
                    <select required name="pham_vi_ap_dung" value={formData.pham_vi_ap_dung || 'Toàn hệ thống'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]">
                      <option value="Toàn hệ thống">🌍 Áp dụng Toàn hệ thống</option>
                      <optgroup label="Hoặc Chỉ định Đơn vị cụ thể:">
                        {buildHierarchicalOptions(donViList).map(({ unit, prefix }) => (
                          <option key={unit.id} value={unit.id} className="font-normal text-gray-700">{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="col-span-2 md:col-span-4 mt-1">
                    <label className="inline-flex items-center p-3 border border-red-200 rounded-lg bg-red-50 cursor-pointer hover:bg-red-100 transition-colors shadow-sm w-max">
                      <input type="checkbox" name="mat" checked={!!formData.mat} onChange={(e) => setFormData((prev: any) => ({ ...prev, mat: e.target.checked }))} className="w-4 h-4 text-red-600 rounded border-red-300 mr-2.5 focus:ring-red-500" />
                      <Lock size={16} className="text-red-600 mr-1.5" />
                      <span className="text-sm font-bold text-red-700">Đánh dấu là Văn bản MẬT (Cảnh báo thị giác)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* KHỐI 2: THÔNG TIN LUÂN CHUYỂN (ĐỘNG) */}
              {formData.phan_loai !== 'Thông báo' && (
                <div className="bg-indigo-50/40 p-5 rounded-xl border border-indigo-100 animate-in fade-in zoom-in duration-200">
                  <h4 className="font-bold text-indigo-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-indigo-500 rounded-full"></div> 2. Thông tin Luân chuyển</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    <div className={formData.phan_loai === 'Công văn đến' ? 'md:col-span-2' : 'md:col-span-4'}>
                      <label className="block text-xs font-bold text-indigo-800 mb-1 uppercase">{getNoiGuiNhanLabel(formData.phan_loai)} *</label>
                      <input type="text" required name="noi_goi_nhan" value={formData.noi_goi_nhan || ''} onChange={handleInputChange} className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Tên cơ quan, đơn vị, cá nhân..." />
                    </div>
                    {formData.phan_loai === 'Công văn đến' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-indigo-800 mb-1 uppercase">Số đến nội bộ *</label>
                          <input type="text" required name="so_den" value={formData.so_den || ''} onChange={handleInputChange} className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="VD: 01/Đ..." />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-indigo-800 mb-1 uppercase">Ngày nhận *</label>
                          <input type="date" required name="ngay_nhan" value={formData.ngay_nhan || ''} onChange={handleInputChange} className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* KHỐI 3: NỘI DUNG CHÍNH */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-gray-400 rounded-full"></div> 3. Nội dung Văn bản</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Tiêu đề *</label>
                    <input type="text" required name="tieu_de" value={formData.tieu_de || ''} onChange={handleInputChange} className="w-full p-3 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-lg" placeholder="Nhập tiêu đề văn bản..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Trích yếu nội dung</label>
                    <textarea name="noi_dung" value={formData.noi_dung || ''} onChange={handleInputChange} rows={3} className="w-full p-3 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none" placeholder="Tóm tắt ngắn gọn nội dung..."></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Link File đính kèm (PDF / Drive)</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input type="url" name="link_vb" value={formData.link_vb || ''} onChange={handleInputChange} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] text-blue-600 font-medium" placeholder="Dán link Google Drive hoặc file PDF vào đây..." />
                    </div>
                  </div>
                </div>
              </div>

              {/* KHỐI 4: THEO DÕI XỬ LÝ & PHỤ TRỢ */}
              <div className="bg-orange-50/40 p-5 rounded-xl border border-orange-100">
                <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-orange-500 rounded-full"></div> 4. Theo dõi Xử lý & Thông kho Phụ trợ</h4>
                
                <div className="space-y-6">
                  {/* Khu vực Xử lý */}
                  {(formData.phan_loai === 'Công văn đến' || formData.phan_loai === 'Tờ trình') && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-6 border-b border-orange-200 animate-in fade-in zoom-in">
                      <div>
                        <label className="block text-xs font-bold text-red-700 mb-1 flex items-center gap-1"><Zap size={14}/> Đơn vị / Người xử lý</label>
                        <CustomAutocomplete name="bo_phan_xu_ly" value={formData.bo_phan_xu_ly} onChange={handleInputChange} placeholder="Giao cho..." suggestions={suggestDonViXuLy} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-red-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-red-700 mb-1 flex items-center gap-1"><Clock size={14}/> Hạn xử lý (Deadline)</label>
                        <input type="date" name="han_xu_ly" value={formData.han_xu_ly || ''} onChange={handleInputChange} className="w-full p-2.5 border border-red-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-orange-700 mb-1 flex items-center gap-1"><Send size={14}/> Trạng thái Xử lý</label>
                        <select name="trang_thai_xu_ly" value={formData.trang_thai_xu_ly || 'Chờ xử lý'} onChange={handleInputChange} className="w-full p-2.5 border border-orange-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-800">
                          <option value="Chờ xử lý">Chờ xử lý</option>
                          <option value="Đang xử lý">Đang xử lý</option>
                          <option value="Đã hoàn thành">Đã hoàn thành</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Khu vực Phụ trợ (ĐÃ THAY BẰNG CUSTOM AUTOCOMPLETE) */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Người ký</label>
                      <CustomAutocomplete name="nguoi_ky" value={formData.nguoi_ky} onChange={handleInputChange} placeholder="Họ tên người ký..." suggestions={suggestNguoiky} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Chức vụ người ký</label>
                      <CustomAutocomplete name="chuc_vu" value={formData.chuc_vu} onChange={handleInputChange} placeholder="VD: Giám đốc..." suggestions={suggestChucvu} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Người lấy số</label>
                      <CustomAutocomplete name="nguoi_lay_so" value={formData.nguoi_lay_so} onChange={handleInputChange} placeholder="Nhân viên..." suggestions={suggestNguoilayso} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Bộ phận lấy số</label>
                      <CustomAutocomplete name="bo_phan_lay_so" value={formData.bo_phan_lay_so} onChange={handleInputChange} placeholder="Phòng HCNS..." suggestions={suggestBPlayso} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Phân loại Nghiệp vụ</label>
                      <CustomAutocomplete name="nghiep_vu" value={formData.nghiep_vu} onChange={handleInputChange} placeholder="Kinh doanh, Nhân sự, Dịch vụ..." suggestions={suggestNghiepvu} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tình trạng Hiệu lực *</label>
                      <select required name="hieu_luc" value={formData.hieu_luc || 'Còn hiệu lực'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]">
                        <option value="Còn hiệu lực">Còn hiệu lực</option>
                        <option value="Hết hiệu lực">Hết hiệu lực</option>
                        <option value="Thay thế VB khác">Thay thế VB khác</option>
                      </select>
                    </div>

                    {formData.hieu_luc === 'Thay thế VB khác' && (
                      <div className="col-span-1 md:col-span-4 bg-orange-50 p-3 rounded-lg border border-orange-300 mt-2 animate-in fade-in zoom-in duration-200">
                        <label className="block text-xs font-bold text-orange-800 mb-1">Link Văn bản bị thay thế (Dán link vào đây) *</label>
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" size={16} />
                          <input type="url" required name="van_ban_thay_the" value={formData.van_ban_thay_the || ''} onChange={handleInputChange} className="w-full pl-9 pr-4 py-2.5 border border-orange-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500 text-blue-600 text-sm font-medium" placeholder="Dán link Google Drive của văn bản cũ..." />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-gray-100 flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm">Hủy</button>
                <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Văn Bản</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 MODAL XEM CHI TIẾT (BỐ CỤC 1 CỘT, LÀM NỔI BẬT THÔNG TIN NGƯỜI KÝ & NGHIỆP VỤ) */}
      {isViewModalOpen && viewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-[#05469B] text-white rounded-t-2xl shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2"><FileText size={24}/> Chi tiết Văn bản</h3>
              <div className="flex items-center gap-3">
                {viewData.link_vb && (
                  <a href={viewData.link_vb} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors border border-white/20">
                    <ExternalLink size={16}/> Mở file
                  </a>
                )}
                <button onClick={() => setIsViewModalOpen(false)} className="text-blue-200 hover:text-white rounded-full p-1 transition-colors"><X className="w-6 h-6" /></button>
              </div>
            </div>
            
            <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
              
              {isMatDocument(viewData.mat) && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0"><Lock size={24} /></div>
                  <div>
                    <p className="text-base font-black text-red-700 uppercase">Tài liệu Mật</p>
                    <p className="text-sm font-medium text-red-600 mt-0.5">Đề nghị không sao chép, chụp ảnh hay phát tán dưới mọi hình thức.</p>
                  </div>
                </div>
              )}

              <div className="mb-8 border-b border-gray-100 pb-6">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="bg-blue-100 text-[#05469B] font-black px-3 py-1.5 rounded text-lg border border-blue-200 shadow-sm">{viewData.so_hieu}</span>
                  <span className="bg-gray-100 text-gray-600 font-bold px-3 py-1.5 rounded text-xs uppercase">{viewData.phan_loai}</span>
                  
                  {viewData.muc_do_khan && viewData.muc_do_khan !== 'Bình thường' && (
                    <span className={`px-3 py-1.5 rounded text-xs font-black border uppercase ${viewData.muc_do_khan === 'Hỏa tốc' ? 'bg-red-100 text-red-700 border-red-300 animate-pulse' : 'bg-orange-100 text-orange-700 border-orange-300'}`}>
                      {viewData.muc_do_khan}
                    </span>
                  )}
                  
                  <span className={`px-3 py-1.5 rounded text-xs font-bold border ${viewData.hieu_luc === 'Còn hiệu lực' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : viewData.hieu_luc === 'Hết hiệu lực' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                    {viewData.hieu_luc}
                  </span>
                </div>
                <h2 className={`text-2xl sm:text-3xl font-black leading-tight mt-4 ${isMatDocument(viewData.mat) ? 'text-red-700' : 'text-gray-800'}`}>{viewData.tieu_de}</h2>
                <p className="text-sm text-gray-500 mt-3 flex items-center gap-2"><Calendar size={16}/> Ban hành: <span className="font-bold text-gray-700">{viewData.ngay_ban_hanh ? new Date(viewData.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}</span></p>
              </div>

              <div className="mb-8">
                <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><FileText size={18}/> Trích yếu nội dung:</h4>
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 text-base text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {viewData.noi_dung || <span className="italic text-gray-400">Không có trích yếu nội dung.</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8 bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Nơi ban hành (Lưu trữ)</p>
                  <p className="font-semibold text-[#05469B] text-base break-words">{donViMap[String(viewData.id_don_vi)] || viewData.id_don_vi}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Phạm vi áp dụng</p>
                  <p className="font-semibold text-[#05469B] text-base break-words">{viewData.pham_vi_ap_dung === 'Toàn hệ thống' ? '🌍 Toàn hệ thống' : donViMap[String(viewData.pham_vi_ap_dung)] || viewData.pham_vi_ap_dung}</p>
                </div>
              </div>

              {viewData.phan_loai !== 'Thông báo' && (
                <div className="mb-8 p-5 rounded-xl border border-indigo-100 bg-indigo-50/50 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={viewData.phan_loai === 'Công văn đến' ? 'md:col-span-2' : ''}>
                        <p className="text-xs text-indigo-500 uppercase font-bold mb-1">{getNoiGuiNhanLabel(viewData.phan_loai)}</p>
                        <p className="font-bold text-indigo-900 text-base">{viewData.noi_goi_nhan || '-'}</p>
                    </div>
                    {viewData.phan_loai === 'Công văn đến' && (
                      <>
                        <div><p className="text-xs text-indigo-500 uppercase font-bold mb-1">Số đến nội bộ</p><p className="font-black text-[#05469B] text-base">{viewData.so_den || '-'}</p></div>
                        <div><p className="text-xs text-indigo-500 uppercase font-bold mb-1">Ngày nhận CV</p><p className="font-semibold text-gray-800 text-base">{viewData.ngay_nhan ? new Date(viewData.ngay_nhan).toLocaleDateString('vi-VN') : '-'}</p></div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* 🟢 KHỐI NGƯỜI KÝ & NGHIỆP VỤ ĐƯỢC DÀN HÀNG NGANG */}
              <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm mb-8">
                <h4 className="text-sm font-bold text-[#05469B] mb-4 flex items-center gap-2 uppercase tracking-wider"><Briefcase size={18} /> Phân công & Nghiệp vụ</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 flex flex-col justify-center">
                     <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase mb-1.5"><PenTool size={14} className="text-blue-500"/> Người ký</span>
                     <p className="font-black text-gray-800 text-base">{viewData.nguoi_ky || '---'}</p>
                     <p className="text-[10px] text-gray-500 uppercase mt-0.5 font-bold">{viewData.chuc_vu || '---'}</p>
                  </div>
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50 flex flex-col justify-center">
                     <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase mb-1.5"><Hash size={14} className="text-emerald-500"/> Lấy số bởi</span>
                     <p className="font-black text-gray-800 text-base">{viewData.nguoi_lay_so || '---'}</p>
                     <p className="text-[10px] text-gray-500 uppercase mt-0.5 font-bold">{viewData.bo_phan_lay_so || '---'}</p>
                  </div>
                  <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/50 flex flex-col justify-center items-start">
                     <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase mb-2"><Layers size={14} className="text-orange-500"/> Phân loại Nghiệp vụ</span>
                     <span className="font-black text-[#05469B] text-sm px-3 py-1.5 bg-white rounded border border-[#05469B]/20 shadow-sm">{viewData.nghiep_vu || '---'}</span>
                  </div>
                </div>
              </div>

              {(viewData.phan_loai === 'Công văn đến' || viewData.phan_loai === 'Tờ trình') && (
                <div className="mb-6 p-5 rounded-xl border border-orange-200 bg-orange-50/50 shadow-sm flex flex-col">
                  <h4 className="text-sm font-bold text-orange-800 mb-4 flex items-center gap-2 uppercase tracking-wider"><Clock size={18}/> Theo dõi Xử lý</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><p className="text-[10px] text-gray-500 font-bold mb-1 uppercase">Người xử lý</p><p className="font-semibold text-gray-800 text-base">{viewData.bo_phan_xu_ly || 'Chưa giao'}</p></div>
                    <div><p className="text-[10px] text-gray-500 font-bold mb-1 uppercase">Hạn xử lý</p><p className="font-bold text-red-600 text-base">{viewData.han_xu_ly ? new Date(viewData.han_xu_ly).toLocaleDateString('vi-VN') : '-'}</p></div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold mb-1 uppercase">Trạng thái</p>
                      <span className={`inline-block font-black px-3 py-1.5 rounded border text-sm ${viewData.trang_thai_xu_ly === 'Đã hoàn thành' ? 'bg-green-100 text-green-700 border-green-200' : viewData.trang_thai_xu_ly === 'Đang xử lý' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                        {viewData.trang_thai_xu_ly || 'Chờ xử lý'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                {viewData.link_vb && (
                  <a href={viewData.link_vb} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#05469B] hover:bg-[#04367a] text-white rounded-xl font-bold transition-colors shadow-md text-lg">
                    <ExternalLink size={20}/> Mở File Văn Bản
                  </a>
                )}
                {viewData.hieu_luc === 'Thay thế VB khác' && viewData.van_ban_thay_the && (
                  <a href={viewData.van_ban_thay_the} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-4 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-xl font-bold transition-colors shadow-sm text-lg">
                    <ExternalLink size={20}/> Xem Văn bản bị thay thế
                  </a>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* XÁC NHẬN XÓA */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này sẽ xóa văn bản này vĩnh viễn.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">Hủy</button>
              <button onClick={confirmDelete} disabled={submitting} className="flex-1 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-colors">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}