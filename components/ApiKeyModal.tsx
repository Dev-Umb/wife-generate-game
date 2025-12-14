import React, { useState } from 'react';
import { requestApiKey, setStoredApiKey } from '../services/geminiService';

interface Props {
  onSuccess: () => void;
}

export const ApiKeyModal: React.FC<Props> = ({ onSuccess }) => {
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const success = await requestApiKey();
      if (success) {
        onSuccess();
      } else {
        // Automatically switch to manual input if auto-connect fails (e.g. not in AI Studio)
        setIsManualInput(true);
      }
    } catch (e) {
      console.error(e);
      setIsManualInput(true);
    } finally {
        setIsLoading(false);
    }
  };

  const handleManualSubmit = () => {
      if(manualKey.trim().length > 10) {
          setStoredApiKey(manualKey.trim());
          onSuccess();
      } else {
          alert("请输入有效的 Gemini API Key");
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
        
        {/* Decorative background element */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-600/20 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-600/20 rounded-full blur-2xl"></div>

        <div className="mb-6 flex justify-center relative z-10">
           <svg className="w-16 h-16 text-pink-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        </div>
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-500 mb-4 relative z-10">
          老婆生成器 AI
        </h2>
        <p className="text-slate-300 mb-8 leading-relaxed relative z-10">
          要生成高质量的 4K 角色并启用高级情感引擎，请连接您的 Gemini API Key。
        </p>
        
        {!isManualInput ? (
            <div className="space-y-4 relative z-10">
                <button
                    onClick={handleConnect}
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            连接 AI Studio...
                        </>
                    ) : "快速连接 API Key"}
                </button>
                <button 
                    onClick={() => setIsManualInput(true)}
                    className="text-slate-500 hover:text-slate-300 text-sm underline decoration-slate-600 hover:decoration-slate-300 transition-colors"
                >
                    手动输入 Key (用于部署环境)
                </button>
            </div>
        ) : (
            <div className="space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-2">
                <div className="text-left">
                    <label className="text-xs text-slate-400 font-bold ml-1 uppercase">Gemini API Key</label>
                    <input 
                        type="password" 
                        value={manualKey}
                        onChange={(e) => setManualKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-4 py-3 mt-1 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                    />
                </div>
                <button
                    onClick={handleManualSubmit}
                    disabled={manualKey.length < 10}
                    className="w-full py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg border border-white/5"
                >
                    确认进入
                </button>
                <button 
                    onClick={() => setIsManualInput(false)}
                    className="text-slate-500 hover:text-slate-300 text-sm"
                >
                    返回自动连接
                </button>
            </div>
        )}

        <p className="mt-6 text-xs text-slate-500 relative z-10">
          使用 Google Gemini 2.5 Flash & 3 Pro 模型。
          <br/>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">获取 API Key</a>
        </p>
      </div>
    </div>
  );
};