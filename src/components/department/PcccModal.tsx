import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Flame, Plus, Trash2, PlusCircle, Siren, Droplets, PhoneCall, FileText, Users, Sun, Moon, Link as LinkIcon } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from "../../utils/toast";


const formatPhoneNumber = (val: string | number | undefined | null) => {
  if (!val) return '';
  const cleaned = val.toString().replace(/\D/g, '');
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
};

const normalizeDateToISO = (val: any) => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(str)) {
    const parts = str.split(/[\/\-]/);
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str;
};

const PCCC_SYSTEMS = [
  { key: 'he_thong_bao_chay_tu_dong', label: 'Hệ thống Báo cháy tự động', Icon: Siren, color: 'text-orange-500' },
  { key: 'he_thong_chua_chay_tu_dong_nuoc', label: 'Hệ thống Chữa cháy tự động', Icon: Droplets, color: 'text-blue-500' },
  { key: 'he_thong_chua_chay_nuoc', label: 'Hệ thống Chữa cháy vách tường', Icon: Droplets, color: 'text-cyan-500' },
  { key: 'dung_cu_pccc', label: 'Dụng cụ CC & CNCH', Icon: Flame, color: 'text-red-500' },
];

const EMERGENCY_CONTACTS = [
  { key: 'sdt_pccc', label: 'Báo cháy / CNCH', def: '114', color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'sdt_ca_pccc_catt', label: 'CS PCCC Quản lý', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_ub', label: 'UBND Xã/Phường', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_cax', label: 'Công an Xã/Phường', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_dien_luc', label: 'Đơn vị Điện lực', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_cap_thoat_nuoc', label: 'Đơn vị Cấp nước', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_yte', label: 'Cơ quan Y tế', def: '', color: 'text-gray-800', bg: 'bg-white' },
];

const getAvailableEquipmentGroups = (form: any) => {
  let groups = new Set<string>();
  PCCC_SYSTEMS.forEach(sys => {
    const val = form[sys.key] || (sys.key === 'he_thong_chua_chay_tu_dong_nuoc' ? 'Không' : 'Có');
    if (val === 'Có') groups.add(sys.label);
  });
  return Array.from(groups);
};

const EMPTY_FORM = {
  id: '', id_don_vi: '', giay_phep_pccc: 'Nghiệm thu', bao_hiem_chay_no: 'Có', ngay_het_han_bh: '',
  ho_ten_doi_truong: '', sdt_doi_truong: '', chuc_vu: '', tong_sl_thanh_vien: '',
  sl_huy_dong_ban_ngay: '', sl_huy_dong_ban_dem: '', ngay_dien_tap: '', link_phuong_an_pccc: '',
  sdt_pccc: '114', sdt_ub: '', sdt_ca_pccc_catt: '', sdt_cax: '', sdt_dien_luc: '',
  sdt_cap_thoat_nuoc: '', sdt_yte: '', he_thong_bao_chay_tu_dong: 'Có', he_thong_chua_chay_tu_dong_nuoc: 'Không',
  he_thong_chua_chay_nuoc: 'Có', dung_cu_pccc: 'Có', khu_vuc_rui_ro_cao: '', loi_ton_tai_chua_khac_phuc: '', ghi_chu: ''
};

interface Props {
  isOpen: boolean;
  pcccMode: 'create' | 'update' | 'view';
  currentData: any | null;
  currentEquipment: any[];
  selectedUnitId: string | null;
  donViMap?: Record<string, string>; // 🟢 Sửa thành tham số không bắt buộc
  onSaved: (pcccData: any, equipmentData: any[], isCreate: boolean) => void;
  onClose: () => void;
}

// 🟢 Cấp giá trị mặc định donViMap = {} để chống lỗi undefined
export default function PcccModal({ isOpen, pcccMode, currentData, currentEquipment, selectedUnitId, donViMap = {}, onSaved, onClose }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [deletedEqIds, setDeletedEqIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDeletedEqIds([]);
      if (currentData && pcccMode !== 'create') {
        setFormData({ ...currentData, id: currentData.id || '' });
        setEquipmentList(currentEquipment.map(e => ({ ...e })));
      } else {
        setFormData({ ...EMPTY_FORM, id: `PC${Date.now()}`, id_don_vi: selectedUnitId || '' });
        setEquipmentList([]);
      }
    }
  }, [isOpen, currentData, currentEquipment, selectedUnitId, pcccMode]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const finalValue = (name.includes('sdt') || name.includes('std')) ? formatPhoneNumber(value) : value;
    setFormData((prev: any) => ({ ...prev, [name]: finalValue }));
  };

  const handleAddEquipment = () => {
    const defaultGroup = getAvailableEquipmentGroups(formData)[0] || '';
    setEquipmentList(prev => [...prev, {
      id: '', id_don_vi: '', nhom_he_thong: defaultGroup, loai_thiet_bi: '', so_luong: '',
      don_vi_tinh: 'Cái', vi_tri_bo_tri: '', ngay_bom_sac: '', ngay_het_han: '', tinh_trang: 'Hoạt động tốt'
    }]);
  };

  const handleEquipmentChange = (index: number, field: string, value: string) => {
    const newList = [...equipmentList]; newList[index][field] = value; setEquipmentList(newList);
  };

  const handleRemoveEquipment = (index: number) => {
    const eq = equipmentList[index];
    if (eq.id) setDeletedEqIds(prev => [...prev, eq.id]);
    setEquipmentList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setSubmitting(true); 
    setError(null);
    
    let finalData: any = { ...formData };

    // 🟢 Dọn dẹp dữ liệu Hồ sơ: Tự động chuyển các chuỗi rỗng thành null
    Object.keys(finalData).forEach(key => {
      if (finalData[key] === '' || finalData[key] === ' ') {
        finalData[key] = null;
      }
    });

    const isCreate = pcccMode === 'create';
    if (isCreate && (!finalData.id || finalData.id === '')) {
      finalData.id = `PC${Date.now()}`;
    }
    
    try {
      await apiService.save(finalData, pcccMode === 'view' ? 'update' : pcccMode, 'hs_pccc');
      
      for (const delId of deletedEqIds) { 
        await apiService.delete(delId, 'ts_pccc'); 
      }
      
      if (equipmentList.length > 0) {
        const eqToSave = equipmentList.map((eq, i) => {
          const cleaned: any = { ...eq, id_don_vi: finalData.id_don_vi };
          
          // 🟢 Dọn dẹp dữ liệu Thiết bị: Tự động chuyển các chuỗi rỗng thành null
          Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === '' || cleaned[key] === ' ') {
              cleaned[key] = null;
            }
          });

          if (!cleaned.id || cleaned.id === '') cleaned.id = `EQ${Date.now()}${i}`;
          return cleaned;
        });
        await apiService.save(eqToSave, 'update', 'ts_pccc');
      }
      
      onSaved(finalData, equipmentList, isCreate);
      onClose();
      // 🟢 Thêm thông báo thành công
      if (isCreate) {
        toast.success("Thêm mới hồ sơ PCCC thành công!");
      } else {
        toast.success("Cập nhật hồ sơ PCCC thành công!");
      }

    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu PCCC.'); 
      // 🔴 Thêm thông báo lỗi
      toast.error(err.message || "Đã xảy ra lỗi khi lưu hồ sơ PCCC!");
      
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-6xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 overflow-x-hidden mt-auto sm:mt-0 overflow-hidden">
        <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-red-50 rounded-t-3xl sm:rounded-t-2xl shrink-0">
          <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
            <Flame size={24}/> {pcccMode === 'create' ? 'Tạo Hồ sơ PCCC Mới' : pcccMode === 'view' ? 'Chi tiết Hồ sơ PCCC' : 'Cập nhật Hồ sơ PCCC'}
          </h3>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar bg-[#f8fafc]">
            <fieldset disabled={pcccMode === 'view'} className="space-y-6 border-0 m-0 p-0">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. PHÁP LÝ & BẢO HIỂM */}
                <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm h-full flex flex-col">
                  <h4 className="font-bold text-[#05469B] mb-5 flex items-center gap-2 border-b border-blue-50 pb-3"><FileText size={18}/> 1. Pháp lý & Bảo hiểm</h4>
                  <div className="space-y-5 flex-1">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Đơn vị / Cơ sở *</label>
                      <select required name="id_don_vi" value={formData.id_don_vi || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 outline-none text-gray-600 cursor-not-allowed font-semibold" disabled>
                        {/* 🟢 TÌM TÊN ĐƠN VỊ AN TOÀN */}
                        <option value={selectedUnitId || ''}>{donViMap[selectedUnitId || ''] || selectedUnitId}</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Giấy phép PCCC</label>
                        <select name="giay_phep_pccc" value={formData.giay_phep_pccc || 'Nghiệm thu'} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:border-blue-400 font-bold text-emerald-700 transition-colors">
                          <option value="Nghiệm thu">Nghiệm thu</option><option value="Đã phê duyệt">Đã phê duyệt</option><option value="Chưa có">Chưa có</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Bảo hiểm Cháy nổ</label>
                        <select name="bao_hiem_chay_no" value={formData.bao_hiem_chay_no || 'Có'} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:border-blue-400 transition-colors">
                          <option value="Có">Có</option><option value="Không">Không</option>
                        </select>
                      </div>
                    </div>
                    {formData.bao_hiem_chay_no === 'Có' && (
                      <div className="animate-in fade-in duration-200">
                        <label className="block text-[10px] font-bold text-red-600 mb-1.5 uppercase">Ngày hết hạn Bảo Hiểm *</label>
                        <input type="date" name="ngay_het_han_bh" value={formData.ngay_het_han_bh ? formData.ngay_het_han_bh.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-red-300 rounded-lg bg-red-50 outline-none focus:border-red-500 font-bold text-red-700 text-sm transition-colors" />
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-purple-700 mb-1.5 uppercase">Link Phương án CC (Drive/PDF)</label>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input type="url" name="link_phuong_an_pccc" value={formData.link_phuong_an_pccc || ''} onChange={handleChange} className="w-full pl-9 pr-4 py-2.5 border border-purple-200 rounded-lg bg-white outline-none focus:border-purple-400 text-blue-600 text-sm transition-colors" placeholder="Dán link..." />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. ĐỘI PCCC & DIỄN TẬP */}
                <div className="bg-[#f0fdf4] p-6 rounded-xl border border-emerald-200 shadow-sm h-full flex flex-col">
                  <h4 className="font-bold text-[#047857] mb-5 flex items-center gap-2 border-b border-emerald-200/50 pb-3"><Users size={18}/> 2. Đội PCCC Cơ sở & Diễn tập</h4>
                  <div className="space-y-5 flex-1">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Đội trưởng PCCC</label>
                      <input type="text" name="ho_ten_doi_truong" value={formData.ho_ten_doi_truong || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-emerald-400 font-bold text-[#05469B] transition-colors" placeholder="Họ và tên..." />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Chức vụ</label><input type="text" name="chuc_vu" value={formData.chuc_vu || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-emerald-400 text-sm transition-colors" placeholder="VD: Trưởng phòng..." /></div>
                      <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">SĐT Đội trưởng</label><input type="text" name="sdt_doi_truong" value={formData.sdt_doi_truong || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-emerald-400 text-sm transition-colors" placeholder="xxxx xxx xxx" /></div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 border-t border-emerald-200/50 pt-5">
                      <div className="col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1.5"><Users size={12} className="text-emerald-600"/> Tổng Thành viên</label><input type="number" name="tong_sl_thanh_vien" value={formData.tong_sl_thanh_vien || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-emerald-400 text-sm font-bold text-emerald-800 transition-colors" placeholder="Số lượng..." /></div>
                      <div className="col-span-1"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1.5"><Sun size={12} className="text-orange-500"/> Ngày</label><input type="number" name="sl_huy_dong_ban_ngay" value={formData.sl_huy_dong_ban_ngay || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-emerald-400 text-sm transition-colors" placeholder="SL..." /></div>
                      <div className="col-span-1"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1.5"><Moon size={12} className="text-indigo-500"/> Đêm</label><input type="number" name="sl_huy_dong_ban_dem" value={formData.sl_huy_dong_ban_dem || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-emerald-400 text-sm transition-colors" placeholder="SL..." /></div>
                    </div>
                    <div className="border-t border-emerald-200/50 pt-5">
                      <label className="block text-[10px] font-bold text-emerald-700 mb-1.5 uppercase">Ngày Diễn tập gần nhất</label>
                      <input type="date" name="ngay_dien_tap" value={formData.ngay_dien_tap ? formData.ngay_dien_tap.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-emerald-300 rounded-lg bg-white outline-none focus:border-emerald-500 text-emerald-800 font-bold text-sm transition-colors" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. HỆ THỐNG THIẾT BỊ PCCC */}
              <div className="bg-[#fffbeb] p-6 rounded-xl border border-orange-200 shadow-sm mt-6">
                <div className="flex justify-between items-center mb-5 border-b border-orange-200/50 pb-3">
                  <h4 className="font-bold text-[#b45309] flex items-center gap-2"><Droplets size={18}/> 3. Hệ thống Cố định & Thiết bị PCCC</h4>
                  {pcccMode !== 'view' && (<button type="button" onClick={handleAddEquipment} className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-sm"><PlusCircle size={16} /> Thêm Thiết bị</button>)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5 pb-5 border-b border-orange-200/50">
                  {PCCC_SYSTEMS.map(sys => (
                    <div key={sys.key} className="bg-white p-3.5 rounded-xl border border-orange-100 flex flex-col justify-between gap-3 h-full shadow-sm">
                      <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1.5 leading-snug"><sys.Icon size={16} className={sys.color}/> {sys.label}</span>
                      <select name={sys.key} value={formData[sys.key] || (sys.key === 'he_thong_chua_chay_tu_dong_nuoc' ? 'Không' : 'Có')} onChange={handleChange} className="w-full p-2 text-sm font-bold border border-gray-200 rounded-lg outline-none focus:border-orange-400 text-[#05469B] bg-blue-50/50 mt-auto transition-colors">
                        <option value="Có">Có</option><option value="Không">Không</option>
                      </select>
                    </div>
                  ))}
                </div>
                
                <p className="text-xs italic text-gray-500 mb-3 px-1">Kê khai chi tiết các thiết bị thuộc các hệ thống trên (Tủ điều khiển, Bình chữa cháy, Đầu báo khói...)</p>
                
                <div className="w-full border border-gray-200 rounded-xl overflow-hidden overflow-x-auto custom-scrollbar bg-white shadow-sm">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">
                        <th className="p-3 w-[18%]">Nhóm Hệ Thống</th>
                        <th className="p-3 w-[20%]">Tên/Loại Thiết Bị</th>
                        <th className="p-3 w-[7%] text-center">Số lượng</th>
                        <th className="p-3 w-[7%] text-center">ĐVT</th>
                        <th className="p-3 w-[14%]">Vị trí bố trí</th>
                        <th className="p-3 w-[10%]">Ngày bơm sạc/KT</th>
                        <th className="p-3 w-[10%] text-red-600">Hạn sạc tiếp theo</th>
                        <th className="p-3 w-[10%]">Tình trạng</th>
                        {pcccMode !== 'view' && <th className="p-3 w-[4%] text-center">#</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {equipmentList.length === 0 ? (
                        <tr><td colSpan={9} className="p-8 text-center text-gray-400 italic bg-gray-50/50">Chưa có thiết bị nào. Vui lòng bấm "Thêm Thiết bị"</td></tr>
                      ) : (
                        equipmentList.map((eq, idx) => {
                          const standardOptions = getAvailableEquipmentGroups(formData);
                          const isCustomUI = eq.nhom_he_thong === 'Khác' || (eq.nhom_he_thong !== '' && !standardOptions.includes(eq.nhom_he_thong));

                          return (
                            <tr key={idx} className="hover:bg-orange-50/30 transition-colors bg-white">
                              <td className="p-2">
                                {isCustomUI ? (
                                  <div className="flex items-center relative w-full">
                                    <input type="text" value={eq.nhom_he_thong === 'Khác' ? '' : eq.nhom_he_thong} onChange={e => handleEquipmentChange(idx, 'nhom_he_thong', e.target.value || 'Khác')} className="w-full p-2 text-xs border border-blue-300 rounded-lg outline-none focus:border-blue-500 bg-blue-50 pr-7 transition-colors" placeholder="Tự nhập tên..." autoFocus />
                                    <button type="button" onClick={() => handleEquipmentChange(idx, 'nhom_he_thong', standardOptions.length > 0 ? standardOptions[0] : '')} className="absolute right-2 text-gray-400 hover:text-red-500 transition-colors" title="Hủy tự nhập"><X size={14}/></button>
                                  </div>
                                ) : (
                                  <select value={eq.nhom_he_thong || ''} onChange={e => handleEquipmentChange(idx, 'nhom_he_thong', e.target.value)} className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-400 bg-white transition-colors">
                                    {!eq.nhom_he_thong && <option value="">-- Chọn --</option>}
                                    {standardOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    <option value="Khác">Khác (Tự nhập...)</option>
                                  </select>
                                )}
                              </td>
                              <td className="p-2"><input type="text" value={eq.loai_thiet_bi || ''} onChange={e => handleEquipmentChange(idx, 'loai_thiet_bi', e.target.value)} placeholder="VD: Bình bột ABC 4kg..." className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-400 bg-white font-medium transition-colors" /></td>
                              <td className="p-2"><input type="number" value={eq.so_luong || ''} onChange={e => handleEquipmentChange(idx, 'so_luong', e.target.value)} className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-400 bg-white text-center font-bold transition-colors" /></td>
                              <td className="p-2"><input type="text" value={eq.don_vi_tinh || ''} onChange={e => handleEquipmentChange(idx, 'don_vi_tinh', e.target.value)} placeholder="Bình/Cái..." className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-400 bg-white text-center transition-colors" /></td>
                              <td className="p-2"><input type="text" value={eq.vi_tri_bo_tri || ''} onChange={e => handleEquipmentChange(idx, 'vi_tri_bo_tri', e.target.value)} placeholder="Khu trưng bày..." className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-400 bg-white transition-colors" /></td>
                              <td className="p-2"><input type="date" value={eq.ngay_bom_sac ? eq.ngay_bom_sac.split('T')[0] : ''} onChange={e => handleEquipmentChange(idx, 'ngay_bom_sac', e.target.value)} className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-400 bg-white text-gray-600 transition-colors" /></td>
                              <td className="p-2"><input type="date" value={eq.ngay_het_han ? eq.ngay_het_han.split('T')[0] : ''} onChange={e => handleEquipmentChange(idx, 'ngay_het_han', e.target.value)} className="w-full p-2 text-xs border border-red-300 rounded-lg outline-none focus:border-red-500 bg-red-50 font-bold text-red-700 transition-colors" title="Dùng để chạy hệ thống cảnh báo" /></td>
                              <td className="p-2"><select value={eq.tinh_trang || 'Hoạt động tốt'} onChange={e => handleEquipmentChange(idx, 'tinh_trang', e.target.value)} className={`w-full p-2 text-xs font-bold border rounded-lg outline-none focus:border-orange-400 transition-colors ${eq.tinh_trang === 'Hư hỏng' ? 'bg-red-50 text-red-600 border-red-200' : eq.tinh_trang === 'Cần bơm sạc' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}><option value="Hoạt động tốt">Hoạt động tốt</option><option value="Cần bơm sạc">Cần bơm sạc</option><option value="Hư hỏng">Hư hỏng</option></select></td>
                              {pcccMode !== 'view' && (<td className="p-2 text-center"><button type="button" onClick={() => handleRemoveEquipment(idx)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button></td>)}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. DANH BẠ KHẨN CẤP */}
              <div className="bg-white p-6 rounded-xl border border-purple-100 shadow-sm mt-6">
                <h4 className="font-bold text-purple-800 mb-5 flex items-center gap-2 border-b border-purple-50 pb-3"><PhoneCall size={18}/> 4. Danh bạ Khẩn cấp & Ghi chú Tồn tại (Mẫu PC01)</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-6 pb-6 border-b border-purple-50">
                  {EMERGENCY_CONTACTS.map(contact => (
                    <div key={contact.key}>
                      <label className={`block text-[10px] font-bold uppercase mb-1.5 ${contact.color}`}>📞 {contact.label}</label>
                      <input type="text" name={contact.key} value={formData[contact.key] || contact.def} onChange={handleChange} className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-purple-400 text-sm transition-colors ${contact.bg} ${contact.key==='sdt_pccc'?'border-red-300 font-bold':''}`} placeholder="xxxx xxx xxx" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="block text-[10px] font-bold text-orange-600 mb-1.5 uppercase">Khu vực rủi ro cháy nổ cao</label><textarea name="khu_vuc_rui_ro_cao" value={formData.khu_vuc_rui_ro_cao || ''} onChange={handleChange} rows={2} className="w-full p-3 border border-orange-200 rounded-xl bg-[#fffbeb] outline-none focus:border-orange-400 text-sm resize-none transition-colors" placeholder="VD: Kho sơn tĩnh điện, Kho xăng dầu..."></textarea></div>
                  <div><label className="block text-[10px] font-bold text-red-600 mb-1.5 uppercase">Lỗi / Tồn tại chưa khắc phục (CA Yêu cầu)</label><textarea name="loi_ton_tai_chua_khac_phuc" value={formData.loi_ton_tai_chua_khac_phuc || ''} onChange={handleChange} rows={2} className="w-full p-3 border border-red-200 rounded-xl bg-red-50 text-red-800 font-medium outline-none focus:border-red-400 text-sm resize-none transition-colors" placeholder="Ghi nhận các lỗi hệ thống..."></textarea></div>
                </div>
              </div>

            </fieldset>
          </div>

          {/* FOOTER */}
          <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm">Đóng</button>
            {pcccMode !== 'view' && (
              <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#dc2626] hover:bg-[#b91c1c] rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Hồ Sơ PCCC
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}