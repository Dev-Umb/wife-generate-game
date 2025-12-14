import React from 'react';

type Tab = 'chat' | 'profile' | 'inventory' | 'memories';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasUnread?: boolean;
}

export const MobileNav: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
        id: 'chat',
        label: '聊天',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
    },
    {
        id: 'profile',
        label: '老婆',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    },
    {
        id: 'inventory',
        label: '背包',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
    },
    {
        id: 'memories',
        label: '回忆',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900 border-t border-white/10 flex justify-around items-center h-16 z-50 px-2 pb-safe">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            activeTab === tab.id ? 'text-pink-500' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {tab.icon}
          <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};