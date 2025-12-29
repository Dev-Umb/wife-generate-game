import React, { useState, useEffect, useRef } from 'react';
import { WaifuProfile } from '../types';
import { ImageViewer } from './ImageViewer';

interface Props {
  profile: WaifuProfile;
  image: string;
  affection: number;
  hasContactInfo?: boolean;
  unlockedSecrets?: string[];
}

/** Collapsible text component for long content */
const CollapsibleText: React.FC<{ text: string; maxLines?: number; className?: string }> = ({ 
  text, 
  maxLines = 3, 
  className = "" 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(getComputedStyle(textRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * maxLines;
      setNeedsExpand(textRef.current.scrollHeight > maxHeight + 5);
    }
  }, [text, maxLines]);

  return (
    <div className="relative">
      <p 
        ref={textRef}
        className={`${className} transition-all duration-300 ${!isExpanded && needsExpand ? `line-clamp-${maxLines}` : ''}`}
        style={!isExpanded && needsExpand ? { 
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        } : {}}
      >
        {text}
      </p>
      {needsExpand && (
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-purple-400 hover:text-purple-300 text-xs mt-1 flex items-center gap-1 transition-colors"
        >
          {isExpanded ? (
            <>收起 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></>
          ) : (
            <>展开全部 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></>
          )}
        </button>
      )}
    </div>
  );
};

export const CharacterCard: React.FC<Props> = ({ profile, image, affection, hasContactInfo, unlockedSecrets = [] }) => {
  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);

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
        const timer = setTimeout(() => {
            setChangeDelta(null);
        }, 2000); 
        prevAffectionRef.current = affection;
        return () => clearTimeout(timer);
    }
  }, [affection]);

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-custom pr-1 space-y-4 min-h-0">
        {/* Image Container - Fixed Height */}
        <div className="relative w-full bg-slate-800 rounded-2xl overflow-hidden shadow-2xl group shrink-0" style={{ height: '512px' }}>
          <img 
              src={image} 
              alt={profile.name} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 cursor-pointer"
              onClick={() => setShowImageViewer(true)}
          />
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-90 pointer-events-none" />

          {/* Zoom Icon Hint */}
          <div 
            className="absolute top-3 left-3 p-2 bg-black/50 backdrop-blur-md rounded-full text-white/70 hover:text-white hover:bg-black/70 transition-all cursor-pointer z-20 opacity-0 group-hover:opacity-100"
            onClick={() => setShowImageViewer(true)}
            title="点击查看大图"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>

          {/* Affection Meter & Feedback */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-20">
              {changeDelta !== null && (
                  <div className={`text-xl font-bold animate-fade-out-up drop-shadow-md mr-1 ${changeDelta > 0 ? 'text-green-400' : 'text-red-500'}`}>
                      {changeDelta > 0 ? '+' : ''}{changeDelta}
                  </div>
              )}
              <div className={`bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5 border transition-all duration-300 ${changeDelta ? 'scale-110 border-pink-500 bg-black/60' : 'border-white/10'}`}>
                  <svg className={`w-5 h-5 ${heartColor} transition-colors duration-500 fill-current ${changeDelta ? 'animate-pulse' : ''}`} viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  <span className="font-bold text-white text-xs">{affection}<span className="text-white/50 text-[10px]">/1000</span></span>
              </div>
          </div>

          {/* Name Overlay */}
          <div className="absolute bottom-0 left-0 w-full p-4 z-20 flex flex-col justify-end">
              <h1 className="text-2xl font-bold text-white mb-1.5 drop-shadow-lg leading-tight break-words">
                  {profile.name}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5">
                  <span className="bg-purple-600/80 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded border border-purple-400/30">
                      {profile.race}
                  </span>
                  <span className="bg-slate-700/80 backdrop-blur-sm text-slate-200 text-[10px] px-2 py-0.5 rounded border border-white/10">
                      {profile.age}
                  </span>
                  {hasContactInfo && (
                      <span className="bg-indigo-600/60 backdrop-blur-sm text-indigo-200 text-[10px] px-2 py-0.5 rounded border border-indigo-400/30 flex items-center gap-1">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          已获取联系方式
                      </span>
                  )}
              </div>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 space-y-3 backdrop-blur-sm">
          {/* Job */}
          <div>
              <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-0.5">职业</h3>
              <p className="text-slate-100 text-sm">{profile.job}</p>
          </div>
          
          {/* Personality */}
          <div>
              <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-0.5">性格</h3>
              <CollapsibleText 
                text={profile.personality} 
                maxLines={2} 
                className="text-slate-100 text-sm leading-relaxed"
              />
          </div>

          {/* Appearance */}
          <div>
              <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-0.5">外貌特征</h3>
              <CollapsibleText 
                text={profile.appearance} 
                maxLines={3} 
                className="text-slate-100 text-sm leading-relaxed"
              />
          </div>

          {/* Backstory */}
          <div>
              <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-0.5">背景故事</h3>
              <div className="border-l-2 border-purple-500 pl-3">
                <CollapsibleText 
                  text={`"${profile.backstory}"`} 
                  maxLines={3} 
                  className="text-slate-300 text-sm italic leading-relaxed"
                />
              </div>
          </div>
        </div>

        {/* Memory Fragments Card */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
          <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2">
              记忆碎片 ({unlockedSecrets.length}/10)
          </h3>
          <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 10 }).map((_, i) => {
                  const isUnlocked = i < unlockedSecrets.length;
                  return (
                      <div 
                          key={i}
                          className={`aspect-square rounded flex items-center justify-center text-[10px] font-bold border transition-all cursor-help ${
                              isUnlocked 
                              ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/30' 
                              : 'bg-slate-700/50 border-slate-600/50 text-slate-500'
                          }`}
                          title={isUnlocked ? unlockedSecrets[i] : (affection < 100 ? "需好感度 > 100 且触发剧情解锁" : "需在剧情中找到线索解锁")}
                      >
                          {isUnlocked ? (i + 1) : <span className="opacity-30">🔒</span>}
                      </div>
                  );
              })}
          </div>
          {unlockedSecrets.length > 0 && (
              <div className="mt-2 text-[10px] text-purple-200 bg-purple-900/30 p-2 rounded border border-purple-500/20 italic">
                  最新解锁: "{unlockedSecrets[unlockedSecrets.length - 1]}"
              </div>
          )}
        </div>

        {/* Deep Secret Card */}
        <div className={`rounded-2xl p-4 border backdrop-blur-sm ${
          affection > 500 
            ? 'bg-pink-900/20 border-pink-500/30' 
            : 'bg-slate-800/30 border-white/5'
        }`}>
          {affection > 500 ? (
              <>
                  <h3 className="text-pink-400 text-[10px] uppercase tracking-widest font-bold mb-1">深藏的秘密 (已解锁)</h3>
                  <CollapsibleText 
                    text={profile.secret} 
                    maxLines={3} 
                    className="text-pink-100 text-sm"
                  />
              </>
          ) : (
              <>
                  <h3 className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">深藏的秘密</h3>
                  <p className="text-slate-500 text-sm blur-[2px] select-none">
                      此秘密需好感度 &gt; 500 且在重大剧情中由她亲口诉说。
                  </p>
              </>
          )}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {showImageViewer && (
        <ImageViewer 
          imageUrl={image} 
          alt={profile.name} 
          onClose={() => setShowImageViewer(false)} 
        />
      )}
    </div>
  );
};
