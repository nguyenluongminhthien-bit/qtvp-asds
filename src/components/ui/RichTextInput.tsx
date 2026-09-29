import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Bold, Italic, Underline } from 'lucide-react';

interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  multiline?: boolean;
  style?: React.CSSProperties;
}

export default function RichTextInput({
  value,
  onChange,
  placeholder = '',
  className = '',
  disabled = false,
  multiline = false,
  style
}: RichTextInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChangeRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Đồng bộ giá trị từ ngoài vào editor khi không phải do người dùng đang gõ
  useEffect(() => {
    if (editorRef.current && !isInternalChangeRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      const targetHtml = value || '';
      if (currentHtml !== targetHtml) {
        editorRef.current.innerHTML = targetHtml;
      }
    }
    isInternalChangeRef.current = false;
  }, [value]);

  // Kiểm tra chuỗi có thực sự trống (chỉ chứa thẻ HTML rác hoặc khoảng trắng)
  const isHtmlEmpty = (val: string) => {
    if (!val) return true;
    const stripped = val.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    return stripped === '';
  };

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternalChangeRef.current = true;
    let html = editorRef.current.innerHTML;
    // Chuẩn hóa chuỗi trống nếu không có chữ nào (chỉ chứa thẻ br, div, khoảng trắng)
    if (isHtmlEmpty(html)) {
      html = '';
    }
    onChange(html);
  }, [onChange]);

  // Xử lý phím tắt Ctrl+B, Ctrl+I, Ctrl+U và phím Enter / Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false);
        handleInput();
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false);
        handleInput();
        return;
      }
      if (key === 'u') {
        e.preventDefault();
        document.execCommand('underline', false);
        handleInput();
        return;
      }
    }

    if (e.key === 'Enter') {
      if (!multiline) {
        e.preventDefault();
        return;
      }

      // Khi multiline = true, cho phép xuống dòng sạch sẽ bằng thẻ <br>
      e.preventDefault();
      const success = document.execCommand('insertLineBreak');
      if (!success) {
        // Fallback chèn thẻ <br> chuẩn DOM nếu execCommand không khả dụng
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const br = document.createElement('br');
          range.insertNode(br);
          range.setStartAfter(br);
          range.setEndAfter(br);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      handleInput();
      return;
    }
  };

  // Xử lý dán văn bản (Paste): làm sạch mã rác, giữ lại ngắt dòng sạch nếu multiline
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    if (multiline) {
      // Chuyển đổi các dấu xuống dòng thành <br>
      const formattedHtml = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r\n|\r|\n/g, '<br>');
      document.execCommand('insertHTML', false, formattedHtml);
    } else {
      // 1 dòng: bỏ dấu xuống dòng, thay bằng khoảng trắng
      const singleLine = text.replace(/[\r\n]+/g, ' ');
      document.execCommand('insertText', false, singleLine);
    }
    handleInput();
  };

  const executeCommand = (cmd: 'bold' | 'italic' | 'underline', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd, false);
    handleInput();
  };

  const isEmpty = isHtmlEmpty(value);

  return (
    <div
      className="relative group/rich-input inline-block w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          handleInput();
        }}
        style={style}
        className={`outline-none min-h-[1.5em] transition-all relative z-10 ${
          disabled ? 'opacity-70 cursor-not-allowed select-none' : 'cursor-text'
        } ${className}`}
      />

      {/* Placeholder hiển thị khi trống */}
      {isEmpty && placeholder && (
        <div
          onClick={() => {
            if (!disabled && editorRef.current) {
              editorRef.current.focus();
            }
          }}
          className={`absolute inset-0 flex px-1 text-slate-400 font-normal pointer-events-none select-none z-0 truncate ${
            multiline ? 'items-start pt-0.5' : 'items-center'
          }`}
        >
          {placeholder}
        </div>
      )}

      {/* Mini toolbar B / I / U nổi khi focus hoặc hover (không hiện nếu disabled) */}
      {!disabled && (isFocused || isHovered) && (
        <div
          className="absolute right-1 -top-7 z-30 flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-md px-1 py-0.5 text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onMouseDown={(e) => executeCommand('bold', e)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="In đậm (Ctrl+B)"
          >
            <Bold size={11} strokeWidth={3} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => executeCommand('italic', e)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="In nghiêng (Ctrl+I)"
          >
            <Italic size={11} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => executeCommand('underline', e)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="Gạch chân (Ctrl+U)"
          >
            <Underline size={11} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
