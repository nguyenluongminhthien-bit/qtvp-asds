import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Save, Plane, Calendar, User, Building2, Tag, DollarSign, AlertCircle } from 'lucide-react';
import { Personnel, DonVi, NhaCungCap, VeMayBay } from '../../types';
import { formatCurrencySpace, formatCurrencySpace as formatCurrency, toUnaccented } from '../../utils/formatters';
import { toast } from '../../utils/toast';

interface Props {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: VeMayBay | null;
  personnelList: Personnel[];
  donViList: DonVi[];
  nccList: NhaCungCap[];
  onClose: () => void;
  onSave: (data: Partial<VeMayBay>) => Promise<void>;
}

const AIRLINES = [
  { code: 'VJ', name: 'Vietjet Air' },
  { code: 'VNA', name: 'Vietnam Airlines' },
  { code: 'QH', name: 'Bamboo Airways' },
  { code: 'VU', name: 'Vietravel Airlines' },
  { code: 'DSVN', name: 'Đường sắt Việt Nam' },
  { code: 'KHAC', name: 'Khác' }
];

export default function VeMayBayModal({
  isOpen,
  mode,
  initialData,
  personnelList,
  donViList,
  nccList,
  onClose,
  onSave
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [hasReturnLeg, setHasReturnLeg] = useState(false);
  const [showAllNcc, setShowAllNcc] = useState(false);

  // Lọc chỉ những nhân sự hưởng chính sách về phép
  const eligibleStaff = useMemo(() => {
    return personnelList.filter(p => p.huong_chinh_sach_ve_phep);
  }, [personnelList]);

  // Lọc NCC thuộc nhóm dịch vụ Vé máy bay
  const flightSuppliers = useMemo(() => {
    return nccList.filter(ncc => {
      const nhom = toUnaccented(ncc.nhom_dich_vu || '');
      return nhom.includes('ve may bay') || nhom.includes('hang khong');
    });
  }, [nccList]);

  // Danh sách các nhà cung cấp khác (để dự phòng)
  const otherSuppliers = useMemo(() => {
    return nccList.filter(ncc => {
      const nhom = toUnaccented(ncc.nhom_dich_vu || '');
      return !nhom.includes('ve may bay') && !nhom.includes('hang khong');
    });
  }, [nccList]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [formData, setFormData] = useState<Partial<VeMayBay>>({
    ma_so_nhan_vien: '',
    ho_ten: '',
    id_nhan_su: '',
    id_don_vi: '',
    loai_phuong_tien: 'Vé máy bay',
    hang_van_chuyen: 'Vietjet Air',
    id_ncc: '',
    ten_ncc: '',
    code_ve_di: '',
    chuyen_bay_di: '',
    ngay_di: now.toISOString().split('T')[0],
    chang_di: 'SGN - HAN',
    gia_ve_di: 0,
    code_ve_ve: '',
    chuyen_bay_ve: '',
    ngay_ve: '',
    chang_ve: 'HAN - SGN',
    gia_ve_ve: 0,
    phi_doi_ve: 0,
    phi_hanh_ly: 0,
    nv_tu_tra: 0,
    cty_thanh_toan: 0,
    tong_tien: 0,
    thang: currentMonth,
    nam: currentYear,
    lan_ve_phep: 1,
    muc_dich: 'Về phép',
    trang_thai_doi_chieu: 'Chưa đối chiếu',
    ghi_chu: ''
  });

  useEffect(() => {
    if (initialData && mode === 'edit') {
      setFormData({ ...initialData });
      setHasReturnLeg(Boolean(initialData.code_ve_ve || initialData.chuyen_bay_ve || (initialData.gia_ve_ve && initialData.gia_ve_ve > 0)));
      // Nếu NCC của vé này không nằm trong danh sách Vé máy bay, tự động bật showAllNcc
      if (initialData.id_ncc && !flightSuppliers.some(f => f.id === initialData.id_ncc)) {
        setShowAllNcc(true);
      } else {
        setShowAllNcc(false);
      }
    } else {
      setShowAllNcc(false);
      const defaultSupplier = flightSuppliers[0] || nccList[0];
      setFormData({
        ma_so_nhan_vien: initialData?.ma_so_nhan_vien || '',
        ho_ten: initialData?.ho_ten || '',
        id_nhan_su: initialData?.id_nhan_su || '',
        id_don_vi: initialData?.id_don_vi || '',
        loai_phuong_tien: initialData?.loai_phuong_tien || 'Vé máy bay',
        hang_van_chuyen: 'Vietjet Air',
        id_ncc: defaultSupplier?.id || '',
        ten_ncc: defaultSupplier?.ten_goi_tat || defaultSupplier?.ten_cong_ty || '',
        code_ve_di: '',
        chuyen_bay_di: '',
        ngay_di: now.toISOString().split('T')[0],
        chang_di: initialData?.chang_di || 'SGN - HAN',
        gia_ve_di: 0,
        code_ve_ve: '',
        chuyen_bay_ve: '',
        ngay_ve: '',
        chang_ve: 'HAN - SGN',
        gia_ve_ve: 0,
        phi_doi_ve: 0,
        phi_hanh_ly: 0,
        nv_tu_tra: 0,
        cty_thanh_toan: 0,
        tong_tien: 0,
        thang: currentMonth,
        nam: currentYear,
        lan_ve_phep: initialData?.lan_ve_phep || 1,
        muc_dich: 'Về phép',
        trang_thai_doi_chieu: 'Chưa đối chiếu',
        ghi_chu: ''
      });
      setHasReturnLeg(false);
    }
  }, [initialData, mode, isOpen, flightSuppliers, nccList]);

  // Tự động tính toán tổng tiền và số tiền cty thanh toán
  const recalculateAmounts = (updates: Partial<VeMayBay>) => {
    const next = { ...formData, ...updates };
    const giaDi = Number(next.gia_ve_di) || 0;
    const giaVe = hasReturnLeg ? (Number(next.gia_ve_ve) || 0) : 0;
    const phiDoi = Number(next.phi_doi_ve) || 0;
    const phiHanhLy = Number(next.phi_hanh_ly) || 0;
    const nvTuTra = Number(next.nv_tu_tra) || 0;

    const tong = giaDi + giaVe + phiDoi + phiHanhLy;
    const ctyTra = Math.max(0, tong - nvTuTra);

    setFormData({
      ...next,
      tong_tien: tong,
      cty_thanh_toan: ctyTra
    });
  };

  const handleStaffChange = (msnv: string) => {
    const staff = personnelList.find(p => p.ma_so_nhan_vien === msnv);
    if (!staff) return;
    setFormData(prev => ({
      ...prev,
      ma_so_nhan_vien: staff.ma_so_nhan_vien,
      ho_ten: staff.ho_ten,
      id_nhan_su: staff.id,
      id_don_vi: staff.id_don_vi,
      loai_phuong_tien: staff.hinh_thuc_ve_phep || prev.loai_phuong_tien || 'Vé máy bay',
      chang_di: staff.tuyen_ve_phep || prev.chang_di || 'SGN - HAN'
    }));
  };

  const handleNccChange = (nccId: string) => {
    const ncc = nccList.find(n => n.id === nccId);
    if (!ncc) return;
    setFormData(prev => ({
      ...prev,
      id_ncc: ncc.id,
      ten_ncc: ncc.ten_goi_tat || ncc.ten_cong_ty || ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ma_so_nhan_vien) {
      toast.warning('Vui lòng chọn hoặc nhập Nhân viên!');
      return;
    }
    if (!formData.code_ve_di && !formData.code_ve_ve) {
      toast.warning('Vui lòng nhập Mã code vé (chiều đi hoặc chiều về)!');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<VeMayBay> = {
        ...formData,
        gia_ve_di: Number(formData.gia_ve_di) || 0,
        gia_ve_ve: hasReturnLeg ? (Number(formData.gia_ve_ve) || 0) : 0,
        phi_doi_ve: Number(formData.phi_doi_ve) || 0,
        phi_hanh_ly: Number(formData.phi_hanh_ly) || 0,
        nv_tu_tra: Number(formData.nv_tu_tra) || 0,
        cty_thanh_toan: Number(formData.cty_thanh_toan) || 0,
        tong_tien: Number(formData.tong_tien) || 0,
        thang: Number(formData.thang) || currentMonth,
        nam: Number(formData.nam) || currentYear,
        lan_ve_phep: Number(formData.lan_ve_phep) || 1
      };
      if (!hasReturnLeg) {
        payload.code_ve_ve = '';
        payload.chuyen_bay_ve = '';
        payload.ngay_ve = undefined;
        payload.chang_ve = '';
        payload.gia_ve_ve = 0;
      }
      await onSave(payload);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu thông tin vé');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 bg-[#e8f0fe] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white rounded-xl shadow-2xs text-[#05469B]">
              <Plane size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#05469B]">
                {mode === 'create' ? 'Thêm Vé Về Phép / Đi Lại' : 'Cập Nhật Thông Tin Vé'}
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Theo dõi chi phí vé máy bay, đường sắt và phân bổ thanh toán
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-white shadow-2xs transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
          {/* KHỐI 1: THÔNG TIN NHÂN SỰ & KỲ QUẢN LÝ */}
          <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 space-y-3">
            <h4 className="font-bold text-[#05469B] uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <User size={14} /> 1. Thông tin Nhân sự & Kỳ theo dõi
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block font-bold text-gray-700 mb-1">
                  Chọn Nhân viên (Hưởng chính sách) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.ma_so_nhan_vien || ''}
                  onChange={(e) => handleStaffChange(e.target.value)}
                  className="w-full p-2.5 bg-[#FFFFF0] border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-800"
                >
                  <option value="">-- Chọn nhân viên từ danh sách ({eligibleStaff.length} người) --</option>
                  {eligibleStaff.map(p => (
                    <option key={p.id} value={p.ma_so_nhan_vien}>
                      [{p.ma_so_nhan_vien}] {p.ho_ten} - {p.chuc_vu || 'NV'} {p.ngach_luong || p.ngach_ve_phep ? `[Ngạch: ${p.ngach_luong || p.ngach_ve_phep}]` : ''} {p.dinh_muc_ve_phep_nam ? `(Hạn mức: ${p.dinh_muc_ve_phep_nam} lần)` : ''}
                    </option>
                  ))}
                  {/* Dự phòng nếu nhân viên chưa có trong danh sách hưởng chính sách */}
                  <option value="__CUSTOM__">-- Hoặc nhân viên khác (nhập bên dưới) --</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Họ và Tên</label>
                <input
                  type="text"
                  required
                  value={formData.ho_ten || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, ho_ten: e.target.value }))}
                  placeholder="Họ tên nhân sự..."
                  className="w-full p-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Mã NV</label>
                <input
                  type="text"
                  required
                  value={formData.ma_so_nhan_vien || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, ma_so_nhan_vien: e.target.value }))}
                  placeholder="MSNV..."
                  className="w-full p-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Tháng theo dõi</label>
                <select
                  value={formData.thang}
                  onChange={(e) => setFormData(prev => ({ ...prev, thang: Number(e.target.value) }))}
                  className="w-full p-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Năm theo dõi</label>
                <input
                  type="number"
                  value={formData.nam}
                  onChange={(e) => setFormData(prev => ({ ...prev, nam: Number(e.target.value) }))}
                  className="w-full p-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Lần về phép</label>
                <input
                  type="number"
                  min="1"
                  value={formData.lan_ve_phep || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, lan_ve_phep: Number(e.target.value) }))}
                  className="w-full p-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Mục đích đi</label>
                <select
                  value={formData.muc_dich || 'Về phép'}
                  onChange={(e) => setFormData(prev => ({ ...prev, muc_dich: e.target.value }))}
                  className="w-full p-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-semibold"
                >
                  <option value="Về phép">Về phép</option>
                  <option value="Công tác">Công tác</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>
          </div>

          {/* KHỐI 2: NHÀ CUNG CẤP & PHƯƠNG TIỆN */}
          <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-amber-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                <Building2 size={14} /> 2. Đơn vị vận chuyển & Nhà cung cấp vé
              </h4>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Nhóm DV: Vé máy bay
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Loại phương tiện</label>
                <select
                  value={formData.loai_phuong_tien || 'Vé máy bay'}
                  onChange={(e) => setFormData(prev => ({ ...prev, loai_phuong_tien: e.target.value }))}
                  className="w-full p-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-semibold"
                >
                  <option value="Vé máy bay">Vé máy bay</option>
                  <option value="Tàu hỏa">Tàu hỏa (Đường sắt)</option>
                  <option value="Xe khách">Xe khách</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Hãng bay / Đơn vị vận chuyển</label>
                <select
                  value={formData.hang_van_chuyen || 'Vietjet Air'}
                  onChange={(e) => setFormData(prev => ({ ...prev, hang_van_chuyen: e.target.value }))}
                  className="w-full p-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-semibold"
                >
                  {AIRLINES.map(a => (
                    <option key={a.code} value={a.name}>{a.name} ({a.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-gray-700 truncate">
                    Nhà cung cấp (Đại lý vé) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAllNcc(prev => !prev)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-bold cursor-pointer whitespace-nowrap ml-1"
                    title={showAllNcc ? 'Chỉ hiển thị các NCC có nhóm dịch vụ Vé máy bay' : 'Hiển thị toàn bộ NCC trong hệ thống'}
                  >
                    {showAllNcc ? 'Chỉ Vé máy bay' : 'Tất cả NCC'}
                  </button>
                </div>
                <select
                  required
                  value={formData.id_ncc || ''}
                  onChange={(e) => handleNccChange(e.target.value)}
                  className="w-full p-2.5 bg-[#FFFFF0] border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-semibold text-gray-800"
                >
                  <option value="">-- Chọn Nhà Cung Cấp --</option>
                  {flightSuppliers.length > 0 ? (
                    <optgroup label={`Nhóm dịch vụ "Vé máy bay" (${flightSuppliers.length} NCC)`}>
                      {flightSuppliers.map(ncc => (
                        <option key={ncc.id} value={ncc.id}>
                          {ncc.ten_goi_tat ? `${ncc.ten_goi_tat} - ` : ''}{ncc.ten_cong_ty}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option value="" disabled>
                      (Chưa có NCC nào thuộc nhóm "Vé máy bay" trong Quản lý NCC)
                    </option>
                  )}
                  {showAllNcc && otherSuppliers.length > 0 && (
                    <optgroup label={`Tất cả Nhà cung cấp khác (${otherSuppliers.length} NCC)`}>
                      {otherSuppliers.map(ncc => (
                        <option key={ncc.id} value={ncc.id}>
                          {ncc.ten_goi_tat ? `${ncc.ten_goi_tat} - ` : ''}{ncc.ten_cong_ty} ({ncc.nhom_dich_vu || 'Khác'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* KHỐI 3: CHI TIẾT LƯỢT ĐI & LƯỢT VỀ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chiều đi */}
            <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                <span className="font-extrabold text-sky-900 text-xs flex items-center gap-1.5">
                  ✈️ LƯỢT ĐI <span className="text-red-500">*</span>
                </span>
                <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold">Chiều đi</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Mã Code vé đi *</label>
                  <input
                    type="text"
                    required
                    value={formData.code_ve_di || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, code_ve_di: e.target.value.toUpperCase() }))}
                    placeholder="VD: 54132899"
                    className="w-full p-2 bg-[#FFFFF0] border border-sky-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Chuyến bay đi</label>
                  <input
                    type="text"
                    value={formData.chuyen_bay_di || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, chuyen_bay_di: e.target.value.toUpperCase() }))}
                    placeholder="VD: VJ123"
                    className="w-full p-2 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500 font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Ngày bay đi</label>
                  <input
                    type="date"
                    value={formData.ngay_di || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, ngay_di: e.target.value }))}
                    className="w-full p-2 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Chặng đi</label>
                  <input
                    type="text"
                    value={formData.chang_di || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, chang_di: e.target.value }))}
                    placeholder="VD: SGN - HAN"
                    className="w-full p-2 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">Giá vé đi (VNĐ)</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={formatCurrencySpace(formData.gia_ve_di)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      recalculateAmounts({ gia_ve_di: raw ? Number(raw) : 0 });
                    }}
                    className="w-full p-2 bg-[#FFFFF0] border border-sky-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold text-sky-800 text-right"
                  />
                </div>
              </div>
            </div>

            {/* Chiều về */}
            <div className={`p-4 rounded-xl border transition-all space-y-3 ${hasReturnLeg ? 'bg-indigo-50/50 border-indigo-200' : 'bg-gray-50/60 border-gray-200'}`}>
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <span className="font-extrabold text-indigo-900 text-xs flex items-center gap-1.5">
                  🛬 LƯỢT VỀ (NẾU CÓ)
                </span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-indigo-700 select-none">
                  <input
                    type="checkbox"
                    checked={hasReturnLeg}
                    onChange={(e) => {
                      setHasReturnLeg(e.target.checked);
                      recalculateAmounts({ gia_ve_ve: e.target.checked ? (formData.gia_ve_ve || 0) : 0 });
                    }}
                    className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                  />
                  <span>Vé khứ hồi</span>
                </label>
              </div>

              {hasReturnLeg ? (
                <div className="grid grid-cols-2 gap-2.5 animate-in fade-in">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Mã Code vé về</label>
                    <input
                      type="text"
                      value={formData.code_ve_ve || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, code_ve_ve: e.target.value.toUpperCase() }))}
                      placeholder="VD: 54132900"
                      className="w-full p-2 bg-[#FFFFF0] border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Chuyến bay về</label>
                    <input
                      type="text"
                      value={formData.chuyen_bay_ve || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, chuyen_bay_ve: e.target.value.toUpperCase() }))}
                      placeholder="VD: VJ124"
                      className="w-full p-2 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Ngày bay về</label>
                    <input
                      type="date"
                      value={formData.ngay_ve || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, ngay_ve: e.target.value }))}
                      className="w-full p-2 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Chặng về</label>
                    <input
                      type="text"
                      value={formData.chang_ve || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, chang_ve: e.target.value }))}
                      placeholder="VD: HAN - SGN"
                      className="w-full p-2 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-bold text-gray-700 mb-1">Giá vé về (VNĐ)</label>
                    <input
                      type="text"
                      placeholder="0"
                      value={formatCurrencySpace(formData.gia_ve_ve)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        recalculateAmounts({ gia_ve_ve: raw ? Number(raw) : 0 });
                      }}
                      className="w-full p-2 bg-[#FFFFF0] border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-indigo-800 text-right"
                    />
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400 italic">
                  Không áp dụng chiều về (Vé một chiều)
                </div>
              )}
            </div>
          </div>

          {/* KHỐI 4: PHỤ PHÍ & PHÂN BỔ CHI PHÍ - TRÊN CÙNG 1 DÒNG */}
          <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-200 space-y-2.5">
            <h4 className="font-bold text-emerald-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <DollarSign size={14} /> 4. Phụ phí & Phân bổ chi phí thanh toán
            </h4>
            <div className="grid grid-cols-5 gap-2.5 items-end">
              <div>
                <label className="block font-bold text-gray-700 mb-1 truncate text-[11px]" title="Phí đổi vé / Giờ bay (VNĐ)">
                  Phí đổi vé
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatCurrencySpace(formData.phi_doi_ve)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    recalculateAmounts({ phi_doi_ve: raw ? Number(raw) : 0 });
                  }}
                  className="w-full p-2 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-right text-gray-800"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1 truncate text-[11px]" title="Phí hành lý mua thêm (VNĐ)">
                  Phí hành lý
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatCurrencySpace(formData.phi_hanh_ly)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    recalculateAmounts({ phi_hanh_ly: raw ? Number(raw) : 0 });
                  }}
                  className="w-full p-2 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-right text-gray-800"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1 truncate text-[11px]" title="Tổng tiền thanh toán">
                  Tổng thanh toán
                </label>
                <input
                  type="text"
                  readOnly
                  value={(formatCurrencySpace(formData.tong_tien) || '0') + ' đ'}
                  className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg font-mono font-black text-right text-gray-800 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-amber-800 mb-1 truncate text-[11px]" title="Nhân viên tự chi trả">
                  NV tự trả
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatCurrencySpace(formData.nv_tu_tra)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    recalculateAmounts({ nv_tu_tra: raw ? Number(raw) : 0 });
                  }}
                  className="w-full p-2 bg-[#FFFFF0] border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold text-right text-amber-700"
                />
              </div>

              <div>
                <label className="block font-bold text-emerald-800 mb-1 truncate text-[11px]" title="Công ty chi trả">
                  Cty chi trả
                </label>
                <input
                  type="text"
                  readOnly
                  value={(formatCurrencySpace(formData.cty_thanh_toan) || '0') + ' đ'}
                  className="w-full p-2 bg-emerald-100/70 border border-emerald-300 rounded-lg font-mono font-black text-right text-emerald-800 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* GHI CHÚ */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Ghi chú thêm</label>
            <textarea
              rows={2}
              value={formData.ghi_chu || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, ghi_chu: e.target.value }))}
              placeholder="Ghi chú chi tiết về vé, lý do thay đổi..."
              className="w-full p-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] resize-none"
            ></textarea>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          <div className="text-xs text-gray-500">
            Tổng chi trả: <span className="font-extrabold text-emerald-700">{(formatCurrencySpace(formData.cty_thanh_toan) || '0')} đ</span>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-[#05469B] hover:bg-[#04367a] text-white font-bold rounded-xl flex items-center gap-2 shadow-md transition-colors cursor-pointer"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Lưu Thông Tin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
