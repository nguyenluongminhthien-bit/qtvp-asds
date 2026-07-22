import React, { useMemo } from 'react';
import { Building2, Edit, Trash2, ShieldCheck, Link as LinkIcon, Users, Settings, XCircle, CheckCircle2, Search } from 'lucide-react';
import { ATVSLD } from '../../types';
import { getExpiryStatus } from '../../utils/expiryStatus';

interface HoSoTabProps {
  filteredData: ATVSLD[];
  donViMap: Record<string, string>;
  user: any;
  onOpenModal: (unitId: string, data?: any) => void;
  onDelete: (id: string) => void;
  isListCollapsed: boolean;
  khoaHocList: any[];
  hocVienList: any[];
  thietBiList: any[];
  kiemDinhList: any[];
  onNavigateToStrictDevices: () => void;
}

export default function HoSoTab({
  filteredData,
  donViMap,
  user,
  onOpenModal,
  onDelete,
  isListCollapsed,
  khoaHocList = [],
  hocVienList = [],
  thietBiList = [],
  kiemDinhList = [],
  onNavigateToStrictDevices
}: HoSoTabProps) {
  return (
    <div className={`transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
      <div className="w-full space-y-6">

        {/* DANH SÁCH CHI TIẾT DẠNG THẺ (CARD LAYOUT) */}
        {filteredData.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
            <Search size={48} className="mx-auto mb-4 text-lime-600"/>
            <p className="text-lg font-medium text-gray-500">Không tìm thấy hồ sơ an toàn lao động.</p>
            {user?.quyen === 'ADMIN' && <p className="text-sm mt-1">Bấm nút "Thêm Báo cáo Cơ sở" để tạo mới.</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredData.map(item => {
              // 1. TỰ ĐỘNG TÍNH TOÀN BỘ SỐ LIỆU HUẤN LUYỆN CỦA ĐƠN VỊ TỪ CƠ SỞ DỮ LIỆU KHÓA HỌC
              const studentsInUnit = hocVienList.filter(hv => hv.id_don_vi === item.id_don_vi);
              
              // Khoảng thời gian huấn luyện gần nhất = MIN(ngay_bat_dau) / MAX(ngay_ket_thuc) của các khóa có học viên của đơn vị
              const courseIds = new Set(studentsInUnit.map(hv => hv.id_khoa_hoc));
              const unitCourses = khoaHocList.filter(kh => courseIds.has(kh.id));
              
              let minStartDate: Date | null = null;
              let maxEndDate: Date | null = null;

              unitCourses.forEach(kh => {
                if (kh.ngay_bat_dau) {
                  const start = new Date(kh.ngay_bat_dau);
                  if (!minStartDate || start < minStartDate) minStartDate = start;
                }
                if (kh.ngay_ket_thuc) {
                  const end = new Date(kh.ngay_ket_thuc);
                  if (!maxEndDate || end > maxEndDate) maxEndDate = end;
                }
              });

              // Thống kê số học viên theo nhóm (1-6)
              // Lọc count và group by nhóm
              const hlStats: Record<string, { total: number; dat: number; khong_dat: number }> = {};
              
              ['1', '2', '3', '4', '6'].forEach(g => {
                const groupStudents = studentsInUnit.filter(hv => {
                  const nhomDigits = String(hv.nhom || '').replace(/\D/g, '');
                  return nhomDigits === g;
                });

                if (groupStudents.length > 0) {
                  const total = groupStudents.length;
                  const dat = groupStudents.filter(hv => 
                    String(hv.ket_qua || '').trim().toLowerCase().includes('đạt') || 
                    String(hv.ket_qua || '').trim().toLowerCase().includes('dat')
                  ).length;
                  const khong_dat = total - dat;

                  hlStats[g] = { total, dat, khong_dat };
                }
              });

              let sumTotal = 0,
                sumDat = 0,
                sumKhongDat = 0;
              const activeGroups: any[] = [];
              ['1', '2', '3', '4', '6'].forEach(g => {
                if (hlStats && hlStats[g] && hlStats[g].total > 0) {
                  sumTotal += hlStats[g].total;
                  sumDat += hlStats[g].dat;
                  sumKhongDat += hlStats[g].khong_dat;
                  activeGroups.push({ nhom: `Nhóm ${g}`, ...hlStats[g] });
                }
              });

              // Tính tỷ lệ hoàn thành huấn luyện tự động
              const autoTyLeHoanThanh = sumTotal > 0 ? `${Math.round((sumDat / sumTotal) * 100)}%` : '0%';

              return (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-lime-100 overflow-hidden hover:shadow-md transition-shadow">
                  
                  {/* Card Header */}
                  <div className="bg-lime-50/50 border-b border-lime-100 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-lime-100 text-lime-750 rounded-full flex items-center justify-center shrink-0 border border-lime-200">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-lime-800 tracking-wide uppercase">
                          {donViMap[String(item.id_don_vi)] || item.id_don_vi}
                        </h3>
                        <p className="text-[11px] font-bold text-lime-600/70 uppercase">MÃ HỒ SƠ: {item.id}</p>
                      </div>
                    </div>

                    {user?.quyen === 'ADMIN' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenModal(item.id_don_vi, item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-lime-700 bg-white border border-lime-200 rounded-lg hover:bg-lime-50 transition-colors shadow-sm cursor-pointer"
                        >
                          <Edit size={14} /> Sửa
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-650 bg-white border border-red-200 rounded-lg hover:bg-red-55 transition-colors shadow-sm cursor-pointer"
                        >
                          <Trash2 size={14} /> Xóa
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-5 sm:p-6 space-y-6">
                    {/* SECTION 1: HUẤN LUYỆN */}
                    <div className="border border-lime-100 rounded-xl overflow-hidden shadow-sm">
                      <div className="p-4 bg-white border-b border-gray-100">
                        <p className="text-sm font-bold text-gray-800 mb-1 leading-relaxed">
                          {item.can_cu_quyet_dinh || 'Chưa cập nhật Quyết định Huấn luyện'}
                        </p>
                        <p className="text-[13px] font-semibold text-lime-700 flex items-center gap-1.5">
                          <ShieldCheck size={16} /> Khoá huấn luyện gần nhất:{' '}
                          {minStartDate ? minStartDate.toLocaleDateString('vi-VN') : '---'} -{' '}
                          {maxEndDate ? maxEndDate.toLocaleDateString('vi-VN') : '---'}
                          <span className="text-xs font-normal text-gray-400 italic">(Tính tự động từ Khóa học)</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-gray-100 bg-gray-50/50">
                        <div className="p-4 text-center border-b md:border-b-0 md:border-r border-gray-100">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TỔNG SỐ HỌC VIÊN</p>
                          <p className="text-3xl font-black text-blue-700">{sumTotal}</p>
                        </div>
                        <div className="p-4 text-center border-b md:border-b-0 md:border-r border-gray-100">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">ĐẠT YÊU CẦU</p>
                          <p className="text-3xl font-black text-lime-600">{sumDat}</p>
                        </div>
                        <div className="p-4 text-center">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">KHÔNG ĐẠT</p>
                          <p className={`text-3xl font-black ${sumKhongDat > 0 ? 'text-red-600' : 'text-gray-400'}`}>{sumKhongDat}</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-center text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="p-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nhóm</th>
                              <th className="p-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Số lượng</th>
                              <th className="p-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tỉ lệ (%)</th>
                              <th className="p-3 text-[11px] font-bold text-lime-700 uppercase tracking-wider">Đạt (SL & %)</th>
                              <th className="p-3 text-[11px] font-bold text-red-500 uppercase tracking-wider">Không đạt (SL & %)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {activeGroups.map((g, idx) => {
                              const pctNhom = sumTotal > 0 ? ((g.total / sumTotal) * 100).toFixed(2) : 0;
                              const pctDat = g.total > 0 ? ((g.dat / g.total) * 100).toFixed(0) : 0;
                              const pctKhongDat = g.total > 0 ? ((g.khong_dat / g.total) * 100).toFixed(0) : 0;
                              return (
                                <tr key={idx} className="hover:bg-gray-50/50">
                                  <td className="p-3 font-bold text-lime-800">{g.nhom}</td>
                                  <td className="p-3 font-semibold text-gray-700">{g.total}</td>
                                  <td className="p-3 font-semibold text-gray-700">{pctNhom}%</td>
                                  <td className="p-3 font-bold text-lime-600">
                                    {g.dat} <span className="text-xs text-gray-400 font-medium">({pctDat}%)</span>
                                  </td>
                                  <td className={`p-3 font-bold ${g.khong_dat > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                    {g.khong_dat} <span className="text-xs text-gray-300 font-medium">({pctKhongDat}%)</span>
                                  </td>
                                </tr>
                              );
                            })}
                            {activeGroups.length > 0 && (
                              <tr className="bg-gray-50/80 border-t-2 border-gray-200">
                                <td className="p-3 font-black text-gray-800 uppercase">TỔNG CỘNG</td>
                                <td className="p-3 font-black text-blue-700">{sumTotal}</td>
                                <td className="p-3 font-black text-blue-700">{sumTotal > 0 ? '100' : '0'}%</td>
                                <td className="p-3 font-black text-lime-600">
                                  {sumDat} <span className="text-xs text-gray-500">({sumTotal > 0 ? Math.round((sumDat / sumTotal) * 100) : 0}%)</span>
                                </td>
                                <td className={`p-3 font-black ${sumKhongDat > 0 ? 'text-red-500' : 'text-gray-550'}`}>
                                  {sumKhongDat} <span className="text-xs text-gray-400">({sumTotal > 0 ? Math.round((sumKhongDat / sumTotal) * 100) : 0}%)</span>
                                </td>
                              </tr>
                            )}
                            {activeGroups.length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-6 text-gray-400 italic">Chưa có số liệu huấn luyện</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <p className="text-[13px] font-semibold text-gray-600 flex items-center gap-2">
                          Tỷ lệ hoàn thành HL Chung:{' '}
                          <span className="px-2.5 py-1 bg-lime-100 text-lime-800 font-black rounded-md">{autoTyLeHoanThanh}</span>
                        </p>
                        {item.link_ho_so_quy_dinh ? (
                          <a
                            href={item.link_ho_so_quy_dinh}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-bold text-lime-800 flex items-center gap-1.5 hover:underline"
                          >
                            <LinkIcon size={14} /> Xem Hồ sơ gốc
                          </a>
                        ) : (
                          <span className="text-[12px] text-gray-400 italic flex items-center gap-1">
                            <LinkIcon size={12} /> Chưa có Link Hồ sơ gốc
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SECTION 2 & 3: GRID 2 CỘT */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* 2. Tổ chức & Y tế */}
                      <div className="bg-white border border-lime-100 rounded-xl p-5 shadow-sm">
                        <h4 className="font-bold text-lime-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-lime-100 pb-2">
                          <Users size={18} className="text-lime-600" /> 2. Tổ chức & Y tế
                        </h4>
                        <div className="space-y-3 text-[13px]">
                          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                            <span className="text-gray-500 font-medium">Phụ trách ATVSLĐ:</span>
                            <span className="font-bold text-lime-800">{item.nguoi_phu_trach || '---'}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                            <span className="text-gray-500 font-medium">Mạng lưới ATVS Viên:</span>
                            <span className="font-bold text-gray-800">{item.so_luong_mang_luoi || '0'} Người</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                            <span className="text-gray-500 font-medium">Khám SK / Bệnh nghề nghiệp:</span>
                            <span className="font-bold text-gray-800">
                              {item.ngay_ksk ? new Date(item.ngay_ksk).toLocaleDateString('vi-VN') : '---'} /{' '}
                              {item.ngay_kham_bnn ? new Date(item.ngay_kham_bnn).toLocaleDateString('vi-VN') : '---'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 font-medium">Cấp phát BHLĐ:</span>
                            <span className={`font-bold ${item.ty_le_cap_bhld === 'Đầy đủ' ? 'text-lime-600' : 'text-orange-500'}`}>
                              {item.ty_le_cap_bhld || '---'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Máy móc & Hiện trường */}
                      <div className="bg-white border border-red-100 rounded-xl p-5 shadow-sm">
                        <h4 className="font-bold text-red-700 text-sm uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-red-100 pb-2">
                          <Settings size={18} className="text-red-500" /> 3. Máy móc & Hiện trường
                        </h4>
                        <div className="space-y-3 text-[13px]">
                          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                            <span className="text-gray-500 font-medium">Đo kiểm Môi trường:</span>
                            <span className="font-bold text-gray-800">
                              {item.ngay_quan_trac_mt ? new Date(item.ngay_quan_trac_mt).toLocaleDateString('vi-VN') : 'Chưa đo'}
                            </span>
                          </div>
                          {(() => {
                            const unitDevices = thietBiList.filter(tb => tb.id_don_vi === item.id_don_vi && tb.tinh_trang === 'Đang sử dụng');
                            const totalDevices = unitDevices.length;
                            
                            let expiredDevices = 0;
                            unitDevices.forEach(tb => {
                              const inspections = kiemDinhList
                                .filter(kd => kd.id_thiet_bi === tb.id)
                                .sort((a, b) => new Date(b.ngay_kiem_dinh).getTime() - new Date(a.ngay_kiem_dinh).getTime());
                              
                              if (inspections.length > 0) {
                                const status = getExpiryStatus(inspections[0].han_kiem_dinh);
                                if (status.level === 'expired') {
                                  expiredDevices++;
                                }
                              } else {
                                expiredDevices++;
                              }
                            });

                            return (
                              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">TB Nghiêm ngặt (Tổng / Quá hạn):</span>
                                <button 
                                  onClick={onNavigateToStrictDevices}
                                  className="font-black text-gray-800 hover:text-lime-700 hover:underline flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 outline-none"
                                  title="Xem danh sách chi tiết thiết bị nghiêm ngặt"
                                >
                                  <span>{totalDevices} / </span>
                                  <span className={expiredDevices > 0 ? 'text-red-650 animate-pulse' : 'text-lime-600'}>
                                    {expiredDevices}
                                  </span>
                                  <span className="text-[10px] text-lime-700 font-bold bg-lime-50 border border-lime-150 px-1 py-0.5 rounded flex items-center gap-0.5 shrink-0 ml-1">Chi tiết</span>
                                </button>
                              </div>
                            );
                          })()}
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-gray-500 font-medium">Số vụ Tai nạn (Năm):</span>
                            <span className={`font-black ${Number(item.so_tai_nan_trong_nam) > 0 ? 'text-red-650' : 'text-gray-800'}`}>
                              {item.so_tai_nan_trong_nam || '0'} Vụ
                            </span>
                          </div>

                          <div className="pt-2">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">
                              TUẦN TRA & LỖI HIỆN TRƯỜNG:
                            </span>
                            {item.cac_loi_hien_truong ? (
                              <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-medium flex items-start gap-2">
                                <XCircle size={14} className="shrink-0 mt-0.5 text-red-500" />
                                <span className="leading-relaxed">{item.cac_loi_hien_truong}</span>
                              </div>
                            ) : (
                              <div className="bg-lime-50 border border-lime-200 text-lime-700 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-lime-500" /> Không có lỗi / Đã xử lý (Kiểm tra:{' '}
                                {item.ngay_tu_kiem_tra ? new Date(item.ngay_tu_kiem_tra).toLocaleDateString('vi-VN') : '---'})
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
