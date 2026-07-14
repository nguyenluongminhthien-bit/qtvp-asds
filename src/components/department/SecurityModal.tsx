import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Shield, Camera, Users, Link as LinkIcon, Compass, Clock, Sun, Moon, FileText } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from "../../utils/toast";

const formatPhoneNumber = (val: string | number | undefined | null) => {
  if (!val) return '';
  const cleaned = val.toString().replace(/\D/g, '');
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
};

const formatCurrency = (val: string | number | undefined | null) => {
  if (!val) return '';
  return val.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// 🟢 TÍCH HỢP BIẾN GIA HẠN THÊM VÀO LOGIC TÍNH NGÀY HẾT HẠN
const renderContractWarning = (ngayKy: any, soThang: any, giaHanThem: any) => {
  if (!ngayKy || !soThang) return null;
  const startDate = new Date(ngayKy);
  if (isNaN(startDate.getTime())) return null;
  
  const endDate = new Date(startDate);
  // Cộng dồn số tháng Hợp đồng + Số tháng gia hạn
  const totalMonths = Number(soThang) + Number(giaHanThem || 0); 
  endDate.setMonth(endDate.getMonth() + totalMonths);
  
  const today = new Date(); today.setHours(0, 0, 0, 0); endDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const endFormat = endDate.toLocaleDateString('vi-VN');
  
  if (diffDays < 0) return <p className="text-[11px] text-red-600 font-bold bg-red-100 px-2 py-1 rounded-md mt-2 w-max shadow-sm border border-red-200">Đã hết hạn ({endFormat})</p>;
  if (diffDays <= 30) return <p className="text-[11px] text-orange-600 font-bold bg-orange-100 px-2 py-1 rounded-md mt-2 animate-pulse w-max shadow-sm border border-orange-200">⚠️ Sắp hết ({diffDays} ngày - {endFormat})</p>;
  return <p className="text-[11px] text-emerald-700 font-bold mt-2 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 w-max shadow-sm">Hạn HĐ (Đã cộng {giaHanThem || 0} tháng gia hạn): {endFormat}</p>;
};

// 🟢 BỔ SUNG TRƯỜNG GIA HẠN THÊM VÀ CÁC TRƯỜNG HÀNG RÀO VÀO DỮ LIỆU GỐC
const EMPTY_FORM = {
  id: '', id_don_vi: '', bv_noi_bo: '', bv_dich_vu: '', vi_tri_bv_dv: '', ncc_dich_vu: '',
  chi_phi_thue: '', ngay_ky_hd: '', han_hop_dong: '', gia_han_them: '', tong_bv: '', dinh_bien_bv: '',
  ngay_co_dinh: '', ngay_tuan_tra: '', dem_co_dinh: '', dem_tuan_tra: '', bo_tri_nghi_ca: '',
  sl_camera: '', camera_hoat_dong: '', camera_hu: '', ly_do_camera_hu: '', thoi_gian_luu: '',
  vi_tri_he_thong_camera: '', vi_tri_gs_camera: '', link_pa_anbv: '', tinh_hinh_khu_vuc: '',
  tiep_giap_truoc: '', tiep_giap_sau: '', tiep_giap_trai: '', tiep_giap_phai: '',
  hang_rao_truoc: '', hang_rao_sau: '', hang_rao_trai: '', hang_rao_phai: ''
};

interface Props {
  isOpen: boolean;
  currentData: any | null;
  selectedUnitId: string | null;
  onSaved: (data: any, isCreate: boolean) => void;
  onClose: () => void;
}

export default function SecurityModal({ isOpen, currentData, selectedUnitId, onSaved, onClose }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (currentData) {
        setFormData({ ...currentData, id: currentData.id || '' });
      } else {
        setFormData({ ...EMPTY_FORM, id: `AN${Date.now()}`, id_don_vi: selectedUnitId || '' });
      }
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
    
    const soNB = Number(formData.bv_noi_bo) || 0;
    const soDV = Number(formData.bv_dich_vu) || 0;
    let finalData: any = { ...formData, tong_bv: soNB + soDV };
    
    // Đã đổi chuỗi rỗng '' thành null cho an toàn với Database
    if (soDV < 1) { 
      finalData.vi_tri_bv_dv = null; 
      finalData.ncc_dich_vu = null; 
      finalData.chi_phi_thue = null; 
      finalData.gia_han_them = null; 
    }

    // 🟢 Dọn dẹp dữ liệu: Tự động chuyển các chuỗi rỗng còn lại thành null
    Object.keys(finalData).forEach(key => {
      if (finalData[key] === '' || finalData[key] === ' ') {
        finalData[key] = null;
      }
    });

    const isCreate = !currentData;
    const mode = isCreate ? 'create' : 'update';
    if (isCreate && (!finalData.id || finalData.id === '')) finalData.id = `AN${Date.now()}`;
    
    try {
      await apiService.save(finalData, mode, 'hs_an_ninh');
      onSaved(finalData, isCreate);
      onClose();
      // 🟢 Thêm thông báo thành công
      if (isCreate) {
        toast.success("Thêm mới hồ sơ An ninh thành công!");
      } else {
        toast.success("Cập nhật hồ sơ An ninh thành công!");
      }

    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu An Ninh.'); 
      // 🔴 Thêm thông báo lỗi
      toast.error(err.message || "Đã xảy ra lỗi khi lưu hồ sơ An ninh!");
      
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
        
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-indigo-100 bg-[#eef2ff] rounded-t-3xl sm:rounded-t-2xl text-indigo-900 shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Shield size={24} className="text-[#05469B]"/> 
            <span className="text-[#05469B]">{currentData ? 'Cập nhật An ninh & Hệ thống Camera' : 'Khai báo Hồ sơ An ninh & Camera'}</span>
          </h3>
          <button onClick={onClose} disabled={submitting} className="text-indigo-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors border border-indigo-100"><X className="w-6 h-6" /></button>
        </div>
        
        {error && <div className="mx-5 mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>}
        
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#f4f7f9]">
          
          {/* PHẦN 1: LỰC LƯỢNG BẢO VỆ */}
          <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm">
            <h4 className="font-bold text-[#05469B] mb-5 text-sm flex items-center gap-2 border-b border-blue-50 pb-3">
              <Users size={18} className="text-[#05469B]"/> Lực lượng Bảo vệ
            </h4>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">Định biên ANBV (Người)</label><input type="number" name="dinh_bien_bv" value={formData.dinh_bien_bv || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#05469B] transition-colors" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">Bảo vệ Nội bộ (Người)</label><input type="number" name="bv_noi_bo" value={formData.bv_noi_bo || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#05469B] transition-colors" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">Bảo vệ Dịch vụ (Người)</label><input type="number" name="bv_dich_vu" value={formData.bv_dich_vu || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#05469B] transition-colors" /></div>
              </div>
              
              {/* CHI TIẾT THUÊ NGOÀI */}
              {Number(formData.bv_dich_vu) > 0 && (
                <div className="space-y-5 animate-in fade-in pt-3 border-t border-dashed border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Nhà cung cấp BV</label>
                      <input type="text" name="ncc_dich_vu" value={formData.ncc_dich_vu || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#05469B] transition-colors" placeholder="VD: CTy CP Bảo vệ Chuyên nghiệp Yuki Sepre 24" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-600 mb-1.5">Chi phí thuê (VNĐ/Tháng)</label>
                      <input type="text" name="chi_phi_thue" value={formatCurrency(formData.chi_phi_thue)} onChange={handleChange} className="w-full p-2.5 border border-red-200 bg-red-50 text-red-600 font-bold rounded-lg outline-none focus:border-red-400 transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 items-start">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Ngày ký HĐ thuê</label>
                      <input type="date" name="ngay_ky_hd" value={formData.ngay_ky_hd ? formData.ngay_ky_hd.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#05469B] transition-colors text-sm font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Thời hạn HĐ (tháng)</label>
                      <input type="number" name="han_hop_dong" value={formData.han_hop_dong || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#05469B] transition-colors text-sm" placeholder="VD: 12" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#05469B] mb-1.5">Gia hạn thêm (tháng)</label>
                      <input type="number" name="gia_han_them" value={formData.gia_han_them || ''} onChange={handleChange} className="w-full p-2.5 border border-blue-200 bg-blue-50 text-[#05469B] font-bold rounded-lg outline-none focus:border-[#05469B] transition-colors text-sm" placeholder="VD: 6" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Vị trí (Mô tả)</label>
                      <input type="text" name="vi_tri_bv_dv" value={formData.vi_tri_bv_dv || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-[#05469B] transition-colors text-sm" placeholder="VD: Ca đêm (12 giờ/ngày/tháng)" />
                    </div>
                  </div>
                  <div className="-mt-2">{renderContractWarning(formData.ngay_ky_hd, formData.han_hop_dong, formData.gia_han_them)}</div>
                </div>
              )}
            </div>
          </div>

          {/* PHẦN 2: BỐ TRÍ CA TRỰC (Tất cả 5 cột trên 1 hàng) */}
          <div className="bg-[#fffbeb] p-6 rounded-xl border border-amber-200 shadow-sm flex flex-col">
            <h4 className="font-bold text-[#b45309] mb-5 text-sm flex items-center gap-2 border-b border-amber-200/50 pb-3">
              <Clock size={18}/> Bố trí Ca trực
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-2">
              <div><label className="block text-[10px] font-bold text-[#d97706] uppercase mb-1.5 flex items-center gap-1"><Sun size={12}/> Ngày (Cố định)</label><input type="number" name="ngay_co_dinh" value={formData.ngay_co_dinh || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors bg-white font-bold" /></div>
              <div><label className="block text-[10px] font-bold text-[#d97706] uppercase mb-1.5 flex items-center gap-1"><Sun size={12}/> Ngày (Tuần tra)</label><input type="number" name="ngay_tuan_tra" value={formData.ngay_tuan_tra || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors bg-white font-bold" /></div>
              <div><label className="block text-[10px] font-bold text-[#4f46e5] uppercase mb-1.5 flex items-center gap-1"><Moon size={12}/> Đêm (Cố định)</label><input type="number" name="dem_co_dinh" value={formData.dem_co_dinh || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-indigo-400 transition-colors bg-white font-bold" /></div>
              <div><label className="block text-[10px] font-bold text-[#4f46e5] uppercase mb-1.5 flex items-center gap-1"><Moon size={12}/> Đêm (Tuần tra)</label><input type="number" name="dem_tuan_tra" value={formData.dem_tuan_tra || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-indigo-400 transition-colors bg-white font-bold" /></div>
              <div><label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase">Bố trí nghỉ ca / Đổi ca</label><input type="text" name="bo_tri_nghi_ca" value={formData.bo_tri_nghi_ca || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors bg-white font-medium" /></div>
            </div>
          </div>

          {/* PHẦN 3: HỆ THỐNG CAMERA GIÁM SÁT */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <h4 className="font-bold text-gray-800 mb-5 text-sm flex items-center gap-2 border-b border-gray-100 pb-3">
              <Camera size={18}/> Hệ thống Camera Giám sát
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-5">
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Tổng SL (Mắt)</label><input type="number" name="sl_camera" value={formData.sl_camera || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-colors text-gray-800 bg-white" /></div>
              <div><label className="block text-[10px] font-bold text-emerald-600 mb-1.5 uppercase">Hoạt động</label><input type="number" name="camera_hoat_dong" value={formData.camera_hoat_dong || ''} onChange={handleChange} className="w-full p-2.5 border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold rounded-lg outline-none focus:border-emerald-400 transition-colors" /></div>
              <div><label className="block text-[10px] font-bold text-red-600 mb-1.5 uppercase">Hư hỏng</label><input type="number" name="camera_hu" value={formData.camera_hu || ''} onChange={handleChange} className="w-full p-2.5 border border-red-200 bg-red-50 text-red-700 font-bold rounded-lg outline-none focus:border-red-400 transition-colors" /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Lưu hình (Ngày)</label><input type="number" name="thoi_gian_luu" value={formData.thoi_gian_luu || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-colors text-gray-800 bg-white" /></div>
            </div>
            
            {Number(formData.camera_hu) > 0 && (
              <div className="mb-5 p-4 border border-red-200 rounded-lg bg-red-50/50 animate-in fade-in">
                <label className="block text-[10px] font-bold text-red-700 mb-2 uppercase">Lý do Camera hư/hỏng</label>
                <select value={formData.ly_do_camera_hu && !['Sự cố nguồn điện', 'Dây tín hiệu và Jack kết nối', 'Lỗi phần cứng Camera', 'Lỗi đầu ghi (DVR/NVR) và Lưu trữ', 'Vấn đề phần mềm & Mạng'].includes(formData.ly_do_camera_hu) ? 'Khác' : (formData.ly_do_camera_hu || '')} onChange={(e) => { const val = e.target.value; setFormData({...formData, ly_do_camera_hu: val === 'Khác' ? 'Khác' : val}); }} className="w-full p-2.5 border border-red-300 rounded-lg outline-none focus:border-red-400 text-sm font-bold text-red-800 mb-3 bg-white transition-colors">
                  <option value="">-- Chọn lý do --</option>
                  <option value="Sự cố nguồn điện">Sự cố nguồn điện</option>
                  <option value="Dây tín hiệu và Jack kết nối">Dây tín hiệu và Jack kết nối</option>
                  <option value="Lỗi phần cứng Camera">Lỗi phần cứng Camera</option>
                  <option value="Lỗi đầu ghi (DVR/NVR) và Lưu trữ">Lỗi đầu ghi (DVR/NVR) và Lưu trữ</option>
                  <option value="Vấn đề phần mềm & Mạng">Vấn đề phần mềm & Mạng</option>
                  <option value="Khác">Khác (Nhập lý do cụ thể...)</option>
                </select>
                {(formData.ly_do_camera_hu && !['Sự cố nguồn điện', 'Dây tín hiệu và Jack kết nối', 'Lỗi phần cứng Camera', 'Lỗi đầu ghi (DVR/NVR) và Lưu trữ', 'Vấn đề phần mềm & Mạng', ''].includes(formData.ly_do_camera_hu)) && (
                  <input type="text" value={formData.ly_do_camera_hu === 'Khác' ? '' : formData.ly_do_camera_hu} onChange={(e) => setFormData({...formData, ly_do_camera_hu: e.target.value || 'Khác'})} placeholder="Gõ lý do hư hỏng cụ thể..." className="w-full p-2.5 border border-red-300 rounded-lg bg-white outline-none focus:border-red-400 text-sm transition-colors" />
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-auto">
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Vị trí đặt hệ thống (Đầu ghi)</label><input type="text" name="vi_tri_he_thong_camera" value={formData.vi_tri_he_thong_camera || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-colors bg-white font-medium" /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Vị trí giám sát chính</label><input type="text" name="vi_tri_gs_camera" value={formData.vi_tri_gs_camera || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-colors bg-white font-medium" /></div>
            </div>
          </div>

          {/* PHẦN 4: ĐẶC ĐIỂM ĐỊA BÀN */}
          <div className="bg-[#f0fdf4] p-6 rounded-xl border border-emerald-200 shadow-sm">
            <h4 className="font-bold text-[#047857] mb-5 text-sm flex items-center gap-2 border-b border-emerald-200/50 pb-3">
              <Compass size={18}/> Đặc điểm Địa bàn
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-5">
              {/* TRƯỚC */}
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Tiếp giáp Trước</label>
                  <input type="text" name="tiep_giap_truoc" value={formData.tiep_giap_truoc || ''} onChange={handleChange} placeholder="VD: Quốc lộ 1A" className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 transition-colors bg-white font-medium" />
                </div>
                <div>
                  <input type="text" name="hang_rao_truoc" value={formData.hang_rao_truoc || ''} onChange={handleChange} placeholder="Mô tả hàng rào, tường bao..." className="w-full p-2 border border-dashed border-gray-300 rounded-lg outline-none focus:border-emerald-400 transition-colors bg-white text-xs font-medium text-gray-600" />
                </div>
              </div>

              {/* SAU */}
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Tiếp giáp Sau</label>
                  <input type="text" name="tiep_giap_sau" value={formData.tiep_giap_sau || ''} onChange={handleChange} placeholder="VD: Nhà dân" className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 transition-colors bg-white font-medium" />
                </div>
                <div>
                  <input type="text" name="hang_rao_sau" value={formData.hang_rao_sau || ''} onChange={handleChange} placeholder="Mô tả hàng rào, tường bao..." className="w-full p-2 border border-dashed border-gray-300 rounded-lg outline-none focus:border-emerald-400 transition-colors bg-white text-xs font-medium text-gray-600" />
                </div>
              </div>

              {/* TRÁI */}
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Tiếp giáp Trái</label>
                  <input type="text" name="tiep_giap_trai" value={formData.tiep_giap_trai || ''} onChange={handleChange} placeholder="VD: Bãi đất trống" className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 transition-colors bg-white font-medium" />
                </div>
                <div>
                  <input type="text" name="hang_rao_trai" value={formData.hang_rao_trai || ''} onChange={handleChange} placeholder="Mô tả hàng rào, tường bao..." className="w-full p-2 border border-dashed border-gray-300 rounded-lg outline-none focus:border-emerald-400 transition-colors bg-white text-xs font-medium text-gray-600" />
                </div>
              </div>

              {/* PHẢI */}
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Tiếp giáp Phải</label>
                  <input type="text" name="tiep_giap_phai" value={formData.tiep_giap_phai || ''} onChange={handleChange} placeholder="VD: Xưởng công nghiệp" className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 transition-colors bg-white font-medium" />
                </div>
                <div>
                  <input type="text" name="hang_rao_phai" value={formData.hang_rao_phai || ''} onChange={handleChange} placeholder="Mô tả hàng rào, tường bao..." className="w-full p-2 border border-dashed border-gray-300 rounded-lg outline-none focus:border-emerald-400 transition-colors bg-white text-xs font-medium text-gray-600" />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-[#047857] mb-1.5 uppercase">Đánh giá Tình hình ANTT Khu vực</label>
              <input type="text" name="tinh_hinh_khu_vuc" value={formData.tinh_hinh_khu_vuc || ''} onChange={handleChange} className="w-full p-2.5 border border-emerald-200 rounded-lg outline-none focus:border-emerald-400 transition-colors bg-white font-medium" />
            </div>
          </div>

          {/* PHẦN 5: PHƯƠNG ÁN ANBV */}
          <div className="bg-white p-6 rounded-xl border border-purple-100 shadow-sm">
            <h4 className="font-bold text-purple-700 mb-5 text-sm flex items-center gap-2 border-b border-purple-50 pb-3">
              <FileText size={18}/> Phương án ANBV
            </h4>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Link Phương án ANBV (Drive/PDF)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                <input type="url" name="link_pa_anbv" value={formData.link_pa_anbv || ''} onChange={handleChange} placeholder="Dán link..." className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-blue-600 font-medium outline-none focus:border-purple-400 transition-colors" />
              </div>
            </div>
          </div>

          </div>
          
          {/* FOOTER */}
          <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm">Hủy</button>
            <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Hồ Sơ An Ninh
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}