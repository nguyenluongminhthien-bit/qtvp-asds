import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Utensils, Briefcase, Pocket } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from "../../utils/toast";

const formatCurrency = (val: string | number | undefined | null) => {
  if (!val) return '';
  return val.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const EMPTY_FORM = {
  id: '', id_don_vi: '', dinh_bien: '', pvhc_khach_cho: '', pvhc_ve_sinh: '',
  hien_huu: '', pvhc_dich_vu: '', vi_tri: '', ncc_dich_vu: '', chi_phi_thue: ''
};

interface Props {
  isOpen: boolean;
  currentData: any | null;
  selectedUnitId: string | null;
  onSaved: (data: any, isCreate: boolean) => void;
  onClose: () => void;
}

export default function PvhcModal({ isOpen, currentData, selectedUnitId, onSaved, onClose }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFormData(currentData
        ? { ...currentData, id: currentData.id || '' }
        : { ...EMPTY_FORM, id: `HC${Date.now()}`, id_don_vi: selectedUnitId || '' }
      );
    }
  }, [isOpen, currentData, selectedUnitId]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'chi_phi_thue' ? value.replace(/\D/g, '') : value;
    setFormData((prev: any) => ({ ...prev, [name]: finalValue }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setSubmitting(true); 
    setError(null);
    
    const khachCho = Number(formData.pvhc_khach_cho) || 0;
    const veSinh = Number(formData.pvhc_ve_sinh) || 0;
    const dichVu = Number(formData.pvhc_dich_vu) || 0;
    let finalData: any = { ...formData, hien_huu: khachCho + veSinh };
    
    // Đã đổi chuỗi rỗng '' thành null cho an toàn với Database
    if (dichVu < 1) { 
      finalData.vi_tri = null; 
      finalData.ncc_dich_vu = null; 
      finalData.chi_phi_thue = null; 
    }

    // 🟢 Dọn dẹp dữ liệu: Tự động chuyển các chuỗi rỗng còn lại thành null
    Object.keys(finalData).forEach(key => {
      if (finalData[key] === '' || finalData[key] === ' ') {
        finalData[key] = null;
      }
    });

    const isCreate = !currentData;
    const mode = isCreate ? 'create' : 'update';
    if (isCreate && (!finalData.id || finalData.id === '')) finalData.id = `HC${Date.now()}`;
    
    try {
      await apiService.save(finalData, mode, 'hs_pvhc');
      onSaved(finalData, isCreate);
      onClose();
      // 🟢 Thêm thông báo thành công
      if (isCreate) {
        toast.success("Thêm mới hồ sơ Hậu cần thành công!");
      } else {
        toast.success("Cập nhật hồ sơ Hậu cần thành công!");
      }

    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu Hậu cần.'); 
      // 🔴 Thêm thông báo lỗi
      toast.error(err.message || "Đã xảy ra lỗi khi lưu hồ sơ Hậu cần!");
      
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] sm:max-w-2xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-emerald-100 bg-emerald-50 rounded-t-3xl sm:rounded-t-2xl text-emerald-900 shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2"><Utensils size={24}/> Cập nhật Phục vụ Hậu cần</h3>
          <button onClick={onClose} disabled={submitting} className="text-emerald-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors ml-1"><X className="w-6 h-6" /></button>
        </div>
        {error && <div className="mx-5 mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>}
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
          <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100">
            <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2 border-b border-emerald-200 pb-2"><Pocket size={18}/> 1. Lực lượng Nội bộ</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div><label className="block text-xs font-bold text-gray-700 mb-1">Định biên (Người) *</label><input type="number" required name="dinh_bien" value={formData.dinh_bien || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
              <div><label className="block text-xs font-bold text-gray-700 mb-1">NV Khách chờ</label><input type="number" name="pvhc_khach_cho" value={formData.pvhc_khach_cho || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
              <div><label className="block text-xs font-bold text-gray-700 mb-1">NV PVHC (Vệ sinh-5S)</label><input type="number" name="pvhc_ve_sinh" value={formData.pvhc_ve_sinh || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
            </div>
            <p className="text-[10px] text-gray-500 mt-3 italic">* Hệ thống sẽ tự tính <strong>Hiện hữu</strong> = Khách chờ + Vệ sinh</p>
          </div>

          <div className="bg-orange-50/50 p-5 rounded-xl border border-orange-100">
            <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2 border-b border-orange-200 pb-2"><Briefcase size={18}/> 2. Dịch vụ Thuê ngoài</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
              <div><label className="block text-xs font-bold text-gray-700 mb-1">Số lượng Thuê ngoài (Người)</label><input type="number" name="pvhc_dich_vu" value={formData.pvhc_dich_vu || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500" /></div>
              {Number(formData.pvhc_dich_vu) > 0 && <div className="animate-in fade-in"><label className="block text-xs font-bold text-gray-700 mb-1">Vị trí đảm nhận *</label><input type="text" required name="vi_tri" value={formData.vi_tri || ''} onChange={handleChange} placeholder="VD: Khách chờ, Vệ sinh-5S..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500" /></div>}
            </div>
            {Number(formData.pvhc_dich_vu) > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-orange-100 animate-in fade-in">
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Nhà cung cấp *</label><input type="text" required name="ncc_dich_vu" value={formData.ncc_dich_vu || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500" /></div>
                <div><label className="block text-xs font-bold text-red-600 mb-1">Chi phí thuê / tháng (VNĐ) *</label><input type="text" required name="chi_phi_thue" value={formatCurrency(formData.chi_phi_thue)} onChange={handleChange} className="w-full p-2.5 border border-red-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 font-bold text-red-600" /></div>
              </div>
            )}
          </div>

          </div>
          
          {/* FOOTER */}
          <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm">Hủy</button>
            <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Hậu Cần
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
