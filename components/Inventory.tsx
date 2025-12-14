import React from 'react';
import { InventoryItem } from '../types';

interface Props {
  items: InventoryItem[];
  isOpen: boolean;
  onClose: () => void;
}

export const Inventory: React.FC<Props> = ({ items, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-600 rounded-2xl max-w-3xl w-full h-[80vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
            <div>
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                    我的背包
                </h2>
                <p className="text-slate-400 text-sm mt-1">收集到的物品与记忆</p>
            </div>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                    <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <p>背包是空的。去冒险寻找宝藏吧！</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map(item => (
                        <div key={item.id} className="bg-slate-800 border border-white/5 rounded-xl overflow-hidden hover:border-yellow-500/50 transition-all group">
                            <div className="aspect-square bg-black/40 relative overflow-hidden">
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            <div className="p-3">
                                <h3 className="text-yellow-400 font-bold truncate">{item.name}</h3>
                                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};