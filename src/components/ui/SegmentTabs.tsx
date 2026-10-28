import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ====================================================================================
// 🎨 BẢNG CẤU HÌNH MÃ MÀU NHẬN DIỆN CHO TỪNG PHÂN HỆ (DỄ DÀNG ĐỔI MÀU TẠI ĐÂY)
// 👉 Khi cần thay đổi màu, bạn chỉ cần thay mã màu (HEX hoặc RGB) tương ứng dưới đây:
// ====================================================================================
export const TAB_THEMES = {
  // 1. Quản lý Văn thư lưu trữ (VTLT)
  vtlt: {
    activeBg: 'rgb(254, 251, 235)',      // Nền khi chọn: Vàng kem ngà nhạt
    activeText: 'text-[rgb(0,82,156)]',   // Chữ khi chọn: Xanh đậm VTLT
    hoverColor: 'rgb(0, 82, 156)',        // Chữ & icon khi rê chuột vào: Xanh dương sắc nét
  },
  // 2. Quản lý Trang thiết bị VP (TTB)
  equipment: {
    activeBg: '#05469B',                 // Nền khi chọn: Xanh Sapphire
    activeText: 'text-white',             // Chữ khi chọn: Trắng
    hoverColor: '#05469B',                // Chữ & icon khi rê chuột
  },
  // 3. Thông tin Nhân sự
  personnel: {
    activeBg: '#00539c',                 // Nền khi chọn: Xanh Navy
    activeText: 'text-white',             // Chữ khi chọn: Trắng
    hoverColor: '#00539c',                // Chữ & icon khi rê chuột
    subBg: '#00539c',                    // Nền dải tab con cấp 2
    subActiveBg: '#00386b',              // Nền tab con khi chọn (xanh navy đậm hơn)
  },
  // 4. Quản lý Xe
  vehicle: {
    activeBg: '#005698',                 // Nền khi chọn: Xanh Biển
    activeText: 'text-white',             // Chữ khi chọn: Trắng
    hoverColor: '#005698',                // Chữ & icon khi rê chuột
    subBg: '#005698',                    // Nền dải tab con cấp 2
    subActiveBg: '#00386b',              // Nền tab con khi chọn
  },
  // 5. Quản lý Chi phí
  cost: {
    activeBg: '#D97706',                 // Nền khi chọn: Vàng Hổ Phách / Cam Amber
    activeText: 'text-white',             // Chữ khi chọn: Trắng
    hoverColor: '#D97706',                // Chữ & icon khi rê chuột
    subBg: '#D97706',                    // Nền dải tab con cấp 2
    subActiveBg: '#92400e',              // Nền tab con khi chọn (amber-800)
  },
  // 6. An toàn vệ sinh lao động (ATVSLĐ)
  atvsld: {
    activeBg: '#059669',                 // Nền khi chọn: Xanh Ngọc Lục Bảo (Emerald)
    activeText: 'text-white',             // Chữ khi chọn: Trắng
    hoverColor: '#059669',                // Chữ & icon khi rê chuột
    subBg: '#059669',                    // Nền dải tab con cấp 2
    subActiveBg: '#065f46',              // Nền tab con khi chọn (emerald-800)
    level3Bg: '#065f46',                 // Nền dải tab con cấp 3
    level3ActiveBg: '#65a30d',           // Nền tab con cấp 3 khi chọn (lime-600)
  },
} as const;

export type TabThemeKey = keyof typeof TAB_THEMES;

export interface TabItem {
  id: string;
  label: string;
  count?: number | null;
  icon?: React.ReactNode;
  subTabs?: TabItem[]; // Danh sách tab con cấp 2 (nếu có)
}

export interface SegmentTabsProps {
  // Danh sách tab & tab đang chọn
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  layoutId?: string;

  // Chọn Theme nhận diện có sẵn: 'vtlt' | 'equipment' | 'personnel' | 'vehicle' | 'cost' | 'atvsld'
  theme?: TabThemeKey;

  // Tùy chỉnh màu thủ công (nếu không dùng theme)
  activeBgColor?: string;
  activeTextColor?: string;
  hoverColor?: string;
  hoverTextColor?: string;

  // Tab con Cấp 2 (nếu có lồng khối)
  activeSubTab?: string;
  onSubChange?: (id: string) => void;
  subTabsLayoutId?: string;

  // Tab con Cấp 3 (dành riêng cho trường hợp như ATVSLĐ)
  activeSubTab3?: string;
  onSubChange3?: (id: string) => void;
  subTabs3LayoutId?: string;

  // Bố cục & hiển thị
  fullWidth?: boolean;
  className?: string;
}

export const SegmentTabs: React.FC<SegmentTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  layoutId = 'segmentTabSlide',
  theme,
  activeBgColor,
  activeTextColor,
  hoverColor,
  hoverTextColor,
  activeSubTab,
  onSubChange,
  subTabsLayoutId,
  activeSubTab3,
  onSubChange3,
  subTabs3LayoutId,
  fullWidth = false,
  className = ''
}) => {
  // Lấy cấu hình màu từ Theme hoặc props truyền vào
  const themeConfig = theme ? TAB_THEMES[theme] : null;

  const resolvedActiveBg = activeBgColor || themeConfig?.activeBg || '#005698';
  const resolvedActiveText = activeTextColor || themeConfig?.activeText || 'text-white';
  
  // Màu chữ & icon khi rê chuột: nếu không chỉ định, tự động lấy hoverColor của Theme hoặc fallback an toàn
  const resolvedHoverColor = hoverColor || themeConfig?.hoverColor || (resolvedActiveText === 'text-white' ? resolvedActiveBg : '#00529C');

  // Xác định tab cha hiện tại & kiểm tra có tab con cấp 2 không
  const currentActiveTab = tabs.find(t => t.id === activeTab);
  const hasSubTabs = Boolean(currentActiveTab?.subTabs && currentActiveTab.subTabs.length > 0);

  // Xác định tab con cấp 2 hiện tại & kiểm tra có tab con cấp 3 không
  const currentActiveSubTab = currentActiveTab?.subTabs?.find(st => st.id === activeSubTab);
  const hasSubTabs3 = Boolean(currentActiveSubTab?.subTabs && currentActiveSubTab.subTabs.length > 0);

  // Style CSS Variables dùng cho trượt và hover
  const navStyle = {
    '--active-color': resolvedActiveBg,
    '--hover-color': resolvedHoverColor,
  } as React.CSSProperties;

  // 🟢 DẠNG 1: FULL-WIDTH (DÙNG CHO TẤT CẢ CÁC BẢNG LỚN & TAB LỒNG KHỐI)
  if (fullWidth || hasSubTabs) {
    return (
      <div className={`w-full flex flex-col mb-4 select-none shrink-0 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 ${className}`}>
        
        {/* --- CẤP 1 (HÀNG TAB CHÍNH) --- */}
        <nav 
          className={`w-full bg-gray-100 dark:bg-slate-800 flex flex-wrap gap-1 pt-1 px-1 items-center relative transition-all duration-300 ${
            hasSubTabs ? 'pb-0 border-b-0' : 'pb-1'
          }`}
          aria-label="Tabs" 
          role="tablist" 
          aria-orientation="horizontal"
          style={navStyle}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap outline-none border-none bg-transparent ${
                  isActive 
                    ? `${resolvedActiveText} font-black z-10 ${hasSubTabs ? 'pb-2.5 sm:pb-3' : ''}` 
                    : `${hoverTextColor || 'hover:text-[var(--hover-color)]'} text-gray-500 hover:bg-white/60 dark:hover:bg-slate-700/60`
                }`}
                role="tab"
                aria-selected={isActive}
              >
                {/* Thanh trượt chỉ báo nền (Sliding motion indicator) */}
                {isActive && (
                  <motion.div
                    layoutId={layoutId}
                    className={`absolute inset-0 z-0 shadow-xs ${
                      hasSubTabs ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'
                    }`}
                    style={{ backgroundColor: 'var(--active-color)' }}
                    transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                  />
                )}

                {/* Icon và Nhãn tiêu đề */}
                {tab.icon && <span className="relative z-10 shrink-0 flex items-center">{tab.icon}</span>}
                <span className="relative z-10">{tab.label}</span>
                
                {/* Tag đếm số lượng */}
                {tab.count !== undefined && tab.count !== null && (
                  <span 
                    className={`relative z-10 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ${
                      isActive 
                        ? (resolvedActiveText.includes('text-white') ? 'bg-white/20 text-white' : 'bg-black/10 ' + resolvedActiveText)
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* --- CẤP 2 (TAB CON LỒNG KHỐI - NẾU CÓ) --- */}
        <AnimatePresence initial={false}>
          {hasSubTabs && currentActiveTab && (
            <motion.div
              key={`level2-${activeTab}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
              style={{ 
                backgroundColor: (themeConfig && 'subBg' in themeConfig ? (themeConfig as any).subBg : resolvedActiveBg) 
              }}
            >
              <div className={`w-full flex flex-wrap gap-4 px-4 pt-1.5 items-center transition-all duration-300 ${hasSubTabs3 ? 'pb-0' : 'pb-1.5'}`}>
                {currentActiveTab.subTabs!.map((st) => {
                  const isSubActive = activeSubTab === st.id;
                  const isLevel3OpenUnderThis = Boolean(isSubActive && st.subTabs && st.subTabs.length > 0);
                  const subActiveBgColor = (themeConfig && 'subActiveBg' in themeConfig ? (themeConfig as any).subActiveBg : 'rgba(0, 0, 0, 0.25)');

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onSubChange && onSubChange(st.id)}
                      className={`relative py-1.5 px-4 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer rounded-lg bg-transparent ${
                        isSubActive 
                          ? `text-white font-black ${isLevel3OpenUnderThis ? 'pb-2.5 rounded-b-none' : ''}` 
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {/* Trượt nền cho Tab con cấp 2 */}
                      {isSubActive && (
                        <motion.div
                          layoutId={subTabsLayoutId || `${layoutId}SubSlide`}
                          className={`absolute inset-0 rounded-lg shadow-sm ring-1 ring-white/20 z-0 ${
                            isLevel3OpenUnderThis ? 'rounded-t-lg rounded-b-none' : 'rounded-lg'
                          }`}
                          style={{ backgroundColor: subActiveBgColor }}
                          transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.28 }}
                        />
                      )}

                      <span className="relative z-10 flex items-center gap-1.5">
                        {st.icon && <span className="shrink-0">{st.icon}</span>}
                        <span>{st.label}</span>
                      </span>

                      {st.count !== undefined && st.count !== null && (
                        <span className={`relative z-10 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSubActive ? 'bg-sky-600/90 text-white' : 'bg-white/15 text-white/90'
                        }`}>
                          {st.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* --- CẤP 3 (TAB CON CỦA CẤP 2 - NẾU CÓ, NHƯ ATVSLĐ) --- */}
              {hasSubTabs3 && currentActiveSubTab && (
                <div 
                  className="overflow-hidden"
                  style={{ 
                    backgroundColor: (themeConfig && 'level3Bg' in themeConfig ? (themeConfig as any).level3Bg : 'rgba(0, 0, 0, 0.2)') 
                  }}
                >
                  <div className="w-full flex flex-wrap gap-4 px-6 py-2 items-center">
                    {currentActiveSubTab.subTabs!.map((st3) => {
                      const isSub3Active = activeSubTab3 === st3.id;
                      const level3ActiveBgColor = (themeConfig && 'level3ActiveBg' in themeConfig ? (themeConfig as any).level3ActiveBg : '#65a30d');

                      return (
                        <button
                          key={st3.id}
                          type="button"
                          onClick={() => onSubChange3 && onSubChange3(st3.id)}
                          className={`relative py-1.5 px-3.5 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer rounded-lg bg-transparent ${
                            isSub3Active ? 'text-white font-black' : 'text-white/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {isSub3Active && (
                            <motion.div
                              layoutId={subTabs3LayoutId || `${layoutId}Sub3Slide`}
                              className="absolute inset-0 rounded-lg shadow-sm ring-1 ring-lime-400 font-black z-0"
                              style={{ backgroundColor: level3ActiveBgColor }}
                              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.28 }}
                            />
                          )}

                          <span className="relative z-10 flex items-center gap-1.5">
                            {st3.icon && <span className="shrink-0">{st3.icon}</span>}
                            <span>{st3.label}</span>
                          </span>

                          {st3.count !== undefined && st3.count !== null && (
                            <span className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isSub3Active ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'
                            }`}>
                              {st3.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    );
  }

  // 🟢 DẠNG 2: INLINE CUỘN NGANG (DÀNH CHO TAB NHỎ / NỘI DUNG NGẮN)
  return (
    <div className={`w-full overflow-x-auto custom-scrollbar select-none py-1 shrink-0 ${className}`}>
      <nav 
        className="flex bg-gray-100 dark:bg-slate-800 rounded-full w-fit relative p-1 gap-1 border border-gray-200/50 dark:border-slate-700/50 shadow-xs items-center" 
        aria-label="Tabs" 
        role="tablist" 
        aria-orientation="horizontal"
        style={navStyle}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-full transition-all duration-200 cursor-pointer whitespace-nowrap outline-none border-none bg-transparent ${
                isActive 
                  ? `${resolvedActiveText} font-black` 
                  : `${hoverTextColor || 'hover:text-[var(--hover-color)]'} text-gray-500 hover:bg-transparent`
              }`}
              role="tab"
              aria-selected={isActive}
            >
              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-full z-0"
                  style={{ backgroundColor: 'var(--active-color)' }}
                  transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                />
              )}

              {tab.icon && <span className="relative z-10 shrink-0 flex items-center">{tab.icon}</span>}
              <span className="relative z-10">{tab.label}</span>
              
              {tab.count !== undefined && tab.count !== null && (
                <span 
                  className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-black transition-colors duration-200 ${
                    isActive 
                      ? (resolvedActiveText.includes('text-white') ? 'bg-white/20 text-white' : 'bg-black/10 ' + resolvedActiveText)
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default SegmentTabs;
