import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  initialValue: string;
  title: string;
  placeholder?: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export const TextEditorModal: React.FC<Props> = ({ isOpen, initialValue, title, placeholder, onSave, onClose }) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
        setValue(initialValue);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSave = () => {
      onSave(value);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        {/* Editor */}
        <div className="flex-1 p-4 bg-slate-900">
            <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full h-full bg-transparent text-slate-200 resize-none focus:outline-none text-base leading-relaxed scrollbar-hide"
                autoFocus
            />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-900/50 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                取消
            </button>
            <button onClick={handleSave} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg transition-colors">
                保存内容
            </button>
        </div>
      </div>
    </div>
  );
};