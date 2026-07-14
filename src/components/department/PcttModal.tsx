import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, CloudLightning, Users, Shield, HardHat, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from "../../utils/toast";

const EMPTY_FORM = {
  id: '', id_don_vi: '', doi_truong_pctt: '', sl_nhan_su_doi: '', link_pa_pctt: '',
  vi_tri_di_doi: '', ngay_kiem_tra_pctt: '', tinh_trang_ha_tang: 'Đã hoàn thành',
  tinh_trang_bao_hiem: 'Đầy đủ', ngay_cap_nhat_tai_san: '', so_vu_thien_tai: '0',
  link_ho_so_boi_thuong: '', tinh_trang_khac_phuc: 'Không có sự cố', ghi_chu: ''
};

interface Props {
  isOpen: boolean;
  currentData: any | null;
  selectedUnitId: string | null;
  onSaved: (data: any, isCreate: boolean) => void;
  onClose: () => void;
}

export default function PcttModal({ isOpen, currentData, selectedUnitId, onSaved, onClose }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFormData(currentData
        ? { ...currentData, id: currentData.id || '' }
        : { ...EMPTY_FORM, id_don_vi: selectedUnitId || '' }
      );
    }
  }, [isOpen, currentData, selectedUnitId]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setSubmitting(true); 
    setError(null);
    
    let finalData: any = { ...formData };

    // 🟢 Dọn dẹp dữ liệu: Tự động chuyển các chuỗi rỗng thành null
    Object.keys(finalData).forEach(key => {
      if (finalData[key] === '' || finalData[key] === ' ') {
        finalData[key] = null;
      }
    });

    const isCreate = !currentData;
    const mode = isCreate ? 'create' : 'update';
    
    if (isCreate && (!finalData.id || finalData.id === '')) {
      finalData.id = `PT${Date.now()}`;
    }
    
    try {
      await apiService.save(finalData, mode, 'hs_pctt');
      onSaved(finalData, isCreate);
      onClose();
      // 🟢 Thêm thông báo thành công
      if (isCreate) {
        toast.success("Thêm mới hồ sơ PCTT thành công!");
      } else {
        toast.success("Cập nhật hồ sơ PCTT thành công!");
      }

    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu PCTT.'); 
      // 🔴 Thêm thông báo lỗi
      toast.error(err.message || "Đã xảy ra lỗi khi lưu hồ sơ PCTT!");
      
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
        <div className="flex justify-between p-4 sm:p-5 border-b border-blue-100 bg-blue-50 rounded-t-3xl sm:rounded-t-2xl shrink-0">
          <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2"><CloudLightning size={24}/> {formData.id && currentData ? 'Cập nhật Hồ sơ PCTT & Bảo hiểm' : 'Tạo Hồ sơ PCTT'}</h3>
          <button onClick={onClose} disabled={submitting} className="text-blue-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
        </div>
        {error && <div className="mx-5 mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>}
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* CỘT 1 */}
            <div className="space-y-6">
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200 pb-2"><Users size={18}/> 1. Tổ chức Đội PCTT & Phương án</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Đội trưởng chỉ huy PCTT</label><input type="text" name="doi_truong_pctt" value={formData.doi_truong_pctt || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="VD: GĐ Showroom..." /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Lực lượng ứng phó (Người)</label><input type="number" name="sl_nhan_su_doi" value={formData.sl_nhan_su_doi || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div className="col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Vị trí di dời xe & tài sản an toàn</label><textarea name="vi_tri_di_doi" value={formData.vi_tri_di_doi || ''} onChange={handleChange} rows={2} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Mô tả bãi đỗ xe tránh ngập lụt, cây xanh..."></textarea></div>
                  <div className="col-span-2"><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Link Phương án PCTT (PDF/Drive)</label><input type="url" name="link_pa_pctt" value={formData.link_pa_pctt || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 text-blue-600" /></div>
                </div>
              </div>
              <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100 shadow-sm">
                <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2 border-b border-emerald-200 pb-2"><Shield size={18}/> 2. Bảo hiểm & Quản trị Tài sản</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Bảo hiểm mọi rủi ro TS</label><select name="tinh_trang_bao_hiem" value={formData.tinh_trang_bao_hiem || 'Đầy đủ'} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"><option value="Đầy đủ">Đầy đủ</option><option value="Đang thiếu">Đang thiếu / Chưa mua</option></select></div>
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Ngày chốt TS gửi Kế toán</label><input type="date" name="ngay_cap_nhat_tai_san" value={formData.ngay_cap_nhat_tai_san ? formData.ngay_cap_nhat_tai_san.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" title="Chốt biến động kho xe, phụ tùng định kỳ" /></div>
                </div>
              </div>
            </div>

            {/* CỘT 2 */}
            <div className="space-y-6">
              <div className="bg-orange-50/40 p-5 rounded-xl border border-orange-100 shadow-sm">
                <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2 border-b border-orange-200 pb-2"><HardHat size={18}/> 3. Hạ tầng & Bảo trì</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Ngày KT/Bảo trì PCTT</label><input type="date" name="ngay_kiem_tra_pctt" value={formData.ngay_kiem_tra_pctt ? formData.ngay_kiem_tra_pctt.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500" /></div>
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Khơi thông cống / Mái tôn</label><select name="tinh_trang_ha_tang" value={formData.tinh_trang_ha_tang || 'Đã hoàn thành'} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500"><option value="Đã hoàn thành">Đã hoàn thành</option><option value="Chờ xử lý">Chờ xử lý / Tắc nghẽn</option></select></div>
                </div>
              </div>
              <div className="bg-red-50/40 p-5 rounded-xl border border-red-200 shadow-sm">
                <h4 className="font-bold text-red-800 mb-4 flex items-center gap-2 border-b border-red-200 pb-2"><AlertCircle size={18}/> 4. Thiệt hại & Khắc phục</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[10px] font-bold text-red-600 mb-1 uppercase">Số đợt bão lụt / thiên tai</label><input type="number" name="so_vu_thien_tai" value={formData.so_vu_thien_tai || '0'} onChange={handleChange} className="w-full p-2.5 border border-red-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 font-bold text-red-700" /></div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Tình trạng khắc phục</label>
                      <select name="tinh_trang_khac_phuc" value={formData.tinh_trang_khac_phuc || 'Không có sự cố'} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500">
                        <option value="Không có sự cố">Không có sự cố</option>
                        <option value="Đang khắc phục">Đang khắc phục / Đang xử lý</option>
                        <option value="Đã khắc phục">Đã khắc phục / Đã hoàn thành</option>
                        <option value="Chưa khắc phục">Chưa khắc phục</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Link Hồ sơ bảo hiểm (Hình ảnh, xác nhận)</label><input type="url" name="link_ho_so_boi_thuong" value={formData.link_ho_so_boi_thuong || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 text-blue-600" /></div>
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Ghi chú tổn thất</label><textarea name="ghi_chu" value={formData.ghi_chu || ''} onChange={handleChange} rows={2} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 resize-none"></textarea></div>
                </div>
              </div>
            </div>
          </div>

          </div>
          
          {/* FOOTER */}
          <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm">Hủy</button>
            <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu PCTT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}