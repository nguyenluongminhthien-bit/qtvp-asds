import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, RotateCcw, Trash2, Search, AlertCircle, 
  CheckCircle2, Clock, User as UserIcon, Table, 
  Database, FileCode, ChevronRight, ShieldAlert,
  Car, Users, Monitor, FileText, DollarSign, Building2, Flame
} from 'lucide-react';
import { apiService } from '../../services/api';
import { SysLog } from '../../types';
import { toast } from '../../utils/toast';

interface RecycleBinItem {
  logId: string;
  timestamp: string;
  userName: string;
  tableName: string;
  tableLabel: string;
  recordId: string;
  summary: string;
  snapshotData: any;
  restored?: boolean;
}

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

const TABLE_MAPPING: Record<string, { label: string; icon: any; color: string }> = {
  'ts_xe': { label: 'Xe & Phương tiện', icon: Car, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  'ns_dich_vu': { label: 'Nhân sự', icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  'ts_thiet_bi': { label: 'Thiết bị văn phòng', icon: Monitor, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  'vb_tb': { label: 'Văn bản - Thông báo', icon: FileText, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  'cp_dntt': { label: 'Đề nghị thanh toán (DNTT)', icon: DollarSign, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  'dm_don_vi': { label: 'Đơn vị / Showroom', icon: Building2, color: 'text-red-700 bg-red-50 border-red-200' },
  'hs_pccc': { label: 'Hồ sơ PCCC', icon: Flame, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  'config_users': { label: 'Tài khoản User', icon: UserIcon, color: 'text-purple-600 bg-purple-50 border-purple-200' }
};

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen,
  onClose,
  onRestored
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterTable, setFilterTable] = useState<string>('ALL');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<{ id: string; data: any } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDeletedItems();
    }
  }, [isOpen]);

  const loadDeletedItems = async () => {
    setLoading(true);
    try {
      const logs = await apiService.getLogs();
      const deletedLogs = logs.filter(
        l => (l.hanh_dong === 'XÓA DỮ LIỆU' || l.hanh_dong === 'XÓA') && 
             l.chi_tiet && 
             l.chi_tiet.includes('SNAPSHOT:')
      );

      const parsed: RecycleBinItem[] = [];
      for (const log of deletedLogs) {
        try {
          const detail = log.chi_tiet || '';
          const snapMatch = detail.match(/SNAPSHOT:\s*(\{.*\}|\[.*\])/);
          if (!snapMatch) continue;

          const snapshotData = JSON.parse(snapMatch[1]);
          const tableMatch = detail.match(/Bảng:\s*([^\|\s]+)/);
          const tableName = tableMatch ? tableMatch[1].trim() : 'Không rõ';
          
          const idMatch = detail.match(/ID:\s*([^\|\s]+)/);
          const recordId = idMatch ? idMatch[1].trim() : (snapshotData.id || snapshotData.ID || 'N/A');

          // Cắt chuỗi tóm tắt ở giữa
          let summary = 'Không có mô tả';
          const parts = detail.split('|');
          if (parts.length >= 3) {
            summary = parts.slice(2).join('|').replace(/SNAPSHOT:.*/, '').trim();
          }

          const mapping = TABLE_MAPPING[tableName] || { 
            label: tableName, 
            icon: Database, 
            color: 'text-gray-600 bg-gray-50 border-gray-200' 
          };

          parsed.push({
            logId: String(log.id),
            timestamp: log.thoi_gian,
            userName: log.ho_ten || log.id_user || 'Hệ thống',
            tableName,
            tableLabel: mapping.label,
            recordId,
            summary: summary || `Bản ghi ID ${recordId}`,
            snapshotData
          });
        } catch (err) {
          console.warn('Lỗi phân tích snapshot:', err);
        }
      }

      // Sắp xếp giảm dần theo thời gian xóa mới nhất
      parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(parsed);
    } catch (err) {
      console.error('Lỗi nạp nhật ký thùng rác:', err);
      toast.error('Không thể tải danh sách thùng rác!');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item: RecycleBinItem) => {
    if (!window.confirm(`Bạn có chắc chắn muốn khôi phục bản ghi này vào hệ thống?\n\n- Phân hệ: ${item.tableLabel}\n- Thông tin: ${item.summary}`)) {
      return;
    }

    setRestoringId(item.logId);
    try {
      await apiService.restoreRecord(item.tableName, item.snapshotData);
      toast.success(`Đã khôi phục thành công "${item.summary}" vào ${item.tableLabel}!`);
      
      // Đánh dấu dòng đã khôi phục trong UI
      setItems(prev => prev.map(i => i.logId === item.logId ? { ...i, restored: true } : i));
      if (onRestored) {
        onRestored();
      }
    } catch (err: any) {
      console.error('Lỗi khôi phục:', err);
      toast.error(`Khôi phục thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setRestoringId(null);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !searchTerm.trim() || 
        item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.recordId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tableLabel.toLowerCase().includes(searchTerm.toLowerCase());

      const matchTable = filterTable === 'ALL' || item.tableName === filterTable;
      return matchSearch && matchTable;
    });
  }, [items, searchTerm, filterTable]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-800 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <RotateCcw className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wide flex items-center gap-2">
                Thùng rác & Phục hồi dữ liệu
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-100 border border-amber-300/30 font-bold">
                  Bảo vệ chống mất mát
                </span>
              </h2>
              <p className="text-xs text-amber-100/80 font-medium">
                Tất cả dữ liệu bị xóa đều được chụp Snapshot nguyên vẹn tự động và có thể khôi phục 1-Click
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* Thanh tìm kiếm & Bộ lọc phân hệ */}
        <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Tìm theo nội dung xóa, mã đối tượng, người xóa..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phân hệ:</span>
            <select 
              value={filterTable} 
              onChange={e => setFilterTable(e.target.value)}
              className="py-2 px-3 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            >
              <option value="ALL">Tất cả phân hệ</option>
              {Object.entries(TABLE_MAPPING).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <button 
              onClick={loadDeletedItems}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-gray-300 bg-white"
              title="Làm mới danh sách"
            >
              <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Danh sách bản ghi */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-gray-100">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <RotateCcw className="w-8 h-8 animate-spin text-amber-600" />
              <p className="text-sm font-medium">Đang tải danh sách snapshot đã xóa...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 p-8">
              <Trash2 className="w-12 h-12 opacity-30 text-amber-600" />
              <p className="font-bold text-gray-600 text-base">Thùng rác trống!</p>
              <p className="text-xs text-gray-400 max-w-md text-center">
                Chưa có bản ghi nào bị xóa có lưu snapshot hoặc không tìm thấy kết quả phù hợp với bộ lọc.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map(item => {
                const mapping = TABLE_MAPPING[item.tableName] || {
                  label: item.tableName,
                  icon: Database,
                  color: 'text-gray-700 bg-gray-50 border-gray-200'
                };
                const IconComponent = mapping.icon;

                return (
                  <div 
                    key={item.logId}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      item.restored 
                        ? 'bg-emerald-50/60 border-emerald-200 opacity-75' 
                        : 'bg-white hover:bg-amber-50/30 border-gray-200 shadow-sm hover:border-amber-200'
                    }`}
                  >
                    {/* Cột thông tin đối tượng */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-xl border shrink-0 ${mapping.color}`}>
                        <IconComponent size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${mapping.color}`}>
                            {item.tableLabel}
                          </span>
                          <span className="text-[11px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            ID: {item.recordId}
                          </span>
                          {item.restored && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={12} /> Đã khôi phục
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 truncate">
                          {item.summary}
                        </h4>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" />
                            {new Date(item.timestamp).toLocaleString('vi-VN')}
                          </span>
                          <span className="flex items-center gap-1">
                            <UserIcon size={12} className="text-gray-400" />
                            Người xóa: <strong className="text-gray-700 font-semibold">{item.userName}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cột thao tác */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                      <button
                        onClick={() => setSelectedSnapshot({ id: item.recordId, data: item.snapshotData })}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-[#05469B] hover:bg-blue-50 border border-gray-200 rounded-lg flex items-center gap-1 transition-colors"
                        title="Xem dữ liệu gốc JSON"
                      >
                        <FileCode size={14} /> Chi tiết
                      </button>

                      <button
                        onClick={() => handleRestore(item)}
                        disabled={restoringId === item.logId || item.restored}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all ${
                          item.restored 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white'
                        }`}
                      >
                        <RotateCcw size={14} className={restoringId === item.logId ? 'animate-spin' : ''} />
                        {restoringId === item.logId ? 'Đang khôi phục...' : item.restored ? 'Đã khôi phục' : 'Khôi phục 1-Click'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer ghi chú an toàn */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-gray-600 font-medium">
            <ShieldAlert size={15} className="text-amber-600" />
            Snapshot lưu trữ vĩnh viễn cấu trúc dữ liệu nguyên bản tại thời điểm bấm xóa.
          </span>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Modal nhỏ xem JSON Snapshot */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 animate-in fade-in">
          <div className="bg-gray-900 text-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <FileCode className="text-amber-400" size={18} />
                <h3 className="font-bold text-sm">Dữ liệu gốc Snapshot (ID: {selectedSnapshot.id})</h3>
              </div>
              <button 
                onClick={() => setSelectedSnapshot(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-emerald-400 bg-gray-950">
              <pre>{JSON.stringify(selectedSnapshot.data, null, 2)}</pre>
            </div>
            <div className="p-3 bg-gray-900 border-t border-gray-800 flex justify-end">
              <button 
                onClick={() => setSelectedSnapshot(null)}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs font-bold rounded"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
