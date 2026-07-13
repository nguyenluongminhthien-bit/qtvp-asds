import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, 
  BookOpen, Link as LinkIcon, Calendar, Eye, Bookmark, Briefcase, Filter, Info, CheckCircle2,
  PenTool, Hash, Layers, FileText, ExternalLink
} from 'lucide-react';
import { apiService } from '../services/api';
import { VB_TB } from '../types'; 
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../utils/toast';
import { toUnaccented, stripAccents } from '../utils/formatters';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';


interface PolicyItem extends Partial<VB_TB> {
  isFromVB?: boolean;
}

export default function PolicyPage() {
  const { user } = useAuth();
  const [qdData, setQdData] = useState<PolicyItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layout & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedNghiepvu, setSelectedNghiepvu] = useState<string | null>(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update'>('create');
  const [formData, setFormData] = useState<Partial<PolicyItem>>({});
  
  // View Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<PolicyItem | null>(null);

  // Delete Modal
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [qdResult, vbResult] = await Promise.all([
        apiService.getQuyDinh().catch(() => [] as any[]),
        apiService.getVanBan().catch(() => [] as VB_TB[]) 
      ]);

      const mappedQd: PolicyItem[] = (qdResult || []).map((item: any) => ({
        ...item,
        isFromVB: false
      }));

      const mappedVb: PolicyItem[] = (vbResult || [])
        .filter((item: any) => item.nghiep_vu && item.nghiep_vu.trim() !== '')
        .map((item: any) => ({
          id: item.id, 
          phan_loai: item.phan_loai,
          so_hieu: item.so_hieu,
          ngay_ban_hanh: item.ngay_ban_hanh,
          tieu_de: item.tieu_de,
          noi_dung: item.noi_dung,
          nghiep_vu: item.nghiep_vu,
          link_vb: item.link_vb, 
          hieu_luc: item.hieu_luc || 'Còn hiệu lực',
          nguoi_ky: item.nguoi_ky,
          chuc_vu: item.chuc_vu,
          nguoi_lay_so: item.nguoi_lay_so,
          bo_phan_lay_so: item.bo_phan_lay_so,
          isFromVB: true 
        }));

      const combinedData = [...mappedQd, ...mappedVb];
      combinedData.sort((a, b) => {
        const aIsExpired = a.hieu_luc === 'Hết hiệu lực';
        const bIsExpired = b.hieu_luc === 'Hết hiệu lực';
        if (aIsExpired && !bIsExpired) return 1;
        if (!aIsExpired && bIsExpired) return -1;
        const dateA = a.ngay_ban_hanh ? new Date(a.ngay_ban_hanh).getTime() : 0;
        const dateB = b.ngay_ban_hanh ? new Date(b.ngay_ban_hanh).getTime() : 0;
        return dateB - dateA;
      });

      setQdData(combinedData);
    } catch (err: any) { 
      setError(err.message || 'Lỗi tải dữ liệu Hệ thống.'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, []);

  const uniqueNghiepvu = useMemo(() => {
    const list = qdData.map(item => item.nghiep_vu).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [qdData]);

  const uniquePhanloai = useMemo(() => {
    const list = qdData.map(item => item.phan_loai).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [qdData]);

  const filteredDocs = useMemo(() => {
    let result = qdData;
    
    if (selectedNghiepvu) {
      result = result.filter(item => item.nghiep_vu === selectedNghiepvu);
    }
    
    if (searchTerm) {
      const cleanSearch = stripAccents(searchTerm);
      result = result.filter(item => 
        stripAccents(item.so_hieu || '').includes(cleanSearch) || 
        stripAccents(item.tieu_de || '').includes(cleanSearch) ||
        stripAccents(item.nghiep_vu || '').includes(cleanSearch) ||
        stripAccents(item.phan_loai || '').includes(cleanSearch)
      );
    }

    return [...result].sort((a, b) => {
      const aIsExpired = a.hieu_luc === 'Hết hiệu lực';
      const bIsExpired = b.hieu_luc === 'Hết hiệu lực';
      if (aIsExpired && !bIsExpired) return 1;
      if (!aIsExpired && bIsExpired) return -1;
      const dateA = a.ngay_ban_hanh ? new Date(a.ngay_ban_hanh).getTime() : 0;
      const dateB = b.ngay_ban_hanh ? new Date(b.ngay_ban_hanh).getTime() : 0;
      return dateB - dateA;
    });
  }, [qdData, searchTerm, selectedNghiepvu]);

  const openModal = (mode: 'create' | 'update', item?: PolicyItem) => {
    setModalMode(mode);
    if (item) { 
      setFormData({ ...item, ngay_ban_hanh: item.ngay_ban_hanh ? item.ngay_ban_hanh.split('T')[0] : '' }); 
    } else {
      setFormData({
        id: '', phan_loai: 'Quy trình', so_hieu: '', 
        ngay_ban_hanh: new Date().toISOString().split('T')[0], 
        tieu_de: '', noi_dung: '', nghiep_vu: selectedNghiepvu || '', link_vb: '',
        hieu_luc: 'Còn hiệu lực'
      });
    }
    setIsModalOpen(true); setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nghiep_vu) return toast.warning("Vui lòng nhập/chọn Nghiệp vụ!");
    
    setSubmitting(true); setError(null);
    try {
      const dataToSave = { ...formData };
      delete dataToSave.isFromVB; 

      const response = await apiService.save(dataToSave, modalMode, "qd_qt");
      if (modalMode === 'create') {
        const newItem = { ...dataToSave, id: response.id || response.newId || `QD-${Date.now()}`, isFromVB: false } as PolicyItem;
        setQdData(prev => [newItem, ...prev]); 
      } else {
        setQdData(prev => prev.map(item => item.id === dataToSave.id ? { ...dataToSave, isFromVB: false } as PolicyItem : item));
      }
      setIsModalOpen(false); 
      
      // 🟢 Thông báo thành công (Phân biệt Thêm mới / Cập nhật)
      if (modalMode === 'create') {
        toast.success("Ban hành tài liệu thành công!");
      } else {
        toast.success("Cập nhật tài liệu thành công!");
      }
    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu.'); 
      // 🔴 Thông báo lỗi
      toast.error(err.message || "Đã xảy ra lỗi khi lưu!");
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return; 
    setSubmitting(true);
    try {
      await apiService.delete(itemToDelete, "qd_qt");
      setQdData(prev => prev.filter(item => item.id !== itemToDelete));
      setIsConfirmOpen(false); setItemToDelete(null);
      // 🟢 Thông báo thành công đặt ở cuối khối try
      toast.success("Xóa tài liệu thành công!"); 
    } catch (err: any) { 
      setError(err.message || 'Lỗi xóa dữ liệu.');
      // 🔴 Thông báo lỗi đặt trong khối catch
      toast.error(err.message || "Đã xảy ra lỗi khi xóa!"); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleBlockedAction = (action: 'Sửa' | 'Xóa') => {
    toast.info(`Đây là tài liệu được đồng bộ từ mục "Văn bản - Thông báo".\n\nVui lòng sang mục Văn bản để ${action} tài liệu này!`);
  };

  
  if (loading) return <PageWithFilterSkeleton rows={8} />;
  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (
        <button onClick={() => setIsListCollapsed(false)} className="hidden md:block absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all">
          <Filter size={20} />
        </button>
      )}

      <div className={`${isListCollapsed ? 'lg:w-0 lg:opacity-0 lg:-ml-72' : 'w-72 opacity-100 absolute lg:relative inset-y-0 left-0'} transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col h-full shadow-2xl lg:shadow-sm z-50 lg:z-10 shrink-0 overflow-hidden ${isListCollapsed ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-[#05469B] flex items-center gap-2 whitespace-nowrap"><Bookmark size={20} /> Nhóm Nghiệp Vụ</h2>
            <button onClick={() => setIsListCollapsed(true)} className="p-1.5 text-gray-400 hover:text-[#05469B] hover:bg-blue-50 rounded-md transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 min-w-[287px] custom-scrollbar">
          <button onClick={() => setSelectedNghiepvu(null)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold mb-4 transition-colors ${selectedNghiepvu === null ? 'bg-blue-50 text-[#05469B] border border-blue-100' : 'text-gray-700 hover:bg-gray-50'}`}>
            <BookOpen size={18} className={selectedNghiepvu === null ? 'text-[#05469B]' : 'text-gray-400'} /> Tất cả Dữ liệu
          </button>
          <hr className="border-gray-100 mb-4 mx-2"/>

          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#05469B]" /></div>
          ) : uniqueNghiepvu.length === 0 ? (
            <div className="text-center p-4 text-sm text-gray-500">Chưa có nghiệp vụ nào.</div>
          ) : (
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Danh sách Nghiệp vụ</p>
              {uniqueNghiepvu.map(nv => (
                <button key={nv} onClick={() => setSelectedNghiepvu(nv)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedNghiepvu === nv ? 'bg-blue-50 text-[#05469B] font-bold border border-blue-100' : 'text-gray-600 hover:bg-gray-50 font-medium'}`}>
                  <div className="flex items-center gap-2 truncate">
                    <Briefcase size={16} className={`shrink-0 ${selectedNghiepvu === nv ? 'text-[#05469B]' : 'text-gray-400'}`} />
                    <span className="truncate">{nv}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedNghiepvu === nv ? 'bg-[#05469B] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {qdData.filter(d => d.nghiep_vu === nv).length}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 relative transition-all duration-300">
        <div className={`flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:pl-10' : ''}`}>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {isListCollapsed && (
              <button 
                onClick={() => setIsListCollapsed(false)} 
                className="md:hidden bg-white p-2 rounded-lg shadow-sm border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all flex items-center justify-center shrink-0"
                title="Mở nhóm nghiệp vụ"
              >
                <Filter size={18} />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2"><BookOpen size={28} /> Quy định & Quy trình</h2>
              <p className="text-sm font-medium text-gray-500 mt-1">Lọc theo: <span className="text-emerald-600 font-bold">{selectedNghiepvu || 'Tất cả nghiệp vụ'}</span> ({filteredDocs.length} tài liệu)</p>
            </div>
          </div>
          <div className="flex w-full sm:w-auto gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Tìm số hiệu, tiêu đề, loại..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => openModal('create')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#05469B] hover:bg-[#04367a] text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap"><Plus className="w-5 h-5" /> Ban hành mới</button>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg shadow-sm"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p></div>}

        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${isListCollapsed ? 'md:ml-10' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="p-4 w-[230px] h-[35px]">Số hiệu / Phân loại</th>
                  <th className="p-4 w-32">Ngày BH</th>
                  <th className="p-4 w-[410px]">Tiêu đề & Trích yếu</th>
                  <th className="p-4 w-[130px]">Nghiệp vụ</th>
                  <th className="p-4 w-[130px] text-center">Hiệu lực</th>
                  <th className="p-4 text-center w-36">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={6} className="p-12 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#05469B]" />Đang tải dữ liệu...</td></tr>
                ) : filteredDocs.length === 0 ? (
                  <tr><td colSpan={6} className="p-16 text-center text-gray-500"><BookOpen size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-lg font-medium">Không tìm thấy tài liệu phù hợp.</p></td></tr>
                ) : (
                  filteredDocs.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                      
                      <td className="p-4 w-[230px] h-[130px]">
                        <span className="font-bold text-[13px] leading-[15px] text-[#05469B] bg-blue-50 px-2 py-1 rounded whitespace-nowrap border border-blue-100">{item.so_hieu}</span>
                        <div className="mt-2 flex flex-col items-start gap-1">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase border border-emerald-100">{item.phan_loai}</span>
                          {item.isFromVB && (
                            <span className="text-[9px] font-bold text-orange-600 flex items-center gap-1 mt-0.5"><LinkIcon size={10}/> Từ Văn bản</span>
                          )}
                        </div>
                      </td>

                      <td className="py-[35px] pl-[14px] pr-[16px] text-sm font-medium text-gray-700 w-[125px] h-[130px]">
                        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400"/> {item.ngay_ban_hanh ? new Date(item.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}</span>
                      </td>

                      <td className="p-4 w-[410px]">
                        <p className="font-bold text-gray-800 text-[14px] mb-1">{item.tieu_de}</p>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.noi_dung}</p>
                        {item.link_vb && (
                          <a href={item.link_vb} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                            <LinkIcon size={12}/> Mở tài liệu
                          </a>
                        )}
                      </td>

                      <td className="py-4 pl-[6px] pr-[14px] w-[130px] h-[130px]">
                        <span className="px-0 pt-0 pb-[1px] m-0 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold border border-indigo-100">{item.nghiep_vu}</span>
                      </td>

                      <td className="p-4 text-center w-[115px] h-[130px]">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border inline-flex items-center justify-center gap-1 w-[120px] h-[25px] mt-0 mx-auto ${
                          item.hieu_luc === 'Hết hiệu lực' ? 'bg-red-50 text-red-600 border-red-200' : 
                          item.hieu_luc === 'Sắp có hiệu lực' ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                          'bg-green-50 text-green-600 border-green-200'
                        }`}>
                          <CheckCircle2 size={12} className="shrink-0" />
                          <span className="truncate">{item.hieu_luc || 'Còn hiệu lực'}</span>
                        </span>
                      </td>

                      <td className="p-4 w-[130px] h-[130px]">
                        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity w-full max-w-[100px] mx-auto">
                          <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="w-full py-1.5 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                            <Eye size={14} /> Xem
                          </button>
                          
                          <button 
                            onClick={() => item.isFromVB ? handleBlockedAction('Sửa') : openModal('update', item)} 
                            className={`w-full py-1.5 bg-white border border-blue-200 text-blue-600 rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors ${item.isFromVB ? 'opacity-50 hover:bg-white cursor-not-allowed' : 'hover:bg-blue-50'}`}
                          >
                            <Edit size={14} /> Sửa
                          </button>

                          <button 
                            onClick={() => item.isFromVB ? handleBlockedAction('Xóa') : (() => { setItemToDelete(item.id); setIsConfirmOpen(true); })()} 
                            className={`w-full py-1.5 bg-white border border-red-200 text-red-600 rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors ${item.isFromVB ? 'opacity-50 hover:bg-white cursor-not-allowed' : 'hover:bg-red-50'}`}
                          >
                            <Trash2 size={14} /> Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <datalist id="suggest-nghiepvu">{uniqueNghiepvu.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="suggest-phanloai">{uniquePhanloai.map(v => <option key={v} value={v} />)}</datalist>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50 rounded-t-3xl sm:rounded-t-2xl">
              <h3 className="text-xl font-bold text-[#05469B] flex items-center gap-2"><BookOpen size={24}/> {modalMode === 'create' ? 'Ban hành Quy định / Quy trình mới' : 'Cập nhật Tài liệu'}</h3>
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0 custom-scrollbar">
              
              <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-100">
                <h4 className="font-bold text-[#05469B] mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-[#05469B] rounded-full"></div> Phân loại & Hệ thống</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nghiệp vụ áp dụng *</label>
                    <input list="suggest-nghiepvu" type="text" required name="nghiep_vu" value={formData.nghiep_vu || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-indigo-700" placeholder="Kinh doanh, Kế toán, Nhân sự..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phân loại tài liệu *</label>
                    <input list="suggest-phanloai" type="text" required name="phan_loai" value={formData.phan_loai || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="Quy định, Quy trình..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày ban hành *</label>
                    <input type="date" required name="ngay_ban_hanh" value={formData.ngay_ban_hanh || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Hiệu lực</label>
                    <select 
                      name="hieu_luc" 
                      value={formData.hieu_luc || 'Còn hiệu lực'} 
                      onChange={handleInputChange} 
                      className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-bold ${formData.hieu_luc === 'Hết hiệu lực' ? 'text-red-600 bg-red-50' : formData.hieu_luc === 'Sắp có hiệu lực' ? 'text-orange-600 bg-orange-50' : 'text-green-600 bg-green-50'}`}
                    >
                      <option value="Còn hiệu lực">Còn hiệu lực</option>
                      <option value="Sắp có hiệu lực">Sắp có hiệu lực</option>
                      <option value="Hết hiệu lực">Hết hiệu lực</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-gray-400 rounded-full"></div> Nội dung Tài liệu</h4>
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-1/3">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Số hiệu *</label>
                      <input type="text" required name="so_hieu" value={formData.so_hieu || ''} onChange={handleInputChange} className="w-full p-3 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-black text-[#05469B] tracking-wider" placeholder="VD: 01/QĐ-THACO..." />
                    </div>
                    <div className="w-full md:w-2/3">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tiêu đề *</label>
                      <input type="text" required name="tieu_de" value={formData.tieu_de || ''} onChange={handleInputChange} className="w-full p-3 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-lg text-gray-800" placeholder="Nhập tên quy định/quy trình..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Trích yếu nội dung (Mục đích)</label>
                    <textarea name="noi_dung" value={formData.noi_dung || ''} onChange={handleInputChange} rows={3} className="w-full p-3 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none" placeholder="Quy định này ban hành nhằm mục đích..."></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Link File đính kèm (PDF / Drive) *</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input type="url" required name="link_vb" value={formData.link_vb || ''} onChange={handleInputChange} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] text-blue-600 font-medium" placeholder="Dán link văn bản gốc vào đây..." />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-gray-100 flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm">Hủy</button>
                <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Tài Liệu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isViewModalOpen && viewData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[92vh] sm:max-h-[90vh] sm:max-w-3xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 overflow-hidden mt-auto sm:mt-0">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-[#05469B] text-white rounded-t-3xl sm:rounded-t-2xl">
              <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2"><BookOpen size={24}/> Chi tiết Tài liệu</h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-blue-200 hover:text-white rounded-full p-1 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
              {viewData.isFromVB && (
                <div className="mb-4 bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-start gap-2">
                  <Info size={16} className="text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-800 font-medium">Đây là tài liệu được đồng bộ trực tiếp từ mục <strong>Văn bản - Thông báo</strong>. Bạn chỉ có thể xem nội dung tại đây.</p>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="bg-blue-100 text-[#05469B] font-black px-3 py-1 rounded text-lg border border-blue-200">{viewData.so_hieu}</span>
                  <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded text-xs uppercase border border-emerald-200">{viewData.phan_loai}</span>
                  <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded text-xs uppercase border border-indigo-200 flex items-center gap-1"><Briefcase size={12}/> {viewData.nghiep_vu}</span>
                  
                  <span className={`font-bold px-2 py-1 rounded text-xs uppercase border flex items-center gap-1 ${
                    viewData.hieu_luc === 'Hết hiệu lực' ? 'bg-red-100 text-red-700 border-red-200' :
                    viewData.hieu_luc === 'Sắp có hiệu lực' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                    'bg-green-100 text-green-700 border-green-200'
                  }`}>
                    <CheckCircle2 size={12}/> {viewData.hieu_luc || 'Còn hiệu lực'}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-gray-800 leading-tight mt-3">{viewData.tieu_de}</h2>
                <p className="text-sm text-gray-500 mt-2 flex items-center gap-2"><Calendar size={14}/> Ban hành: <span className="font-bold text-gray-700">{viewData.ngay_ban_hanh ? new Date(viewData.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}</span></p>
              </div>

              <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 mb-6 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                {viewData.noi_dung || <span className="italic text-gray-400">Không có trích yếu nội dung.</span>}
              </div>

              {/* 🟢 KHỐI NGƯỜI KÝ & NGHIỆP VỤ BỔ SUNG NẰM NGANG */}
              {viewData.isFromVB && (
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm mb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start justify-between border-b sm:border-b-0 sm:border-r border-gray-100 pb-3 sm:pb-0 sm:pr-4">
                       <span className="text-xs text-gray-500 font-bold flex items-center gap-1.5"><PenTool size={14}/> Người ký:</span>
                       <div className="text-right">
                          <p className="font-bold text-gray-800 text-sm">{viewData.nguoi_ky || '---'}</p>
                          <p className="text-[10px] text-gray-500 uppercase mt-0.5 font-semibold">{viewData.chuc_vu || '---'}</p>
                       </div>
                    </div>
                    <div className="flex items-start justify-between">
                       <span className="text-xs text-gray-500 font-bold flex items-center gap-1.5"><Hash size={14}/> Lấy số bởi:</span>
                       <div className="text-right">
                          <p className="font-bold text-gray-800 text-sm">{viewData.nguoi_lay_so || '---'}</p>
                          <p className="text-[10px] text-gray-500 uppercase mt-0.5 font-semibold">{viewData.bo_phan_lay_so || '---'}</p>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {viewData.link_vb ? (
                  <a href={viewData.link_vb} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 bg-[#05469B] hover:bg-[#04367a] text-white rounded-xl font-bold transition-colors shadow-md">
                    <ExternalLink size={18}/> Mở Tài Liệu Trực Tuyến
                  </a>
                ) : (
                  <button disabled className="flex items-center justify-center gap-2 py-3 bg-gray-200 text-gray-500 rounded-xl font-bold cursor-not-allowed">
                    Không có Link đính kèm
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này sẽ xóa tài liệu này vĩnh viễn.</p>
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