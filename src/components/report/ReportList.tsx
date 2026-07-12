// src/components/report/ReportList.tsx
import React from 'react';
import { REPORT_TEMPLATES, ReportTemplate } from '../../constants/reportTemplates';
import { Building2, Users, FileText, ChevronRight, FileSpreadsheet } from 'lucide-react';

interface ReportListProps {
  selectedTemplate: ReportTemplate | null;
  onSelectTemplate: (template: ReportTemplate) => void;
}

export default function ReportList({
  selectedTemplate,
  onSelectTemplate
}: ReportListProps) {
  // Gom nhóm các mẫu báo cáo theo Module
  const modules = ['HỆ THỐNG', 'NHÂN SỰ', 'VĂN BẢN'] as const;

  const getModuleIcon = (mod: string) => {
    switch (mod) {
      case 'HỆ THỐNG': return <Building2 className="text-[#05469B]" size={18} />;
      case 'NHÂN SỰ': return <Users className="text-emerald-600" size={18} />;
      case 'VĂN BẢN': return <FileText className="text-indigo-600" size={18} />;
      default: return <FileSpreadsheet className="text-gray-600" size={18} />;
    }
  };

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2': return <Building2 size={18} />;
      case 'Users': return <Users size={18} />;
      case 'GraduationCap': return <Users size={18} />; // Dùng tạm Users thay GraduationCap
      case 'TrendingUp': return <Users size={18} />;
      case 'FileText': return <FileText size={18} />;
      default: return <FileSpreadsheet size={18} />;
    }
  };

  const getTemplateBadgeStyle = (mod: string) => {
    switch (mod) {
      case 'HỆ THỐNG': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'NHÂN SỰ': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'VĂN BẢN': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {modules.map((mod) => {
        const templates = REPORT_TEMPLATES.filter((t) => t.module === mod);
        if (templates.length === 0) return null;

        return (
          <div key={mod} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              {getModuleIcon(mod)}
              <h3 className="text-xs font-black text-gray-600 uppercase tracking-widest">{mod}</h3>
              <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 border border-gray-200 rounded text-gray-500 font-bold">{templates.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl) => {
                const isSelected = selectedTemplate?.id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => onSelectTemplate(tpl)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start gap-3.5 shadow-2xs group relative overflow-hidden ${
                      isSelected
                        ? 'bg-white border-[#05469B] ring-2 ring-blue-500/20'
                        : 'bg-white/60 border-gray-200 hover:border-gray-300 hover:bg-white'
                    }`}
                  >
                    {/* Background Highlight bar */}
                    {isSelected && (
                      <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#05469B]" />
                    )}

                    <div className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#05469B] text-white border-blue-700'
                        : 'bg-slate-50 text-slate-500 border-slate-100 group-hover:bg-blue-50 group-hover:text-[#05469B]'
                    }`}>
                      {getTemplateIcon(tpl.icon)}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-black text-[13.5px] text-gray-800 leading-snug group-hover:text-[#05469B] transition-colors">{tpl.title}</h4>
                        {tpl.customizable && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded">Tùy biến cột</span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-gray-500 leading-relaxed font-medium">{tpl.description}</p>
                    </div>

                    <ChevronRight size={16} className={`absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 transition-transform ${
                      isSelected ? 'text-[#05469B] translate-x-0.5' : 'group-hover:text-gray-400 group-hover:translate-x-1'
                    }`} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
