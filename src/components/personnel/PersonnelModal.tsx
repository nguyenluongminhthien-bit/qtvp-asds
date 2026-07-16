import React, { useEffect, useMemo } from 'react';
import { X, Loader2, Save, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { DonVi } from '../../types';
import { formatPhoneNumber } from '../../utils/formatters';
import { buildHierarchicalOptions, getUnitEmoji } from '../../utils/hierarchy';
import { CERTIFICATES } from '../../constants/certificates';

interface PersonnelModalProps {
  isOpen: boolean;
  mode: 'create' | 'update';
  formData: any;
  submitting: boolean;
  donViList: DonVi[];
  phanLoaiSuggestions?: string[];
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  setFormData: (updater: (prev: any) => any) => void;
  hideSensitiveFields?: boolean;
}

export default function PersonnelModal({
  isOpen,
  mode,
  formData,
  submitting,
  donViList,
  phanLoaiSuggestions = [],
  onClose,
  onSave,
  setFormData,
  hideSensitiveFields = false,
}: PersonnelModalProps) {

  // 🟢 TỰ ĐỘNG TÍNH NGÀY HẾT HẠN ATVSLĐ (Bơm IQ cho phần mềm)
  useEffect(() => {
    if (isOpen && formData.huan_luyen_den) {
      const endDate = new Date(formData.huan_luyen_den);
      const nhom = String(formData.nhom_doi_tuong || '');
      // Nhóm 4 -> 1 năm. Còn lại -> 2 năm
      const yearsToAdd = nhom.includes('4') ? 1 : 2;
      endDate.setFullYear(endDate.getFullYear() + yearsToAdd);
      
      const formattedDate = endDate.toISOString().split('T')[0];
      
      // Tự động điền vào ô Giá trị đến nếu nó chưa khớp
      if (formData.gia_tri_den !== formattedDate) {
        setFormData(prev => ({ ...prev, gia_tri_den: formattedDate }));
      }
    }
  }, [formData.huan_luyen_den, formData.nhom_doi_tuong, isOpen, setFormData, formData.gia_tri_den]);

  useEffect(() => {
    if (isOpen && formData.cc_atvsld) {
      const nhom = String(formData.nhom_doi_tuong || '');
      let certName = '';
      if (nhom === '1' || nhom === '2') certName = 'Giấy chứng nhận huấn luyện ATVSLĐ';
      else if (nhom === '3') certName = 'Thẻ An toàn lao động';
      else if (nhom === '4') certName = 'Quyết định Công nhận Kết quả Huấn luyện ATVSLĐ';
      else if (nhom === '6') certName = 'Giấy chứng nhận huấn luyện ATVSLĐ';

      if (formData.chung_nhan !== certName) {
        setFormData(prev => ({ ...prev, chung_nhan: certName }));
      }
    }
  }, [formData.nhom_doi_tuong, formData.cc_atvsld, isOpen, setFormData, formData.chung_nhan]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target;
    let value: string | boolean = type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    if (name === 'thu_nhap') {
      value = (value as string).replace(/\D/g, '');
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const gplxGroups = [
    { title: 'Tùy chọn chung', options: [{ label: 'Không có', value: 'Không có' }] },
    { title: 'Nhóm xe máy (Mô tô)', options: [{ label: 'Hạng A1 (Đến 125 cm³)', value: 'A1' }, { label: 'Hạng A (Trên 125 cm³)', value: 'A' }, { label: 'Hạng B1 (Ba bánh)', value: 'B1' }] },
    { title: 'Nhóm xe ô tô chở người', options: [{ label: 'Hạng B (Đến 8 chỗ, < 3.5T)', value: 'B' }, { label: 'Hạng D1 (8 - 16 chỗ)', value: 'D1' }, { label: 'Hạng D2 (16 - 29 chỗ)', value: 'D2' }, { label: 'Hạng D (Trên 29 chỗ)', value: 'D' }] },
    { title: 'Nhóm xe tải và chuyên dùng', options: [{ label: 'Hạng C1 (3.5T - 7.5T)', value: 'C1' }, { label: 'Hạng C (Trên 7.5T)', value: 'C' }] },
    { title: 'Nhóm xe kéo rơ moóc (Bằng E)', options: [{ label: 'Hạng BE (B kéo > 750kg)', value: 'BE' }, { label: 'Hạng C1E (C1 kéo > 750kg)', value: 'C1E' }, { label: 'Hạng CE (Đầu kéo, container)', value: 'CE' }, { label: 'Hạng D1E (D1 kéo > 750kg)', value: 'D1E' }, { label: 'Hạng D2E (D2 kéo > 750kg)', value: 'D2E' }, { label: 'Hạng DE (D kéo > 750kg)', value: 'DE' }] }
  ];

  const handleGPLXChange = (value: string, isChecked: boolean) => {
    let currentArr = formData.giay_phep_lai_xe ? formData.giay_phep_lai_xe.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    if (value === 'Không có') {
      currentArr = isChecked ? ['Không có'] : [];
    } else {
      currentArr = currentArr.filter((item: string) => item !== 'Không có');
      if (isChecked) {
        if (!currentArr.includes(value)) currentArr.push(value);
      } else {
        currentArr = currentArr.filter((item: string) => item !== value);
      }
    }
    setFormData(prev => ({ ...prev, giay_phep_lai_xe: currentArr.join(', ') }));
  };

  const currentGPLXList = useMemo(() => {
    return formData.giay_phep_lai_xe ? formData.giay_phep_lai_xe.split(',').map((s: string) => s.trim()) : [];
  }, [formData.giay_phep_lai_xe]);

  const normalizedKhoi = useMemo(() => {
    const val = String(formData.khoi || '').trim();
    if (!val) return 'KD xe DL';
    const cleanVal = val.replace(/^Khối\s+/i, '').trim();
    return cleanVal || 'KD xe DL';
  }, [formData.khoi]);

  const khoiOptions = useMemo(() => {
    const base = ['KD xe DL', 'KD xe TM & XK', 'KD DVPT', 'NV QT Chuyên ngành', 'NV QT Cơ bản'];
    if (normalizedKhoi && !base.includes(normalizedKhoi)) {
      base.push(normalizedKhoi);
    }
    return base;
  }, [normalizedKhoi]);

  const phanLoaiOptions = useMemo(() => {
    const base = ['Lãnh đạo', 'PT KD Xe', 'PT KD DVPT', 'PT DVHT 1', 'PT DVHT 2', 'Hành chính NS', 'Nhân sự hỗ trợ'];
    const current = String(formData.phan_loai || '').trim();
    if (current && !base.includes(current)) {
      base.push(current);
    }
    return base;
  }, [formData.phan_loai]);

  const nhomOptions = useMemo(() => {
    const base = [1, 2, 3, 4, 6];
    const currentStr = String(formData.nhom_doi_tuong || '');
    const match = currentStr.match(/\d+/);
    const currentNum = match ? parseInt(match[0], 10) : null;
    if (currentNum && !base.includes(currentNum)) {
      base.push(currentNum);
    }
    return base;
  }, [formData.nhom_doi_tuong]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-gray-50 rounded-t-3xl sm:rounded-t-2xl shrink-0">
          <h3 className="text-xl font-bold text-[#05469B]">{mode === 'create' ? 'Thêm Hồ sơ' : 'Cập nhật Hồ sơ'}</h3>
          <button type="button" onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={onSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
            <div className="bg-blue-50/40 p-4 sm:p-5 rounded-xl border border-blue-100">
              <h4 className="font-bold text-[#05469B] mb-4 flex items-center gap-2">
                <div className="w-2 h-6 bg-[#05469B] rounded-full"></div>
                Thông tin cá nhân
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Mã số nhân viên */}
<div>
  <label className="block text-xs font-bold text-gray-700 mb-1">
    Mã số NV
    {mode === 'create' && <span className="text-gray-400 font-normal ml-1">(tự sinh nếu để trống)</span>}
  </label>
  <input
    type="text"
    name="ma_so_nhan_vien"
    value={formData.ma_so_nhan_vien || ''}
    onChange={handleInputChange}
    readOnly={mode === 'update'}
    className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-bold tracking-wide
      ${mode === 'update'
        ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
        : 'border-blue-300 bg-[#FFFFF0] text-[#05469B]'}`}
    placeholder={mode === 'create' ? 'VD: 2601001' : ''}
  />
  {mode === 'update' && (
    <p className="text-[10px] text-gray-400 mt-0.5">MSNV không thể thay đổi sau khi tạo</p>
  )}
</div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Họ và Tên *</label>
                  <input type="text" required name="ho_ten" value={formData.ho_ten || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Giới tính</label>
                  <select name="gioi_tinh" value={formData.gioi_tinh || 'Nam'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]">
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>

                {/* Dòng 2: Năm sinh - SĐT Cá nhân - SĐT Công ty - Định mức cước ĐTDĐ (VNĐ) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Năm sinh</label>
                  <input type="date" name="nam_sinh" value={formData.nam_sinh ? formData.nam_sinh.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">SĐT Cá nhân</label>
                  <input 
                    type="tel" 
                    name="sdt_ca_nhan" 
                    value={hideSensitiveFields ? '***' : (formData.sdt_ca_nhan || '')} 
                    onChange={(e) => {
                      if (hideSensitiveFields) return;
                      setFormData(prev => ({...prev, sdt_ca_nhan: formatPhoneNumber(e.target.value)}));
                    }} 
                    disabled={hideSensitiveFields}
                    maxLength={13} 
                    className={`w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold tracking-wide ${hideSensitiveFields ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`} 
                    placeholder="09xx xxx xxx" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#05469B] mb-1">SĐT Công ty (SIM cấp)</label>
                  <input
                    type="tel"
                    name="sdt_cong_ty"
                    value={formData.sdt_cong_ty || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, sdt_cong_ty: formatPhoneNumber(e.target.value) }))}
                    maxLength={13}
                    className="w-full p-2.5 border border-blue-300 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold tracking-wide text-[#05469B]"
                    placeholder="09xx xxx xxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#05469B] mb-1">Định mức cước ĐTDĐ (VNĐ)</label>
                  <input
                    type="number"
                    name="dinh_muc_cuoc"
                    placeholder="Để trống nếu thanh toán thực tế (TT)"
                    value={formData.dinh_muc_cuoc !== null && formData.dinh_muc_cuoc !== undefined ? formData.dinh_muc_cuoc : ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setFormData(prev => ({ ...prev, dinh_muc_cuoc: val }));
                    }}
                    className="w-full p-2.5 border border-blue-300 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]"
                  />
                </div>

                {/* Dòng 3: Email - Link ảnh Đại diện (Google Drive) */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Link Ảnh Đại Diện (Google Drive)</label>
                  <div className="relative">
                    <input type="text" name="hinh_anh" value={formData.hinh_anh || ''} onChange={handleInputChange} className="w-full p-2.5 pl-10 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="Dán link chia sẻ ảnh từ Google Drive vào đây..." />
                    <ImageIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
              </div>
          </div>
          <div className="bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-gray-400 rounded-full"></div> Công việc</h4>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị công tác *</label>
                  <select required name="id_don_vi" value={formData.id_don_vi || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" style={{ fontFamily: 'monospace, sans-serif' }}>
                    <option value="">-- Chọn Đơn vị Showroom --</option>
                    {buildHierarchicalOptions(donViList).map(({ unit, prefix }) => (
                      <option key={unit.id} value={unit.id} className="font-normal text-gray-700">
                        {prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                      </option>
                    ))}
                  </select>
                </div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Khối trực thuộc</label><select name="khoi" value={normalizedKhoi} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]">{khoiOptions.map(opt => <option key={opt} value={opt}>{opt.startsWith('Khối') ? opt : `Khối ${opt}`}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Bộ phận làm việc</label><input type="text" name="phong_ban" value={formData.phong_ban || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="Hành chính, Kỹ thuật..." /></div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phân loại nhân sự</label>
                  <input 
                    type="text" 
                    name="phan_loai" 
                    list="phan-loai-suggestions"
                    value={formData.phan_loai || ''} 
                    onChange={handleInputChange} 
                    className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" 
                    placeholder="Nhập hoặc chọn phân loại..."
                  />
                  <datalist id="phan-loai-suggestions">
                    {phanLoaiSuggestions.map(opt => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Chức danh nghiệp vụ *</label><input type="text" required name="chuc_vu" value={formData.chuc_vu || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="Nhân viên, Kỹ thuật viên..." /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Nhóm đối tượng ATVSLĐ *</label><select required name="nhom_doi_tuong" value={(() => { const m = String(formData.nhom_doi_tuong || '').match(/\d+/); return m ? parseInt(m[0], 10) : 4; })()} onChange={handleInputChange} className="w-full p-2.5 border border-emerald-300 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800">{nhomOptions.map(opt => { let label = `Nhóm ${opt}`; if (opt === 1) label = 'Nhóm 1 (Ban Giám Đốc)'; else if (opt === 2) label = 'Nhóm 2 (Cán bộ An toàn)'; else if (opt === 3) label = 'Nhóm 3 (Lao động nghiêm ngặt)'; else if (opt === 4) label = 'Nhóm 4 (Văn phòng, Kinh doanh...)'; else if (opt === 6) label = 'Nhóm 6 (Vệ sinh viên)'; return <option key={opt} value={opt}>{label}</option>; })}</select></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Địa điểm làm việc</label><input type="text" name="dia_diem_lam_viec" value={formData.dia_diem_lam_viec || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="Showroom Bình Dương..." /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận việc *</label><input type="date" required name="ngay_nhan_vien" value={formData.ngay_nhan_vien ? formData.ngay_nhan_vien.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Ngạch lương</label>
                  <input 
                    type="text" 
                    name="ngach_luong" 
                    value={hideSensitiveFields ? '***' : (formData.ngach_luong || '')} 
                    onChange={handleInputChange} 
                    disabled={hideSensitiveFields}
                    className={`w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] ${hideSensitiveFields ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`} 
                    placeholder="Ví dụ: Chuyên viên" 
                  />
                </div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Trình độ học vấn</label><input type="text" name="trinh_do_hoc_van" value={formData.trinh_do_hoc_van || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="Đại học, Cao đẳng..." /></div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Thu nhập (Lương đóng BH) VNĐ</label>
                  <input 
                    type="text" 
                    name="thu_nhap" 
                    value={hideSensitiveFields ? '***' : (formData.thu_nhap ? Number(formData.thu_nhap).toLocaleString('vi-VN') : '')} 
                    onChange={handleInputChange} 
                    disabled={hideSensitiveFields}
                    className={`w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-indigo-700 ${hideSensitiveFields ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`} 
                    placeholder="10.000.000" 
                  />
                </div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái làm việc</label><select name="trang_thai" value={formData.trang_thai || 'Đang làm việc'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="Đang làm việc">Đang làm việc</option><option value="Đã thôi việc">Đã thôi việc</option></select></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nghỉ việc</label><input type="date" name="ngay_nghi_viec" value={formData.ngay_nghi_viec ? formData.ngay_nghi_viec.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
              </div>
            </div>
          </div>
          <div className="bg-emerald-50/40 p-4 sm:p-5 rounded-xl border border-emerald-100">
            <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-emerald-500 rounded-full"></div> Bằng cấp & Chứng chỉ chuyên môn</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {CERTIFICATES.map(cert => {
                const Icon = cert.icon;
                return (
                  <label key={cert.id} className="flex items-center p-2.5 border border-emerald-200 rounded-lg bg-[#FFFFF0] cursor-pointer hover:border-emerald-500 transition-colors shadow-sm">
                    <input 
                      type="checkbox" 
                      name={cert.id} 
                      checked={formData[cert.id] === true || String(formData[cert.id]).toLowerCase() === 'true'} 
                      onChange={handleInputChange} 
                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 mr-2 focus:ring-emerald-500" 
                    />
                    <Icon size={16} className="text-gray-500 mr-1.5 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-bold text-gray-700 leading-tight">{cert.label}</span>
                  </label>
                );
              })}
            </div>
            
            {/* Cột GPLX đặc thù */}
            {formData.giay_phep_lai_xe !== undefined && (
              <div className="mt-5 p-4 bg-white rounded-xl border border-gray-200 animate-in fade-in">
                <h5 className="font-bold text-gray-700 text-xs mb-3 flex items-center gap-1.5">🚗 Chọn các hạng Giấy phép lái xe sở hữu:</h5>
                <div className="space-y-4">
                  {gplxGroups.map(group => (
                    <div key={group.title} className="space-y-1.5 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{group.title}</p>
                      <div className="flex flex-wrap gap-2.5">
                        {group.options.map(opt => {
                          const isChecked = currentGPLXList.includes(opt.value);
                          return (
                            <label key={opt.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${isChecked ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-gray-50 border-gray-200 hover:bg-white text-gray-600'}`}>
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={(e) => handleGPLXChange(opt.value, e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 mr-1 focus:ring-blue-500" 
                              />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formData.cc_atvsld && (
              <div className="mt-5 p-4 sm:p-5 bg-emerald-50 rounded-xl border border-emerald-200 animate-in fade-in slide-in-from-top-2">
                <h5 className="font-bold text-emerald-800 text-sm mb-3 flex items-center gap-2"><ShieldCheck size={16}/> Thông tin chứng nhận ATVSLĐ</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3"><label className="block text-xs font-bold text-gray-700 mb-1">Loại chứng nhận (Tự động theo Nhóm)</label><input type="text" readOnly value={formData.chung_nhan || 'Vui lòng chọn Nhóm đối tượng ở phần Công việc'} className="w-full p-2.5 border border-emerald-200 rounded-lg bg-emerald-100/50 text-emerald-800 font-bold outline-none cursor-not-allowed" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Huấn luyện từ ngày</label><input type="date" name="huan_luyen_tu" value={formData.huan_luyen_tu ? formData.huan_luyen_tu.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Đến ngày</label><input type="date" name="huan_luyen_den" value={formData.huan_luyen_den ? formData.huan_luyen_den.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Có giá trị đến ngày</label><input type="date" name="gia_tri_den" value={formData.gia_tri_den ? formData.gia_tri_den.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-emerald-300 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700" /></div>
                </div>
              </div>
            )}
          </div>
          <div className="bg-orange-50/40 p-4 sm:p-5 rounded-xl border border-orange-100">
            <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-orange-500 rounded-full"></div> Thông tin Bổ sung</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả ngoại hình</label>
                <textarea 
                  name="mo_to_ngoai_hinh" 
                  value={hideSensitiveFields ? '***' : (formData.mo_to_ngoai_hinh || '')} 
                  onChange={handleInputChange} 
                  disabled={hideSensitiveFields}
                  rows={3} 
                  className={`w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none ${hideSensitiveFields ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`}
                ></textarea>
              </div>
              <div><label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú khác</label><textarea name="ghi_chu" value={formData.ghi_chu || ''} onChange={handleInputChange} rows={3} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none"></textarea></div>
            </div>
          </div>
          </div>
          
          {/* FOOTER */}
          <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm">Hủy</button>
            <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Dữ Liệu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
