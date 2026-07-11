import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Search, Loader2, Clock, User, Activity, AlertCircle, Calendar } from 'lucide-react';
import { apiService } from '../services/api';
import { SysLog } from '../types';
import { stripAccents } from '../utils/formatters';

export default function LogPage() {
  const [logs, setLogs] = useState<SysLog[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLogsAndUsers = async () => {
      try {
        const [rawLogs, rawUsers] = await Promise.all([
          apiService.getLogs(),
          apiService.getUsers()
        ]);
        setUsers(rawUsers);
        
        // Hàm parse Date an toàn (Hỗ trợ nhiều định dạng từ DB)
        const parseSafeDate = (dateStr: string) => {
          if (!dateStr) return 0;
          const d = new Date(dateStr).getTime();
          if (!isNaN(d)) return d;
          return 0; // Fallback nếu lỗi
        };

        // Dữ liệu từ Supabase đã chuẩn, chỉ cần sắp xếp lại: Thời gian mới nhất lên đầu.
        const sortedData = rawLogs.sort((a, b) => parseSafeDate(b.thoi_gian) - parseSafeDate(a.thoi_gian));
        setLogs(sortedData);
      } catch (err: any) {
        setError(err.message || 'Lỗi tải dữ liệu nhật ký.');
      } finally {
        setLoading(false);
      }
    };
    fetchLogsAndUsers();
  }, []);

  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      map[u.id] = u.ho_ten;
    });
    return map;
  }, [users]);

  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    const cleanSearch = stripAccents(searchTerm);
    return logs.filter(log => {
      const userFullName = log.ho_ten || userMap[log.id_user] || '';
      return (
        stripAccents(log.id_user || '').includes(cleanSearch) || 
        stripAccents(userFullName).includes(cleanSearch) ||
        stripAccents(log.hanh_dong || '').includes(cleanSearch) ||
        stripAccents(log.chi_tiet || '').includes(cleanSearch)
      );
    });
  }, [logs, searchTerm, userMap]);

  const getActionColor = (action: string) => {
    const act = action?.toUpperCase();
    if (act?.includes('THÊM')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (act?.includes('CẬP NHẬT') || act?.includes('SỬA')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (act?.includes('XÓA')) return 'bg-red-50 text-red-700 border-red-200';
    if (act?.includes('ĐĂNG NHẬP')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (act?.includes('ĐĂNG XUẤT')) return 'bg-gray-100 text-gray-600 border-gray-300';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  // Hàm helper để parse chuỗi thời gian hiển thị thân thiện (Cắt riêng Ngày và Giờ)
  const formatLogTime = (isoString: string) => {
    if (!isoString) return { dateStr: '', timeStr: '' };
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { dateStr: '', timeStr: isoString };
      return {
        dateStr: d.toLocaleDateString('vi-VN'),
        timeStr: d.toLocaleTimeString('vi-VN', { hour12: false })
      };
    } catch {
      return { dateStr: '', timeStr: isoString };
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col animate-in fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-[#05469B] flex items-center gap-2"><ClipboardList size={28} /> Nhật ký Hệ thống (Audit Logs)</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">Giám sát toàn bộ thao tác của người dùng trên hệ thống</p>
        </div>
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="Tìm theo tài khoản, hành động..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-100"><AlertCircle size={20}/> {error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-[#f8fafc] border-b border-gray-200 sticky top-0 z-10">
              <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="p-4 w-48"><div className="flex items-center gap-1.5"><Clock size={14}/> Thời gian</div></th>
                <th className="p-4 w-48"><div className="flex items-center gap-1.5"><User size={14}/> Tài khoản</div></th>
                <th className="p-4 w-48"><div className="flex items-center gap-1.5"><User size={14}/> Họ tên</div></th>
                <th className="p-4 w-36"><div className="flex items-center gap-1.5"><Activity size={14}/> Hành động</div></th>
                <th className="p-4"><div className="flex items-center gap-1.5"><ClipboardList size={14}/> Chi tiết cập nhật</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (<tr><td colSpan={5} className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#05469B] mb-2"/> Đang tải log...</td></tr>) 
              : filteredLogs.length === 0 ? (<tr><td colSpan={5} className="p-12 text-center text-gray-400"><ClipboardList size={40} className="mx-auto mb-3 opacity-50"/> Không có nhật ký nào.</td></tr>) 
              : filteredLogs.map((log, idx) => {
                
                const { dateStr, timeStr } = formatLogTime(log.thoi_gian);

                return (
                  <tr key={log.id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-gray-700 text-sm block">{timeStr || '---'}</span>
                      {dateStr && <span className="text-xs text-gray-400 font-medium flex items-center gap-1 mt-0.5"><Calendar size={10}/> {dateStr}</span>}
                    </td>
                    <td className="p-4 font-bold text-[#05469B] text-sm">{log.id_user}</td>
                    <td className="p-4 font-bold text-gray-800 text-sm">{log.ho_ten || userMap[log.id_user] || '---'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 border rounded text-[10px] font-black tracking-wider uppercase ${getActionColor(log.hanh_dong)}`}>
                        {log.hanh_dong}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-700 whitespace-pre-wrap leading-relaxed">{log.chi_tiet || '---'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}