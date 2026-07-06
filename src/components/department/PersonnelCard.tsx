import React, { useState } from 'react';
import { Phone, Mail as MailIcon, Edit, Loader2, X } from 'lucide-react';
import { Personnel } from '../../types';
import { formatPhoneNumber, toUnaccented } from '../../utils/formatters';
import { toast } from '../../utils/toast';

interface PersonnelCardProps {
  title: string;
  person: Personnel | null | undefined;
  roleDefault: string;
  fieldKey: string;
  isLarge?: boolean;
  personnelData: Personnel[];
  selectedUnitId: string | null;
  handleInlineAssign: (fieldKey: string, idNhanSu: string) => Promise<void>;
}

export default function PersonnelCard({
  title,
  person,
  roleDefault,
  fieldKey,
  isLarge = false,
  personnelData,
  selectedUnitId,
  handleInlineAssign,
}: PersonnelCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [searchName, setSearchName] = useState('');

  const handleSelectPerson = async (selectedId: string) => {
    setIsSavingLocal(true);
    await handleInlineAssign(fieldKey, selectedId);
    setIsSavingLocal(false);
    setIsEditing(false);
    setSearchName('');
  };

  const sdt = person ? (person.sdt_ca_nhan || person.sdt_cong_ty || '') : '';
  const email = person?.email || '';
  const hoTen = person?.ho_ten || '';
  const maNV = person?.ma_so_nhan_vien || '';
  const chucVu = person ? person.chuc_vu : title;

  const currentUnitPersonnel = personnelData.filter(
    ns => ns.id_don_vi === selectedUnitId && ns.trang_thai !== 'Đã nghỉ việc'
  );

  // Tìm kiếm nhân sự trong đơn vị theo họ tên hoặc Mã số nhân viên
  const filteredPersonnel = currentUnitPersonnel.filter(p => {
    const matchesSearch =
      !searchName ||
      toUnaccented(p.ho_ten || '').toLowerCase().includes(toUnaccented(searchName).toLowerCase()) ||
      String(p.ma_so_nhan_vien || '').toLowerCase().includes(searchName.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col transition-all hover:shadow-md relative group ${isLarge ? 'md:col-span-2' : ''} ${isEditing ? 'z-30' : 'overflow-hidden'}`}>
      {!isEditing && !isSavingLocal && person && (
        <button onClick={() => setIsEditing(true)} className="absolute top-2 right-2 p-1.5 bg-white border border-blue-200 text-[#05469B] hover:bg-[#05469B] hover:text-white rounded shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20" title="Chuyển người khác"><Edit size={14}/></button>
      )}
      <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100 min-h-[50px] flex items-center">
        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider leading-snug pr-6">{chucVu}</h4>
      </div>
      <div className="p-4 flex-1 flex flex-col relative h-full min-h-[110px]">
        {isSavingLocal && <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20"><Loader2 className="animate-spin text-[#05469B] mb-2" size={24}/><span className="text-xs font-bold text-gray-500">Đang lưu...</span></div>}
        {isEditing ? (
          <div className="flex flex-col h-full justify-center relative">
            <label className="text-xs font-bold text-[#05469B] mb-1.5">Tìm nhanh & Chọn nhân sự:</label>
            
            {/* Ô tìm kiếm nhanh */}
            <input 
              type="text"
              placeholder="Nhập tên hoặc Mã số nhân viên..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              autoFocus
              className="w-full px-2.5 py-1.5 mb-2 border border-blue-300 rounded-md text-xs outline-none focus:ring-1 focus:ring-[#05469B] font-semibold text-gray-800"
            />

            {/* 🟢 DANH SÁCH CHỌN NỔI (ABSOLUTE FLOATING POPOVER) */}
            <div className="absolute left-0 right-0 top-[56px] flex flex-col border border-blue-200 rounded-lg bg-white overflow-hidden shadow-xl z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Dòng Trống cố định, in đậm ở trên đầu */}
              <button
                type="button"
                onClick={() => handleSelectPerson('')}
                className="w-full text-left px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50 border-b border-gray-100 transition-colors"
              >
                ✖ -- Trống (Xóa người này) --
              </button>
              
              {/* Danh sách cuộn hiển thị 10-12 người */}
              <div className="max-h-[220px] overflow-y-auto divide-y divide-gray-50 text-xs custom-scrollbar">
                {filteredPersonnel.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPerson(p.id)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 font-semibold text-gray-700 transition-colors flex justify-between items-center"
                  >
                    <span className="truncate mr-2">{p.ho_ten}</span>
                    <span className="text-[9px] text-gray-400 font-bold font-mono bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{p.ma_so_nhan_vien}</span>
                  </button>
                ))}
                {filteredPersonnel.length === 0 && (
                  <div className="p-3 text-center text-gray-400 italic">Không tìm thấy kết quả</div>
                )}
              </div>
            </div>

            {/* Spacer giữ chiều cao cho card tránh co rúm khi tuyệt đối hóa dropdown */}
            <div className="h-[36px]"></div>

            <button onClick={() => { setIsEditing(false); setSearchName(''); }} className="mt-3 text-xs font-bold text-gray-400 hover:text-red-500 text-center">Hủy thao tác</button>
          </div>
        ) : person ? (
          <>
            <p className={`font-black text-[#05469B] mb-4 ${isLarge ? 'text-xl' : 'text-lg'}`}>{hoTen}</p>
            <div className="space-y-2 mt-auto">
              <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-md border border-gray-200 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/50 group/phone">
                <Phone size={14} className="text-gray-400 shrink-0 group-hover/phone:text-[#05469B]"/>
                {sdt ? <a href={`tel:${sdt.replace(/\s/g, '')}`} className="text-sm font-semibold text-gray-700 group-hover/phone:text-[#05469B] w-full" title="Bấm để gọi">{formatPhoneNumber(sdt)}</a> : <span className="text-sm font-semibold text-gray-400">---</span>}
              </div>
              <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-md border border-gray-200 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/50 group/mail">
                <MailIcon size={14} className="text-gray-400 shrink-0 group-hover/mail:text-[#05469B]"/>
                {email ? <a href={`mailto:${email}`} className="text-sm font-semibold text-gray-700 truncate group-hover/mail:text-[#05469B] w-full" title="Bấm để gửi mail">{email}</a> : <span className="text-sm font-semibold text-gray-400 truncate">---</span>}
              </div>
            </div>
          </>
        ) : (
          <div onClick={() => { if(currentUnitPersonnel.length > 0) setIsEditing(true); else toast.info('Chưa có nhân sự nào trong danh sách!'); }} className="flex-1 flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors group/box">
            <p className="text-sm text-gray-400 group-hover/box:text-[#05469B] font-medium italic transition-colors">Chưa có {roleDefault}</p>
          </div>
        )}
      </div>
    </div>
  );
}
