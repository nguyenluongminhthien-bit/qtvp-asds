import React from 'react';
import { motion } from 'motion/react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SegmentTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  layoutId: string;
  activeBgColor?: string; // defaults to '#005698'
  fullWidth?: boolean;
  className?: string;
}

export const SegmentTabs: React.FC<SegmentTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  layoutId,
  activeBgColor = '#005698',
  fullWidth = false,
  className = ''
}) => {
  if (fullWidth) {
    return (
      <div className={`w-full flex flex-col mb-4 select-none shrink-0 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 ${className}`}>
        <nav 
          className="w-full bg-gray-100 dark:bg-slate-800 flex flex-wrap gap-1 p-1 items-center relative" 
          aria-label="Tabs" 
          role="tablist" 
          aria-orientation="horizontal"
          style={{ '--active-color': activeBgColor } as React.CSSProperties}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors duration-200 cursor-pointer whitespace-nowrap outline-none border-none bg-transparent ${
                  isActive 
                    ? 'text-white font-black' 
                    : 'text-gray-500 hover:text-[var(--active-color)] hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
                role="tab"
                aria-selected={isActive}
              >
                {/* Sliding background indicator */}
                {isActive && (
                  <motion.div
                    layoutId={layoutId}
                    className="absolute inset-0 rounded-xl z-0 shadow-xs"
                    style={{ backgroundColor: 'var(--active-color)' }}
                    transition={{ type: 'spring', duration: 0.35, bounce: 0.05 }}
                  />
                )}

                {/* Icon and label must be relative z-10 to stay on top of active indicator */}
                {tab.icon && <span className="relative z-10 shrink-0 flex items-center">{tab.icon}</span>}
                <span className="relative z-10">{tab.label}</span>
                
                {tab.count !== undefined && (
                  <span 
                    className={`relative z-10 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ${
                      isActive 
                        ? 'bg-white/20 text-white' 
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
  }

  return (
    <div className={`w-full overflow-x-auto custom-scrollbar select-none py-1 shrink-0 ${className}`}>
      <nav 
        className="flex bg-gray-100 dark:bg-slate-800 rounded-full w-fit relative p-1 gap-1 border border-gray-200/50 dark:border-slate-700/50 shadow-xs items-center" 
        aria-label="Tabs" 
        role="tablist" 
        aria-orientation="horizontal"
        style={{ '--active-color': activeBgColor } as React.CSSProperties}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-full transition-colors duration-200 cursor-pointer whitespace-nowrap outline-none border-none bg-transparent ${
                isActive 
                  ? 'text-white font-black' 
                  : 'text-gray-500 hover:text-[var(--active-color)] hover:bg-transparent'
              }`}
              role="tab"
              aria-selected={isActive}
            >
              {/* Sliding background indicator */}
              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-full z-0"
                  style={{ backgroundColor: 'var(--active-color)' }}
                  transition={{ type: 'spring', duration: 0.35, bounce: 0.05 }}
                />
              )}

              {/* Icon and label must be relative z-10 to stay on top of active indicator */}
              {tab.icon && <span className="relative z-10 shrink-0 flex items-center">{tab.icon}</span>}
              <span className="relative z-10">{tab.label}</span>
              
              {tab.count !== undefined && (
                <span 
                  className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-black transition-colors duration-200 ${
                    isActive 
                      ? 'bg-white/20 text-white' 
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
