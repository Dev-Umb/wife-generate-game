import React, { useState, useEffect, useRef } from 'react';
import { WaifuProfile } from '../types';

interface Props {
  profile: WaifuProfile;
  image: string;
  affection: number;
  hasContactInfo?: boolean;
  unlockedSecrets?: string[];
}

export const CharacterCard: React.FC<Props> = ({ profile, image, affection, hasContactInfo, unlockedSecrets = [] }) => {
  // Determine heart color based on affection
  let heartColor = "text-slate-600";
  if (affection > 800) heartColor = "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]";
  else if (affection > 500) heartColor = "text-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]";
  else if (affection > 200) heartColor = "text-pink-400";
  else if (affection > 100) heartColor = "text-pink-300";

  // Animation logic for Affection Change
  const [changeDelta, setChangeDelta] = useState<number | null>(null);
  const prevAffectionRef = useRef(affection);

  useEffect(() => {
    const diff = affection - prevAffectionRef.current;
    if (diff !== 0) {
        setChangeDelta(diff);
        // Reset delta visualization after animation completes
        const timer = setTimeout(() => {
            setChangeDelta(null);
        }, 2000); 
        prevAffectionRef.current = affection;
        return () => clearTimeout(timer);
    }
  }, [affection]);

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide pb-20 md:pb-0">
      {/* Image Container */}
      <div className="relative w-full aspect-[3/4] bg-slate-800 rounded-2xl overflow-hidden shadow-2xl mb-4 group shrink-0">
        <img 
            src={image} 
            alt={profile.name} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
        />
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent opacity-90" />

        {/* Affection Meter & Feedback */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1 z-20">
            {/* Floating Feedback Text */}
            {changeDelta !== null && (
                <div className={`text-2xl font-bold animate-fade-out-up drop-shadow-md mr-2 ${changeDelta > 0 ? 'text-green-400' : 'text-red-500'}`}>
                    {changeDelta > 0 ? '+' : ''}{changeDelta}
                </div>
            )}

            {/* Meter */}
            <div className={`bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border transition-all duration-300 ${changeDelta ? 'scale-110 border-pink-500 bg-black/60' : 'border-white/10'}`}>
                <svg className={`w-6 h-6 ${heartColor} transition-colors duration-500 fill-current ${changeDelta ? 'animate-pulse' : ''}`} viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span className="font-bold text-white text-sm">{affection}<span className="text-white/50 text-xs">/1000</span></span>
            </div>
        </div>

        {/* Name Overlay - Optimized Layout */}
        <div className="absolute bottom-0 left-0 w-full p-6 z-20 flex flex-col justify-end">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg leading-tight break-words">
                {profile.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
                <span className="bg-purple-600/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded border border-purple-400/30">
                    {profile.race}
                </span>
                <span className="bg-slate-700/80 backdrop-blur-sm text-slate-200 text-xs px-2 py-1 rounded border border-white/10">
                    {profile.age}
                </span>
            </div>
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5 space-y-4 backdrop-blur-sm flex-1">
        <div className="flex justify-between items-start">
             <div>
                <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">职业</h3>
                <p className="text-slate-100">{profile.job}</p>
             </div>
             {hasContactInfo && (
                 <div className="bg-indigo-600/20 text-indigo-300 text-xs px-2 py-1 rounded border border-indigo-500/30 flex items-center gap-1">
                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                     已获取联系方式
                 </div>
             )}
        </div>
        
        <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">性格</h3>
            <p className="text-slate-100 text-sm leading-relaxed">{profile.personality}</p>
        </div>

        <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">外貌特征</h3>
            <p className="text-slate-100 text-sm leading-relaxed">{profile.appearance}</p>
        </div>

        <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">背景故事</h3>
            <p className="text-slate-300 text-sm italic leading-relaxed border-l-2 border-purple-500 pl-3">
                "{profile.backstory}"
            </p>
        </div>

        {/* Memory Fragments List */}
        <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-2">
                记忆碎片 ({unlockedSecrets.length}/10)
            </h3>
            <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }).map((_, i) => {
                    const isUnlocked = i < unlockedSecrets.length;
                    return (
                        <div 
                            key={i}
                            className={`aspect-square rounded-md flex items-center justify-center text-xs font-bold border transition-all cursor-help ${
                                isUnlocked 
                                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/30' 
                                : 'bg-slate-700 border-slate-600 text-slate-500'
                            }`}
                            title={isUnlocked ? unlockedSecrets[i] : (affection < 100 ? "需好感度 > 100 且触发剧情解锁" : "需在剧情中找到线索解锁")}
                        >
                            {isUnlocked ? (i + 1) : <span className="opacity-30">🔒</span>}
                        </div>
                    );
                })}
            </div>
            {unlockedSecrets.length > 0 && (
                <div className="mt-2 text-xs text-purple-200 bg-purple-900/30 p-2 rounded border border-purple-500/20 italic">
                    最新解锁: "{unlockedSecrets[unlockedSecrets.length - 1]}"
                </div>
            )}
        </div>

        {/* Deep Secret */}
        {affection > 500 ? (
            <div className="animate-pulse bg-pink-900/20 p-3 rounded-xl border border-pink-500/30">
                <h3 className="text-pink-400 text-xs uppercase tracking-widest font-bold mb-1">深藏的秘密 (已解锁)</h3>
                <p className="text-pink-100 text-sm">{profile.secret}</p>
            </div>
        ) : (
             <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                <h3 className="text-slate-600 text-xs uppercase tracking-widest font-bold mb-1">深藏的秘密</h3>
                <p className="text-slate-600 text-sm blur-[2px] select-none">
                    此秘密需好感度 &gt; 500 且在重大剧情中由她亲口诉说。
                </p>
            </div>
        )}
      </div>
    </div>
  );
};