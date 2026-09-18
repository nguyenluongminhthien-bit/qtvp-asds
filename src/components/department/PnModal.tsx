import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Loader2, Briefcase, Save, CheckSquare, Square, Building2 } from 'lucide-react';
import { apiService } from '../../services/api';
// 🟢 Import hàm vẽ cây đơn vị
import { buildHierarchicalOptions, getUnitEmoji } from '../../utils/hierarchy'; 
import { toast } from "../../utils/toast";

const EMPTY_FORM = { id: '', id_don_vi: '', ten_cong_ty: '', ma_so_thue: '', dia_chi: '', gpkd: '', mail: '' };

// 🟢 ĐỊNH NGHĨA CHÍNH XÁC CÁC PROPS NHẬN TỪ DEPARTMENT PAGE
interface Props {
  isOpen: boolean;
  mode: 'create' | 'update';
  currentData: any | null;
  selectedUnitId: string | null;
  unitList: any[]; // 🟢 DANH SÁCH ĐƠN VỊ ĐỂ VẼ DROPDOWN
  onSaved: (data: any, isCreate: boolean) => void;
  onClose: () => void;
}

export default function PnModal({ isOpen, mode, currentData, selectedUnitId, unitList, onSaved, onClose }: Props) {
  // 🟢 MODAL TỰ QUẢN LÝ DỮ LIỆU CỦA NÓ
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State cho dropdown check-list
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi nhấp ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsDropdownOpen(false);
      
      // 🟢 LOGIC TỰ ĐỘNG CHỌN ĐƠN VỊ
      // Nếu là Thêm mới -> Ưu tiên lấy selectedUnitId từ bên ngoài. Nếu sửa -> lấy từ currentData
      const defaultIdDonVi = mode === 'create' ? (selectedUnitId || '') : (currentData?.id_don_vi || '');
      
      setFormData(currentData
        ? { ...currentData, id_don_vi: currentData.id_don_vi || defaultIdDonVi }
        : { ...EMPTY_FORM, id: `PN${Date.now()}`, id_don_vi: defaultIdDonVi }
      );
    }
  }, [isOpen, currentData, selectedUnitId, mode]);

  // Lọc danh sách đơn vị hiển thị trong dropdown (bao gồm đơn vị gốc, các đơn vị con/cháu trực thuộc và các đơn vị đã chọn trước đó)
  const filteredUnits = useMemo(() => {
    if (!selectedUnitId || unitList.length === 0) return unitList;

    // Hàm đệ quy thu thập tất cả ID đơn vị cấp dưới
    const getSubordinateIds = (id: string): string[] => {
      const subs = unitList.filter(u => u.cap_quan_ly === id);
      let ids = subs.map(u => u.id);
      subs.forEach(s => {
        ids = [...ids, ...getSubordinateIds(s.id)];
      });
      return ids;
    };

    const existingIds = String(currentData?.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    const allowedIds = Array.from(new Set([selectedUnitId, ...getSubordinateIds(selectedUnitId), ...existingIds]));
    return unitList.filter(u => allowedIds.includes(u.id));
  }, [unitList, selectedUnitId, currentData]);

  // Danh sách chi tiết các đơn vị đã chọn để vẽ badge
  const selectedUnitObjects = useMemo(() => {
    const selectedIds = String(formData.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    return selectedIds.map(id => {
      const u = unitList.find(x => x.id === id);
      return { id, name: u ? u.ten_don_vi : id, loai_hinh: u?.loai_hinh };
    });
  }, [formData.id_don_vi, unitList]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleUnitToggle = (unitId: string) => {
    const currentSelected = String(formData.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    let newSelected: string[];
    if (currentSelected.includes(unitId)) {
      newSelected = currentSelected.filter(id => id !== unitId);
    } else {
      newSelected = [...currentSelected, unitId];
    }
    setFormData((prev: any) => ({ ...prev, id_don_vi: newSelected.join(',') }));
  };

  // Chọn tất cả đơn vị trực thuộc hiển thị trong danh sách
  const handleSelectAll = () => {
    const allIds = filteredUnits.map(u => u.id);
    const currentSelected = String(formData.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    const combined = Array.from(new Set([...currentSelected, ...allIds]));
    setFormData((prev: any) => ({ ...prev, id_don_vi: combined.join(',') }));
  };

  // Bỏ chọn tất cả đơn vị trong danh sách hiện tại
  const handleClearAll = () => {
    const filteredIdSet = new Set(filteredUnits.map(u => u.id));
    const currentSelected = String(formData.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    const remaining = currentSelected.filter(id => !filteredIdSet.has(id));
    setFormData((prev: any) => ({ ...prev, id_don_vi: remaining.join(',') }));
  };

  const selectedUnitsText = () => {
    if (selectedUnitObjects.length === 0) return "-- Chọn Đơn vị áp dụng --";
    if (selectedUnitObjects.length === 1) return selectedUnitObjects[0].name;
    return `Đã chọn ${selectedUnitObjects.length} đơn vị (${selectedUnitObjects.map(u => u.name).join(', ')})`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    const cleanUnitIds = String(formData.id_don_vi || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const uniqueUnitIds = Array.from(new Set(cleanUnitIds));

    if (uniqueUnitIds.length === 0) return toast.warning("Vui lòng chọn ít nhất một Đơn vị!");

    const payload = {
      ...formData,
      id_don_vi: uniqueUnitIds.join(',')
    };

    setSubmitting(true); setError(null);
    try {
      // 🟢 TỰ GỌI API LƯU DỮ LIỆU
      const response = await apiService.save(payload, mode, 'dm_phap_nhan');
      const savedId = response?.newId || response?.id || payload.id;
      const finalData = { ...payload, id: savedId };
      
      // 🟢 BÁO CÁO LẠI CHO FILE MẸ ĐỂ CẬP NHẬT GIAO DIỆN
      onSaved(finalData, mode === 'create');
      onClose();
      if (mode === 'create') {
        toast.success(`Thêm mới Pháp nhân thành công (áp dụng cho ${uniqueUnitIds.length} đơn vị)!`);
      } else {
        toast.success(`Cập nhật thông tin Pháp nhân thành công (áp dụng cho ${uniqueUnitIds.length} đơn vị)!`);
      }

    } catch (err: any) { 
      console.error(err);
      setError(err.message || 'Lỗi lưu dữ liệu Pháp nhân.'); 
      toast.error(err.message || "Đã xảy ra lỗi khi lưu thông tin Pháp nhân!");
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-orange-100 bg-orange-50 rounded-t-3xl sm:rounded-t-2xl text-orange-900 shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2"><Briefcase size={24}/> {mode === 'create' ? 'Thêm Pháp nhân mới' : 'Cập nhật Pháp nhân'}</h3>
          <button onClick={onClose} disabled={submitting} className="text-orange-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors cursor-pointer"><X className="w-6 h-6" /></button>
        </div>
        {error && <div className="mx-5 mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>}
        
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Tên Công ty (Pháp nhân) *</label>
              <input type="text" required name="ten_cong_ty" value={formData.ten_cong_ty || ''} onChange={handleChange} placeholder="VD: Công ty TNHH MTV Phân phối Ô tô..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500 font-bold text-gray-800" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Mã số thuế (MST) *</label>
              <input type="text" required name="ma_so_thue" value={formData.ma_so_thue || ''} onChange={handleChange} placeholder="Nhập MST..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-700 tracking-widest" />
            </div>
            
            {/* 🟢 Ô CHỌN NHIỀU ĐƠN VỊ TRỰC THUỘC (HỖ TRỢ DÙNG CHUNG CÔNG TY MẸ VÀ CÁC ĐƠN VỊ CON) */}
            <div className="md:col-span-3" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Building2 size={14} className="text-[#05469B]" />
                  <span>Đơn vị áp dụng ({selectedUnitObjects.length}) *</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <CheckSquare size={12} />
                    <span>Chọn tất cả ({filteredUnits.length})</span>
                  </button>
                  <span className="text-gray-300 text-xs">|</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] font-semibold text-gray-500 hover:text-red-600 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Square size={12} />
                    <span>Bỏ chọn</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500 font-bold text-[#05469B] text-left flex justify-between items-center min-h-[42px] cursor-pointer"
                >
                  <span className="truncate block pr-4 text-xs sm:text-sm">{selectedUnitsText()}</span>
                  <span className="text-gray-400 text-xs shrink-0">▼</span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-[#FFFFF0] border border-gray-200 rounded-lg shadow-xl z-50 max-h-[260px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    <div className="p-1 border-b border-gray-200 mb-1 flex items-center justify-between text-[11px] text-gray-500 font-medium">
                      <span>Click để chọn/bỏ chọn từng đơn vị</span>
                      <span>Đã chọn: <strong className="text-orange-600">{selectedUnitObjects.length}</strong></span>
                    </div>

                    {buildHierarchicalOptions(filteredUnits).map(({ unit, prefix }) => {
                      const selectedIds = String(formData.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
                      const isChecked = selectedIds.includes(unit.id);
                      return (
                        <label key={unit.id} className="flex items-center gap-2 p-1.5 hover:bg-orange-50 rounded text-xs font-semibold text-gray-700 cursor-pointer w-full transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleUnitToggle(unit.id)}
                            className="rounded text-orange-600 focus:ring-orange-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          <span className="font-mono text-gray-400 shrink-0 select-none">{prefix}</span>
                          <span className={isChecked ? 'font-bold text-orange-800' : ''}>
                            {getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Danh sách badge các đơn vị đã chọn */}
              {selectedUnitObjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-[90px] overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-200 custom-scrollbar">
                  {selectedUnitObjects.map(item => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                    >
                      <span>{getUnitEmoji(item.loai_hinh)} {item.name}</span>
                      <button
                        type="button"
                        onClick={() => handleUnitToggle(item.id)}
                        className="text-blue-400 hover:text-red-500 hover:bg-blue-100 rounded-full p-0.5 cursor-pointer transition-colors"
                        title={`Bỏ chọn ${item.name}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-1 italic">
                * Có thể chọn đồng thời Công ty mẹ và tất cả các Showroom/Xưởng trực thuộc để dùng chung thông tin Pháp nhân & Hóa đơn.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Địa chỉ đăng ký kinh doanh</label>
              <input type="text" name="dia_chi" value={formData.dia_chi || ''} onChange={handleChange} placeholder="Địa chỉ ghi trên Giấy phép kinh doanh..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Email nhận Hóa đơn</label>
              <input type="email" name="mail" value={formData.mail || ''} onChange={handleChange} placeholder="ketoan@thaco.com.vn..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-600 mb-1">Link Giấy phép Kinh doanh (Drive / File scan)</label>
              <input type="url" name="gpkd" value={formData.gpkd || ''} onChange={handleChange} placeholder="Dán link file đính kèm..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500 text-blue-600" />
            </div>
          </div>
          </div>
          
          {/* FOOTER */}
          <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm cursor-pointer">Hủy</button>
            <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Pháp nhân
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}