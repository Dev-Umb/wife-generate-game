import React from 'react';

interface Props {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<Props> = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-purple-500"></div>
        
        <h3 className="text-xl font-bold text-white mb-4">确认操作</h3>
        <p className="text-slate-300 mb-8 leading-relaxed text-sm">{message}</p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20 text-sm"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};