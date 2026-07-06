import React from 'react';
import { X, Star, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw, Check } from 'lucide-react';

export interface WidgetConfig {
  id: string;
  title: string;
  category: 'CHUNG' | 'BẢNG CẢNH BÁO' | 'BIỂU ĐỒ CHUYÊN SÂU';
  icon: string;
  visible: boolean;
  pinned: boolean;
  order: number;
}

interface DashboardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: WidgetConfig[];
  onUpdateWidgets: (updated: WidgetConfig[]) => void;
  onReset: () => void;
}

export default function DashboardCustomizerModal({
  isOpen,
  onClose,
  widgets,
  onUpdateWidgets,
  onReset
}: DashboardCustomizerModalProps) {
  if (!isOpen) return null;

  const handleToggleVisible = (id: string) => {
    onUpdateWidgets(
      widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
    );
  };

  const handleTogglePin = (id: string) => {
    onUpdateWidgets(
      widgets.map(w => w.id === id ? { ...w, pinned: !w.pinned } : w)
    );
  };

  const handleMove = (id: string, direction: 'up' | 'down') => {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(w => w.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      const temp = sorted[idx].order;
      sorted[idx].order = sorted[idx - 1].order;
      sorted[idx - 1].order = temp;
    } else if (direction === 'down' && idx < sorted.length - 1) {
      const temp = sorted[idx].order;
      sorted[idx].order = sorted[idx + 1].order;
      sorted[idx + 1].order = temp;
    }
    onUpdateWidgets([...sorted]);
  };

  const categories = [
    { key: 'CHUNG', label: '📊 Tổng quan & Chỉ số KPI' },
    { key: 'BIỂU ĐỒ CHUYÊN SÂU', label: '📈 Biểu đồ Phân tích Chuyên sâu' },
    { key: 'BẢNG CẢNH BÁO', label: '⚡ Bảng Cảnh báo & Theo dõi' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#05469B] to-blue-700 text-white">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2 tracking-wide">
              <span>⚙️</span> Tùy chỉnh & Ghim Widget Dashboard
            </h2>
            <p className="text-xs text-blue-100 mt-0.5">
              Kéo thả, ẩn/hiện hoặc ghim (⭐) biểu đồ/bảng dữ liệu theo đúng chuyên môn của bạn
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3.5 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
            <span className="text-base">💡</span>
            <div>
              <p className="font-bold">Mẹo dành cho Người chuyên trách:</p>
              <p className="mt-0.5">
                Các Widget được gắn nhãn <span className="font-bold text-amber-600 dark:text-amber-400">⭐ Đã ghim</span> sẽ luôn ưu tiên hiển thị ngay trên cùng màn hình Dashboard, bất kể thứ tự thông thường. Bạn có thể ẩn bớt các biểu đồ không thuộc phạm vi theo dõi để tối ưu tốc độ làm việc.
              </p>
            </div>
          </div>

          {categories.map(cat => {
            const catWidgets = widgets.filter(w => w.category === cat.key).sort((a, b) => a.order - b.order);
            if (catWidgets.length === 0) return null;

            return (
              <div key={cat.key} className="space-y-2.5">
                <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                  {cat.label}
                </h3>
                <div className="space-y-2">
                  {catWidgets.map(widget => (
                    <div 
                      key={widget.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        widget.pinned 
                          ? 'bg-amber-50/70 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 shadow-sm' 
                          : widget.visible
                            ? 'bg-white dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                            : 'bg-gray-50 dark:bg-slate-800/30 border-gray-200 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleTogglePin(widget.id)}
                          title={widget.pinned ? 'Bỏ ghim khỏi đầu trang' : 'Ghim lên vị trí đầu tiên'}
                          className={`p-2 rounded-lg transition-all ${
                            widget.pinned 
                              ? 'bg-amber-400 text-white shadow-sm scale-110' 
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-400 hover:text-amber-500'
                          }`}
                        >
                          <Star size={16} className={widget.pinned ? 'fill-current' : ''} />
                        </button>
                        <span className="text-xl">{widget.icon}</span>
                        <div>
                          <p className={`font-bold text-sm ${widget.visible ? 'text-gray-800 dark:text-slate-100' : 'text-gray-400 line-through'}`}>
                            {widget.title}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {widget.pinned ? '⭐ Đang ghim trên đầu Dashboard' : widget.visible ? 'Hiển thị bình thường' : 'Đang ẩn'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Move Up / Down */}
                        <div className="flex items-center bg-gray-100 dark:bg-slate-700/60 rounded-lg p-0.5 border border-gray-200 dark:border-slate-600">
                          <button
                            onClick={() => handleMove(widget.id, 'up')}
                            title="Di chuyển lên trước"
                            className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-gray-600 dark:text-slate-300 transition-colors"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMove(widget.id, 'down')}
                            title="Di chuyển xuống sau"
                            className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-gray-600 dark:text-slate-300 transition-colors"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>

                        {/* Toggle Visible */}
                        <button
                          onClick={() => handleToggleVisible(widget.id)}
                          title={widget.visible ? 'Ẩn widget' : 'Hiện widget'}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                            widget.visible
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
                          }`}
                        >
                          {widget.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          <span>{widget.visible ? 'Hiện' : 'Ẩn'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 flex items-center justify-between">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
          >
            <RotateCcw size={14} />
            <span>Khôi phục Mặc định</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#05469B] hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all"
          >
            <Check size={16} />
            <span>Lưu & Áp dụng</span>
          </button>
        </div>
      </div>
    </div>
  );
}
