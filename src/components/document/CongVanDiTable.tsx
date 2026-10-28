import React from 'react';
import { 
  Calendar, Link as LinkIcon, Eye, Edit, Trash2, Loader2, FileText, Lock 
} from 'lucide-react';
import { DocumentTableProps } from './types';
import { 
  isMatDocument, isNewDocument, normalizeSignerName, isReplacedStatus, isExpiredOrReplaced 
} from '../../utils/documentHelpers';

export const CongVanDiTable: React.FC<DocumentTableProps> = ({
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
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead className="sticky top-0 bg-[#f8fafc] z-10 shadow-sm">
            <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              <th className="py-3 px-3 w-36 bg-[#f8fafc]">Số công văn</th>
              <th className="py-3 px-3 w-[125px] bg-[#f8fafc]">Ngày Ban hành</th>
              <th className="py-3 px-3 min-w-[250px] bg-[#f8fafc]">Tiêu đề & Nội dung</th>
              <th className="py-3 px-3 w-44 bg-[#f8fafc]">Nơi nhận (Kính gửi)</th>
              <th className="py-3 px-3 w-40 bg-[#f8fafc]">Người ký - Chức vụ</th>
              <th className="py-3 px-3 w-28 bg-[#f8fafc]">Hiệu lực</th>
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
                  <p className="text-lg font-medium">Không tìm thấy công văn đi nào.</p>
                </td>
              </tr>
            ) : (
              paginatedDocs.map((item) => (
                <tr 
                  key={item.id} 
                  className={`transition-all duration-200 group ${isExpiredOrReplaced(item.hieu_luc) ? 'bg-gray-50/80 opacity-60 hover:opacity-100 hover:bg-gray-100 grayscale-[20%]' : 'bg-white hover:bg-[rgb(254,251,235)]'}`}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center flex-wrap gap-1 mb-1">
                      <span className="font-black text-[#05469B] bg-blue-50 px-1.5 py-0.5 rounded text-[13px] leading-[15px] whitespace-nowrap border border-blue-100">{item.so_hieu}</span>
                    </div>
                    {isNewDocument(item.ngay_ban_hanh) && (
                      <span className="text-[8px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded animate-pulse uppercase tracking-wider">Mới</span>
                    )}
                    {item.nghiep_vu && item.nghiep_vu.trim() !== '' && !/Chưa phân loại|Chưa PL|Trống/i.test(item.nghiep_vu.trim()) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.nghiep_vu.split(';').map(p => p.trim()).filter(Boolean).map((nv, idx) => (
                          <span key={idx} className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">{nv}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs font-medium text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-gray-400 shrink-0"/> 
                      {item.ngay_ban_hanh ? new Date(item.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}
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
                    <div className="text-xs font-semibold text-gray-700 break-words">{item.noi_goi_nhan || '-'}</div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Ban hành: {donViMap[String(item.id_don_vi)] || item.id_don_vi}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-xs text-gray-800">{item.nguoi_ky ? normalizeSignerName(item.nguoi_ky) : '-'}</div>
                    <div className="text-[10px] text-gray-500 font-semibold mt-0.5">{item.chuc_vu || '-'}</div>
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
          <div className="p-10 text-center text-gray-500"><FileText size={48} className="mx-auto text-gray-300 mb-4" /> Không tìm thấy công văn đi.</div>
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
                  {isMatDocument(item.mat) && <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-red-200"><Lock size={10}/> MẬT</span>}
                  {item.nghiep_vu && item.nghiep_vu.trim() !== '' && !/Chưa phân loại|Chưa PL|Trống/i.test(item.nghiep_vu.trim()) && (
                    <div className="flex flex-wrap gap-1">
                      {item.nghiep_vu.split(';').map(p => p.trim()).filter(Boolean).map((nv, idx) => (
                        <span key={idx} className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded uppercase border border-indigo-100">{nv}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pl-2 mb-3">
                <h3 className={`font-bold text-sm leading-snug mb-1.5 ${isMatDocument(item.mat) ? 'text-red-700' : 'text-gray-800'}`}>{item.tieu_de}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-2">{item.noi_dung}</p>
                {item.noi_goi_nhan && (
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">Nơi nhận: <span className="text-[#05469B]">{item.noi_goi_nhan}</span></p>
                )}
                {(item.nguoi_ky || item.chuc_vu) && (
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold bg-gray-50/50 p-1.5 rounded-lg border border-gray-100 w-max">
                    <span className="text-gray-700">{item.nguoi_ky ? normalizeSignerName(item.nguoi_ky) : '-'}</span>
                    {item.chuc_vu && <span className="text-gray-400">({item.chuc_vu})</span>}
                  </div>
                )}
              </div>

              <div className="pl-2 flex justify-between items-center text-[10px] text-gray-500 border-t border-gray-100 pt-3">
                <span className="flex items-center gap-1 font-bold bg-gray-50 px-2 py-1 rounded">
                  <Calendar size={12}/> 
                  {item.ngay_ban_hanh ? new Date(item.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}
                </span>
                <span className="truncate max-w-[50%] font-semibold text-right text-[#05469B]">
                  Ban hành: {donViMap[String(item.id_don_vi)] || item.id_don_vi}
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
