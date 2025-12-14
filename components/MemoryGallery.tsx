import React from 'react';
import { StoryMemory } from '../types';

interface Props {
  memories: StoryMemory[];
  onClose?: () => void;
}

export const MemoryGallery: React.FC<Props> = ({ memories, onClose }) => {
  return (
    <div className="h-full bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
        <div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                珍贵回忆
            </h2>
            <p className="text-slate-400 text-sm mt-1">记录我们共同经历的点点滴滴</p>
        </div>
        {onClose && (
             <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {memories.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 space-y-4">
                <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <p>暂时没有回忆。去创造属于你们的故事吧！</p>
            </div>
        ) : (
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {memories.map((memory, index) => (
                    <div key={memory.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Icon */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-pink-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:static">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        </div>
                        
                        {/* Card */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-800/80 p-4 rounded-xl border border-white/5 shadow-lg ml-14 md:ml-0 hover:border-pink-500/30 transition-all">
                             {memory.imageUrl && (
                                <div className="aspect-video w-full rounded-lg overflow-hidden mb-3">
                                    <img src={memory.imageUrl} alt={memory.title} className="w-full h-full object-cover" />
                                </div>
                             )}
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg text-white">{memory.title}</h3>
                                <time className="text-xs text-slate-500 font-mono">{new Date(memory.timestamp).toLocaleDateString()}</time>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed">{memory.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};