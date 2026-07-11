import React from 'react';
import { BellRing, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';

interface ExpiryAlertPanelProps {
  isNotifHubOpen: boolean;
  setIsNotifHubOpen: (val: boolean) => void;
  expiredCount: number;
  warningCount: number;
  activeNotifTab: 'all' | 'vehicle' | 'equipment' | 'personnel_cert' | 'personnel_event';
  setActiveNotifTab: (val: 'all' | 'vehicle' | 'equipment' | 'personnel_cert' | 'personnel_event') => void;
  notifications: any[];
  filteredNotifications: any[];
}

export default function ExpiryAlertPanel({
  isNotifHubOpen,
  setIsNotifHubOpen,
  expiredCount,
  warningCount,
  activeNotifTab,
  setActiveNotifTab,
  notifications,
  filteredNotifications,
}: ExpiryAlertPanelProps) {
  return (
    <div className="flex flex-col mb-4">
      {/* Thanh ngang Bấm để bật/tắt bảng chi tiết */}
      <button 
        onClick={() => setIsNotifHubOpen(!isNotifHubOpen)}
        className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all hover:shadow-md cursor-pointer ${
          expiredCount > 0 
            ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-900 shadow-sm' 
            : warningCount > 0
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-900 shadow-sm'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-900 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm shrink-0 ${
            expiredCount > 0 
              ? 'bg-red-500 text-white animate-pulse shadow-red-200' 
              : warningCount > 0 
                ? 'bg-amber-500 text-white animate-bounce shadow-amber-200' 
                : 'bg-[#05469B] text-white shadow-blue-200'
          }`}>
            <BellRing size={18} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-xs sm:text-sm flex items-center gap-2">
              Trung tâm Thông báo
              {expiredCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase tracking-wider animate-bounce">
                  Phát hiện hạng mục quá hạn!
                </span>
              )}
            </h3>
            <p className="text-[11px] font-medium opacity-85 mt-0.5">
              {expiredCount > 0 ? `Có ${expiredCount} hạng mục quá hạn cần xử lý gấp. ` : ''}
              {warningCount > 0 ? `Có ${warningCount} hạng mục sắp đến hạn trong 30 ngày tới. ` : ''}
              {expiredCount === 0 && warningCount === 0 ? 'Hệ thống vận hành an toàn, không có cảnh báo mới.' : ''}
              {" "}<span className="underline font-bold">Nhấp vào đây để {isNotifHubOpen ? 'thu gọn' : 'xem chi tiết và phân loại'}</span>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex gap-1.5">
            {expiredCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-100 border border-red-200 text-red-700 text-[10px] font-black">
                {expiredCount} Quá hạn
              </span>
            )}
            {warningCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-black">
                {warningCount} Sắp đến hạn
              </span>
            )}
          </div>
          <div className="w-8 h-8 rounded-lg bg-white/50 hover:bg-white dark:bg-slate-700/50 dark:hover:bg-slate-700 border border-slate-200/40 flex items-center justify-center transition-colors">
            {isNotifHubOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
        </div>
      </button>

      {isNotifHubOpen && (
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-lg mt-3 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-100 pb-3">
            {[
              { id: 'all', label: 'Tất cả', count: notifications.length },
              { id: 'vehicle', label: '🚗 Đội xe', count: notifications.filter(n => n.category === 'vehicle').length },
              { id: 'equipment', label: '💻 Thiết bị', count: notifications.filter(n => n.category === 'equipment').length },
              { id: 'personnel_cert', label: '🛡️ Chứng chỉ & HĐ', count: notifications.filter(n => n.category === 'personnel_cert').length },
              { id: 'personnel_event', label: '🎂 Sinh nhật', count: notifications.filter(n => n.category === 'personnel_event').length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveNotifTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeNotifTab === tab.id
                    ? 'bg-[#05469B] text-white border-transparent shadow-sm'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                    activeNotifTab === tab.id
                      ? 'bg-white/20 text-white'
                      : tab.id === 'personnel_event'
                      ? 'bg-pink-100 text-pink-700 border border-pink-200'
                      : 'bg-red-50 text-red-600 border border-red-100'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <ShieldCheck size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="text-xs font-semibold">Hiện tại không có thông báo hay sự kiện nào sắp tới.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {filteredNotifications.map(notif => {
                const isBirthday = notif.category === 'personnel_event';
                
                if (isBirthday) {
                  let cardStyle = '';
                  let badgeStyle = '';
                  let badgeText = '';

                  if (notif.isPassed) {
                    cardStyle = 'bg-gray-50/80 border-gray-200 border-l-4 border-l-gray-400 opacity-55 grayscale-[35%]';
                    badgeStyle = 'bg-gray-200 text-gray-600';
                    badgeText = 'Đã qua';
                  } else if (notif.isToday) {
                    cardStyle = 'bg-pink-50/40 border-pink-300 border-l-4 border-l-rose-500 ring-1 ring-pink-400/30';
                    badgeStyle = 'bg-rose-500 text-white animate-bounce';
                    badgeText = 'Hôm nay 🎉';
                  } else {
                    cardStyle = 'bg-pink-50/20 border-pink-200 border-l-4 border-l-pink-500';
                    badgeStyle = 'bg-pink-100 text-pink-700';
                    badgeText = 'Sinh nhật';
                  }

                  return (
                    <div
                      key={notif.id}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all hover:-translate-y-0.5 hover:shadow-sm ${cardStyle}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeStyle}`}>
                          {badgeText}
                        </span>
                        <div className="text-right shrink-0 flex items-center gap-1.5">
                          <span className="text-xs font-black text-gray-700">{notif.dateStr}</span>
                          {notif.isPassed ? (
                            <span className="text-[9px] font-black text-gray-400 font-mono">Đã qua</span>
                          ) : notif.isToday ? (
                            <span className="text-[9px] font-black text-rose-600 font-mono">HÔM NAY</span>
                          ) : (
                            <span className="text-[9px] font-black text-pink-600">Còn {notif.daysLeft} ngày</span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-800 font-semibold mt-1.5 truncate">{notif.detail}</p>
                    </div>
                  );
                }

                let cardStyle = '';
                let badgeStyle = '';
                let badgeText = '';
                if (notif.type === 'expired') {
                  cardStyle = 'bg-red-50/30 border-red-200 border-l-4 border-l-red-500';
                  badgeStyle = 'bg-red-100 text-red-700';
                  badgeText = 'Quá hạn';
                } else {
                  cardStyle = 'bg-amber-50/20 border-amber-200 border-l-4 border-l-amber-500';
                  badgeStyle = 'bg-amber-100 text-amber-700';
                  badgeText = 'Sắp đến hạn';
                }

                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all hover:-translate-y-0.5 hover:shadow-sm ${cardStyle}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeStyle}`}>
                          {badgeText}
                        </span>
                        <h4 className="font-bold text-gray-800 text-xs mt-1.5">{notif.title}</h4>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">{notif.detail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-gray-700">{notif.dateStr}</p>
                        {notif.daysLeft < 0 ? (
                          <p className="text-[9px] font-black text-red-600 mt-0.5 font-mono">Trễ {Math.abs(notif.daysLeft)} ngày</p>
                        ) : notif.daysLeft === 0 ? (
                          <p className="text-[9px] font-black text-amber-600 mt-0.5 font-mono">HÔM NAY</p>
                        ) : (
                          <p className="text-[9px] font-black text-emerald-600 mt-0.5 font-mono">Còn {notif.daysLeft} ngày</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 border-t border-gray-100/50 pt-1.5 flex justify-between items-center text-[10px] font-semibold text-gray-400">
                      <span>{notif.category === 'vehicle' ? '🚗 Xe cộ' : notif.category === 'equipment' ? '💻 Thiết bị' : '🛡️ Chứng chỉ & HĐ'}</span>
                      <span className="truncate max-w-[150px]">{notif.unitName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
