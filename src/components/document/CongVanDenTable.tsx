import React from 'react';
import { 
  Calendar, Link as LinkIcon, Eye, Edit, Trash2, Loader2, FileText, Lock, Clock, User 
} from 'lucide-react';
import { DocumentTableProps } from './types';
import { 
  isMatDocument, isNewDocument, normalizeSignerName, isReplacedStatus, isExpiredOrReplaced 
} from '../../utils/documentHelpers';

export const CongVanDenTable: React.FC<DocumentTableProps> = ({
  loading,
  paginatedDocs,
  filteredDocsCount,
  donViMap,
  isViewerHanChe,
  canEditOrDeleteDocument,
  handleQuickUpdateStatus,
  openModal,
  handleDeleteClick,
  setViewData,
  setIsViewModalOpen
}) => {
  return (
    <>
      {/* 🟢 VIEW TRÊN PC */}
      <div className="hidden md:block overflow-x-auto w-full custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse min-w-[1150px]">
          <thead className="sticky top-0 bg-[#f8fafc] z-10 shadow-sm">
            <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              <th className="py-3 px-3 w-38 bg-[#f8fafc]">Số hiệu / Số đến</th>
              <th className="py-3 px-3 w-40 bg-[#f8fafc]">Ngày nhận / Hạn xử lý</th>
              <th className="py-3 px-3 min-w-[220px] bg-[#f8fafc]">Tiêu đề & Nội dung</th>
              <th className="py-3 px-3 w-40 bg-[#f8fafc]">Đơn vị gửi đến</th>
              <th className="py-3 px-3 w-44 bg-[#f8fafc]">Bộ phận xử lý / Trạng thái</th>
              <th className="py-3 px-3 w-24 bg-[#f8fafc]">Hiệu lực</th>
              <th className="py-3 px-3 text-center w-28 bg-[#f8fafc]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#05469B]" />
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : filteredDocsCount === 0 ? (
              <tr>
                <td colSpan={7} className="p-16 text-center text-gray-500">
                  <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">Không tìm thấy công văn đến nào.</p>
                </td>
              </tr>
            ) : (
              paginatedDocs.map((item) => (
                <tr 
                  key={item.id} 
                  className={`transition-all duration-200 group ${isExpiredOrReplaced(item.hieu_luc) ? 'bg-gray-50/80 opacity-60 hover:opacity-100 hover:bg-gray-100 grayscale-[20%]' : 'bg-white hover:bg-[rgb(254,251,235)]'}`}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-black text-[#05469B] bg-blue-50 px-1.5 py-0.5 rounded text-[13px] leading-[15px] border border-blue-100 w-max">{item.so_hieu}</span>
                      {item.so_den && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-max">Số đến: {item.so_den}</span>
                      )}
                    </div>
                    {isNewDocument(item.ngay_ban_hanh) && (
                      <span className="text-[8px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded animate-pulse uppercase tracking-wider mt-1 inline-block">Mới</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs font-semibold text-gray-700">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-normal w-12">Nhận:</span>
                        <span>{item.ngay_nhan ? new Date(item.ngay_nhan).toLocaleDateString('vi-VN') : '-'}</span>
                      </div>
                      {item.han_xu_ly && (
                        <div className="flex items-center gap-1 text-red-600">
                          <span className="text-gray-400 font-normal w-12">Hạn xử lý:</span>
                          <span className="font-bold">{new Date(item.han_xu_ly).toLocaleDateString('vi-VN')}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <p className={`font-bold text-sm leading-tight ${isMatDocument(item.mat) ? 'text-red-700' : 'text-gray-800'}`}>{item.tieu_de}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-1 mb-1.5">{item.noi_dung}</p>
                    {item.link_vb && (
                      <a href={item.link_vb} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                        <LinkIcon size={10}/> File đính kèm
                      </a>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="text-xs font-semibold text-gray-800 break-words">{item.noi_goi_nhan || '-'}</div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Lưu trữ: {donViMap[String(item.id_don_vi)] || item.id_don_vi}</p>
                  </td>
                  <td className="py-2.5 px-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold text-gray-700 flex items-center gap-1">
                        <User size={12} className="text-gray-400"/>
                        {item.bo_phan_xu_ly || <span className="italic text-gray-400">Chưa giao bộ phận</span>}
                      </div>
                      {item.trang_thai_xu_ly && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold w-max uppercase border 
                          ${item.trang_thai_xu_ly === 'Đã hoàn thành' ? 'bg-green-50 text-green-700 border-green-200' : 
                            item.trang_thai_xu_ly === 'Đang xử lý' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                          {item.trang_thai_xu_ly}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="relative group w-full max-w-[120px]">
                      <select
                        value={isReplacedStatus(item.hieu_luc) ? 'Được thay thế bằng VB' : item.hieu_luc}
                        disabled={!canEditOrDeleteDocument(item)}
                        onChange={(e) => handleQuickUpdateStatus(item, e.target.value)}
                        className={`w-full appearance-none pl-2 pr-5 py-1 rounded-md text-[10px] font-bold text-center border shadow-sm outline-none
                          ${!canEditOrDeleteDocument(item) ? 'cursor-not-allowed opacity-80 ' : 'cursor-pointer '}
                          ${item.hieu_luc === 'Còn hiệu lực' ? 'bg-green-50 text-green-700 border-green-200' : 
                            isReplacedStatus(item.hieu_luc) ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-500 border-gray-300'}`}
                      >
                        <option value="Còn hiệu lực">Còn hiệu lực</option>
                        <option value="Hết hiệu lực">Hết hiệu lực</option>
                        <option value="Được thay thế bằng VB">Được thay thế bằng VB</option>
                      </select>
                      {canEditOrDeleteDocument(item) && (
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-gray-500">
                          <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Xem"><Eye size={14} /></button>
                      {canEditOrDeleteDocument(item) && (
                        <>
                          <button onClick={() => openModal('update', item)} className="p-1.5 text-[#05469B] hover:bg-blue-50 rounded-lg transition-colors" title="Sửa"><Edit size={14} /></button>
                          <button onClick={() => handleDeleteClick(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 🟢 VIEW TRÊN MOBILE */}
      <div className="block md:hidden flex-1 overflow-y-auto pb-20 space-y-4">
        {loading ? (
          <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#05469B] mb-2" /> Đang tải...</div>
        ) : filteredDocsCount === 0 ? (
          <div className="p-10 text-center text-gray-500"><FileText size={48} className="mx-auto text-gray-300 mb-4" /> Không tìm thấy công văn đến.</div>
        ) : (
          paginatedDocs.map((item) => (
            <div 
              key={item.id} 
              className={`p-4 rounded-2xl relative overflow-hidden active:scale-[0.98] transition-all duration-200
                ${isExpiredOrReplaced(item.hieu_luc) ? 'bg-gray-50 border border-gray-200 opacity-60 grayscale-[20%]' : 'bg-white shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100'}`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.hieu_luc === 'Còn hiệu lực' ? 'bg-emerald-500' : isReplacedStatus(item.hieu_luc) ? 'bg-orange-400' : 'bg-gray-400'}`}></div>
              
              <div className="flex justify-between items-start mb-2 pl-2">
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="font-black text-[#05469B] bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-100">{item.so_hieu}</span>
                  {item.so_den && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Số đến: {item.so_den}</span>}
                  {isMatDocument(item.mat) && <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-red-200"><Lock size={10}/> MẬT</span>}
                </div>
              </div>

              <div className="pl-2 mb-3">
                <h3 className={`font-bold text-sm leading-snug mb-1.5 ${isMatDocument(item.mat) ? 'text-red-700' : 'text-gray-800'}`}>{item.tieu_de}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-2">{item.noi_dung}</p>
                {item.noi_goi_nhan && (
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">Gửi từ: <span className="text-[#05469B]">{item.noi_goi_nhan}</span></p>
                )}
                {item.bo_phan_xu_ly && (
                  <div className="flex items-center gap-1.5 text-[10px] text-indigo-700 font-bold bg-indigo-50/50 p-1.5 rounded-lg border border-indigo-100 w-max">
                    <span>Xử lý: {item.bo_phan_xu_ly}</span>
                    {item.trang_thai_xu_ly && <span className="text-gray-400">({item.trang_thai_xu_ly})</span>}
                  </div>
                )}
              </div>

              <div className="pl-2 flex justify-between items-center text-[10px] text-gray-500 border-t border-gray-100 pt-3">
                <div className="flex flex-col gap-0.5 font-bold">
                  <span className="flex items-center gap-1">
                    <Calendar size={12}/> Nhận: {item.ngay_nhan ? new Date(item.ngay_nhan).toLocaleDateString('vi-VN') : '-'}
                  </span>
                  {item.han_xu_ly && (
                    <span className="flex items-center gap-1 text-red-600 mt-0.5">
                      <Clock size={12}/> Hạn: {new Date(item.han_xu_ly).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-[50%] font-semibold text-right text-[#05469B]">
                  Lưu: {donViMap[String(item.id_don_vi)] || item.id_don_vi}
                </span>
              </div>

              <div className="pl-2 flex gap-2 mt-3 pt-3 border-t border-gray-100 items-center">
                {!canEditOrDeleteDocument(item) ? (
                  <div className="flex w-full items-center gap-2">
                    <span className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold border text-center truncate
                      ${item.hieu_luc === 'Còn hiệu lực' ? 'bg-green-50 text-green-700 border-green-200' :
                        isReplacedStatus(item.hieu_luc) ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
                      {isReplacedStatus(item.hieu_luc) ? 'Được thay thế bằng VB' : (item.hieu_luc || 'Còn hiệu lực')} (Chỉ xem)
                    </span>
                    <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg flex justify-center items-center border border-emerald-200"><Eye size={14}/></button>
                  </div>
                ) : (
                  <>
                    <select
                      value={isReplacedStatus(item.hieu_luc) ? 'Được thay thế bằng VB' : item.hieu_luc}
                      onChange={(e) => handleQuickUpdateStatus(item, e.target.value)}
                      className={`flex-1 py-2 px-1 rounded-lg text-[11px] font-bold border text-center outline-none cursor-pointer truncate
                        ${item.hieu_luc === 'Còn hiệu lực' ? 'bg-green-50 text-green-700 border-green-200' :
                          isReplacedStatus(item.hieu_luc) ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-500 border-gray-300'}`}
                    >
                      <option value="Còn hiệu lực">Còn hiệu lực</option>
                      <option value="Hết hiệu lực">Hết hiệu lực</option>
                      <option value="Được thay thế bằng VB">Được thay thế bằng VB</option>
                    </select>
                    <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg flex justify-center items-center border border-emerald-200" title="Xem"><Eye size={14}/></button>
                    <button onClick={() => openModal('update', item)} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg flex justify-center items-center border border-blue-200" title="Sửa"><Edit size={14}/></button>
                    <button onClick={() => handleDeleteClick(item.id)} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg flex justify-center items-center border border-red-200" title="Xóa"><Trash2 size={14}/></button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};
