import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Monitor, Projector, Video } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from "../../utils/toast";


const EMPTY_FORM = {
  id: '', id_don_vi: '', ten_phong_hop: '', vi_tri: '', suc_chua: '', tb_trinh_chieu: '',
  tb_hop_online: false, bang_viet: false, but_viet: '', but_chi: '', tb_chuyen_slide: false, layout: '', ghi_chu: ''
};

interface Props {
  isOpen: boolean;
  mode: 'create' | 'update';
  currentData: any | null;
  selectedUnitId: string | null;
  onSaved: (data: any, isCreate: boolean) => void;
  onClose: () => void;
}

export default function PhModal({ isOpen, mode, currentData, selectedUnitId, onSaved, onClose }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFormData(currentData
        ? { ...currentData, id: currentData.id }
        : { ...EMPTY_FORM, id: `PH${Date.now()}`, id_don_vi: selectedUnitId || '' }
      );
    }
  }, [isOpen, currentData, selectedUnitId]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, type, value } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev: any) => ({ ...prev, [name]: val }));
  };

  const handleButVietChange = (color: string, checked: boolean) => {
    let colors = formData.but_viet ? formData.but_viet.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    if (checked) { if (!colors.includes(color)) colors.push(color); }
    else { colors = colors.filter((c: string) => c !== color); }
    setFormData((prev: any) => ({ ...prev, but_viet: colors.join(', ') }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setSubmitting(true); 
    setError(null);
    
    try {
      // 🟢 Dọn dẹp dữ liệu: Tự động chuyển chuỗi rỗng thành null
      const dataToSave: any = { ...formData };
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === '' || dataToSave[key] === ' ') {
          dataToSave[key] = null;
        }
      });

      const response = await apiService.save(dataToSave, mode, 'dm_phong_hop');
      const savedId = response?.newId || response?.id || dataToSave.id;
      const finalData = { ...dataToSave, id: savedId };
      
      onSaved(finalData, mode === 'create');
      onClose();
      // 🟢 Thêm thông báo thành công (Phân biệt hành động)
      if (mode === 'create') {
        toast.success("Thêm mới phòng họp thành công!");
      } else {
        toast.success("Cập nhật thông tin phòng họp thành công!");
      }

    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu Phòng họp.'); 
      // 🔴 Thêm thông báo lỗi
      toast.error(err.message || "Đã xảy ra lỗi khi lưu thông tin phòng họp!");
      
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-fuchsia-100 bg-fuchsia-50 rounded-t-3xl sm:rounded-t-2xl text-fuchsia-900 shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2"><Monitor size={24}/> {mode === 'create' ? 'Thêm Phòng họp mới' : 'Cập nhật Phòng họp'}</h3>
          <button onClick={onClose} disabled={submitting} className="text-fuchsia-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
        </div>
        
        {error && <div className="mx-5 mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>}
        
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Tên Phòng họp *</label>
              <input type="text" required name="ten_phong_hop" value={formData.ten_phong_hop || ''} onChange={handleChange} placeholder="VD: Phòng họp Tầng 2..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-fuchsia-500 font-bold text-gray-800" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Vị trí *</label>
              <input type="text" required name="vi_tri" value={formData.vi_tri || ''} onChange={handleChange} placeholder="VD: Lầu 2..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-fuchsia-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Sức chứa tối đa (Người) *</label>
              <input type="number" required name="suc_chua" value={formData.suc_chua || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-fuchsia-500" />
            </div>
          </div>
          
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-5">
            <h4 className="text-sm font-bold text-[#05469B] flex items-center gap-2 border-b border-gray-200 pb-2"><Projector size={16}/> Trang thiết bị</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Thiết bị trình chiếu (Loại - Inch)</label>
                <input type="text" name="tb_trinh_chieu" value={formData.tb_trinh_chieu || ''} onChange={handleChange} placeholder="VD: Tivi - 100 inch..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-fuchsia-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Số lượng Bút Laser</label>
                <input type="number" name="but_chi" value={formData.but_chi || ''} onChange={handleChange} placeholder="Nhập số lượng..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-fuchsia-500" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center p-3 border border-gray-200 rounded-lg bg-white cursor-pointer hover:border-fuchsia-500 transition-colors shadow-sm">
                <input type="checkbox" name="tb_hop_online" checked={!!formData.tb_hop_online} onChange={handleChange} className="w-4 h-4 text-fuchsia-600 rounded border-gray-300 mr-2.5 focus:ring-fuchsia-500" />
                <span className="text-xs font-bold text-gray-700">Thiết bị Họp Online</span>
              </label>
              <label className="flex items-center p-3 border border-gray-200 rounded-lg bg-white cursor-pointer hover:border-fuchsia-500 transition-colors shadow-sm">
                <input type="checkbox" name="bang_viet" checked={!!formData.bang_viet} onChange={handleChange} className="w-4 h-4 text-fuchsia-600 rounded border-gray-300 mr-2.5 focus:ring-fuchsia-500" />
                <span className="text-xs font-bold text-gray-700">Bảng viết</span>
              </label>
              <label className="flex items-center p-3 border border-gray-200 rounded-lg bg-white cursor-pointer hover:border-fuchsia-500 transition-colors shadow-sm">
                <input type="checkbox" name="tb_chuyen_slide" checked={!!formData.tb_chuyen_slide} onChange={handleChange} className="w-4 h-4 text-fuchsia-600 rounded border-gray-300 mr-2.5 focus:ring-fuchsia-500" />
                <span className="text-xs font-bold text-gray-700">Bút chuyển slide</span>
              </label>
              
              <div className="flex flex-col justify-center bg-white border border-gray-200 rounded-lg p-2 px-3 shadow-sm">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">MÀU BÚT LÔNG</label>
                <div className="flex gap-3">
                  {['Xanh', 'Đỏ', 'Đen'].map(color => { 
                    const isChecked = formData.but_viet?.includes(color); 
                    return (
                      <label key={color} className="flex items-center cursor-pointer group">
                        <input type="checkbox" checked={!!isChecked} onChange={(e) => handleButVietChange(color, e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500 mr-1" />
                        <span className={`text-xs font-medium transition-colors ${isChecked ? 'text-gray-800 font-bold' : 'text-gray-500 group-hover:text-fuchsia-600'}`}>{color}</span>
                      </label>
                    ) 
                  })}
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Link Layout Phòng (Drive / File PDF)</label>
              <input type="url" name="layout" value={formData.layout || ''} onChange={handleChange} placeholder="Dán link layout..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-fuchsia-500 text-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Ghi chú khác</label>
              <input type="text" name="ghi_chu" value={formData.ghi_chu || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-fuchsia-500" />
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold rounded-xl transition-colors">Hủy</button>
            <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-fuchsia-600 hover:bg-fuchsia-700 font-bold rounded-xl flex items-center gap-2 shadow-md transition-colors">
              {submitting ? <Loader2 className="animate-spin" /> : 'Lưu Phòng Họp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}