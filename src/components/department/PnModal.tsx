import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Loader2, Briefcase } from 'lucide-react';
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

  // Lọc danh sách đơn vị chỉ hiển thị đơn vị gốc và các con/cháu trực thuộc
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

    const allowedIds = [selectedUnitId, ...getSubordinateIds(selectedUnitId)];
    return unitList.filter(u => allowedIds.includes(u.id));
  }, [unitList, selectedUnitId]);

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

  const selectedUnitsText = () => {
    const selectedIds = String(formData.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    if (selectedIds.length === 0) return "-- Chọn Đơn vị --";
    const names = selectedIds.map(id => {
      const u = unitList.find(x => x.id === id);
      return u ? u.ten_don_vi : id;
    });
    return names.join(', ');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!formData.id_don_vi) return toast.warning("Vui lòng chọn ít nhất một Đơn vị!");

    setSubmitting(true); setError(null);
    try {
      // 🟢 TỰ GỌI API LƯU DỮ LIỆU
      const response = await apiService.save(formData, mode, 'dm_phap_nhan');
      const savedId = response?.newId || response?.id || formData.id;
      const finalData = { ...formData, id: savedId };
      
      // 🟢 BÁO CÁO LẠI CHO FILE MẸ ĐỂ CẬP NHẬT GIAO DIỆN
      onSaved(finalData, mode === 'create');
      onClose();
      if (mode === 'create') {
        toast.success("Thêm mới Pháp nhân thành công!");
      } else {
        toast.success("Cập nhật thông tin Pháp nhân thành công!");
      }

    } catch (err: any) { 
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
          <button onClick={onClose} disabled={submitting} className="text-orange-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm"><X className="w-6 h-6" /></button>
        </div>
        {error && <div className="mx-5 mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>}
        
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Tên Công ty (Pháp nhân) *</label>
              <input type="text" required name="ten_cong_ty" value={formData.ten_cong_ty || ''} onChange={handleChange} placeholder="VD: Công ty TNHH MTV Phân phối Ô tô..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500 font-bold text-gray-800" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Mã số thuế (MST) *</label>
              <input type="text" required name="ma_so_thue" value={formData.ma_so_thue || ''} onChange={handleChange} placeholder="Nhập MST..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-700 tracking-widest" />
            </div>
            
            {/* 🟢 Ô CHỌN NHIỀU ĐƠN VỊ LỌC THEOselectedUnitId */}
            <div className="md:col-span-3" ref={dropdownRef}>
              <label className="block text-xs font-bold text-gray-600 mb-1">Đơn vị *</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500 font-bold text-[#05469B] text-left flex justify-between items-center min-h-[42px]"
                >
                  <span className="truncate block pr-4">{selectedUnitsText()}</span>
                  <span className="text-gray-400 text-xs shrink-0">▼</span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-[#FFFFF0] border border-gray-200 rounded-lg shadow-lg z-50 max-h-[220px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {buildHierarchicalOptions(filteredUnits).map(({ unit, prefix }) => {
                      const selectedIds = String(formData.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
                      const isChecked = selectedIds.includes(unit.id);
                      return (
                        <label key={unit.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-200/60 rounded text-xs font-semibold text-gray-700 cursor-pointer w-full">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleUnitToggle(unit.id)}
                            className="rounded text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
                          />
                          <span className="font-mono text-gray-400 shrink-0 select-none">{prefix}</span>
                          <span>{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
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
          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold rounded-xl transition-colors">Hủy</button>
            <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-orange-600 hover:bg-orange-700 font-bold rounded-xl flex items-center gap-2 shadow-md transition-colors">
              {submitting ? <Loader2 className="animate-spin" size={18}/> : 'Lưu Pháp nhân'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}