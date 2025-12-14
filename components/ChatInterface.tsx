import React, { useEffect, useRef } from 'react';
import { ChatMessage, WaifuProfile } from '../types';

interface Props {
  messages: ChatMessage[];
  suggestions: string[];
  onSendMessage: (text: string) => void;
  isThinking: boolean;
  profile: WaifuProfile;
  initialSceneImage?: string | null; 
  isSeparated?: boolean;
  onExit?: (e: React.MouseEvent) => void;
}

export const ChatInterface: React.FC<Props> = ({ 
    messages, 
    suggestions, 
    onSendMessage, 
    isThinking, 
    profile, 
    isSeparated = false,
    onExit
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = React.useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [showActions, setShowActions] = React.useState(false);

  const handleAction = (type: 'move' | 'leave' | 'fast_forward') => {
      setShowActions(false);
      if (type === 'move') {
          onSendMessage("我想去别的地方逛逛。（切换场景）");
      } else if (type === 'leave') {
          onSendMessage("我还有点事，先走了。晚点联系。（暂时分开）");
      } else if (type === 'fast_forward') {
           onSendMessage("【系统指令：快进到下次见面】");
      }
  };

  return (
    <div className={`flex flex-col h-full backdrop-blur-md rounded-t-2xl border-x border-t border-white/10 relative transition-colors duration-500 overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${isSeparated ? 'bg-black/95' : 'bg-slate-950/95'}`}>
      
      {/* Header */}
      <div className={`p-4 border-b border-white/10 backdrop-blur-md absolute top-0 w-full z-30 flex items-center justify-between rounded-t-2xl transition-colors ${isSeparated ? 'bg-indigo-900/40' : 'bg-black/30'}`}>
        <div className="flex items-center gap-3">
           <div className={`w-2 h-2 rounded-full animate-pulse ${isSeparated ? 'bg-gray-500' : 'bg-green-500'}`}></div>
           <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  {profile.name}
                  {isSeparated && <span className="text-xs px-2 py-0.5 rounded bg-indigo-600 text-white">手机通讯中</span>}
              </h3>
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                  {isSeparated ? '远程连接' : profile.job}
              </span>
           </div>
        </div>
        
        {/* Exit Button */}
        {onExit && (
            <button 
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onExit(e);
                }}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="退出并保存"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 pt-24 space-y-4 scrollbar-hide pb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-slide-in-up`}
          >
            {/* Image Attachment */}
            {msg.imageUrl && (
                <div className="mb-2 max-w-[85%] rounded-2xl overflow-hidden border-2 border-pink-500/50 shadow-lg">
                    <img src={msg.imageUrl} alt="Scene" className="w-full h-auto object-cover" />
                </div>
            )}
            
            {/* Text Bubble */}
            {msg.text && (
                <div
                className={`max-w-[85%] p-4 rounded-2xl shadow-md text-sm leading-relaxed ${
                    msg.sender === 'user'
                    ? 'bg-purple-600 text-white rounded-tr-none'
                    : msg.sender === 'system' 
                        ? msg.text.startsWith('【触发事件】') 
                            ? 'bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-pink-300 font-bold border border-pink-500/50 animate-pulse w-full text-center' 
                            : msg.text.startsWith('【获得道具】')
                                ? 'bg-slate-800 text-yellow-300 border border-yellow-500/50 w-full text-center py-4 font-bold shadow-lg'
                            : msg.text.startsWith('【序章')
                                ? 'bg-slate-800/80 text-slate-200 border-l-4 border-pink-500 w-full font-serif italic py-6 px-6 shadow-xl' // Prologue Style
                                : 'bg-transparent text-slate-400 italic text-center w-full border border-slate-700/50'
                        : isSeparated 
                            ? 'bg-indigo-700/80 text-white rounded-tl-none border border-indigo-500/30' // Phone bubble style
                            : 'bg-slate-700 text-slate-200 rounded-tl-none'
                }`}
                >
                {msg.text.startsWith('【序章') ? (
                    <div className="whitespace-pre-wrap">
                        {msg.text}
                    </div>
                ) : msg.text}
                </div>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start animate-slide-in-up">
             <div className="bg-slate-700 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
             </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* GALGAME Suggestions */}
      {!isThinking && suggestions.length > 0 && (
         <div className="p-2 px-4 flex flex-wrap gap-2 justify-center bg-gradient-to-t from-slate-900/90 to-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
             {suggestions.map((s, i) => (
                 <button 
                    key={i}
                    onClick={() => onSendMessage(s)}
                    className="text-xs md:text-sm bg-white/10 hover:bg-pink-500/20 hover:border-pink-500 border border-white/20 text-slate-200 px-3 py-2 rounded-full transition-all truncate max-w-full"
                 >
                    {s}
                 </button>
             ))}
         </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-black/60 border-t border-white/10 relative backdrop-blur-md pb-20 md:pb-4 mb-0">
        {/* Action Menu Popup */}
        {showActions && (
            <div className="absolute bottom-full left-4 mb-2 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col w-48 animate-in fade-in slide-in-from-bottom-2 z-20">
                <button 
                    onClick={() => handleAction('move')}
                    className="px-4 py-3 text-left text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2 text-sm"
                >
                    🗺️ 切换场景 (Move)
                </button>
                <button 
                    onClick={() => handleAction('leave')}
                    className="px-4 py-3 text-left text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2 text-sm"
                >
                    👋 暂时分开 (Leave)
                </button>
                <button 
                    onClick={() => handleAction('fast_forward')}
                    className="px-4 py-3 text-left text-pink-400 hover:bg-pink-900/30 hover:text-pink-300 transition-colors flex items-center gap-2 text-sm border-t border-white/5"
                >
                    ⏩ 快进到下次见面
                </button>
            </div>
        )}

        <div className="flex gap-2 items-center">
          <button 
             onClick={() => setShowActions(!showActions)}
             className={`p-3 rounded-xl border border-white/10 shrink-0 transition-colors ${showActions ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
             title="行动菜单"
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isSeparated ? `发送信息给 ${profile.name}...` : `对 ${profile.name} 说点什么...`}
            className="flex-1 bg-slate-800 text-white placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500 transition-colors w-full min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-all font-semibold shrink-0"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
};