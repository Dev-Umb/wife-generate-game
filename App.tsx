import React, { useState, useEffect, useRef } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { CharacterCard } from './components/CharacterCard';
import { ChatInterface } from './components/ChatInterface';
import { Inventory } from './components/Inventory';
import { MemoryGallery } from './components/MemoryGallery';
import { MobileNav } from './components/MobileNav';
import { ConfirmModal } from './components/ConfirmModal';
import { TextEditorModal } from './components/TextEditorModal';
import { 
    checkApiKey, 
    generateWaifuProfile, 
    generateWaifuImage, 
    generateSceneImage, 
    generateItemImage,
    createChatSession, 
    generateReplySuggestions,
    summarizeHistory 
} from './services/geminiService';
import { saveSession, getAllSessions, deleteSession, migrateFromLocalStorage } from './services/storageService';
import { WaifuProfile, ChatMessage, GameState, InventoryItem, StoryMemory, EndingData, VisualState, ImageServiceConfig } from './types';
import { Chat, Part } from "@google/genai";

type Tab = 'chat' | 'profile' | 'inventory' | 'memories';
type GenerationPhase = 'config' | 'preview' | 'generating_images' | 'chat';
type GenerationMode = 'preset' | 'custom' | 'history';

const WORLD_OPTIONS = [
    { id: 'Random', label: '🎲 AI 随机设计 (自主创作)', desc: '由 AI 构想独一无二的世界' },
    { id: '现代都市', label: '🏙️ 现代都市', desc: '学校、职场、温馨日常' },
    { id: '奇幻异界', label: '🏰 奇幻异界', desc: '剑与魔法、魔王勇者' },
    { id: '东方古风', label: '🏮 东方古风', desc: '武侠、仙侠、宫廷' },
    { id: '未来科幻', label: '🚀 未来科幻', desc: '赛博朋克、机甲、人工智能' },
];

const RACES_MAP: Record<string, string[]> = {
    '现代都市': [
        '人类', '隐世吸血鬼', '兽耳娘', '幽灵', '恶魔混血', '克苏鲁系', 
        '魔法少女', '都市精灵', '落难神明', '人造天使'
    ],
    '奇幻异界': [
        '人类', '高等精灵', '光之精灵', '暗夜精灵', '女神', '大天使', '堕天使', '恶魔', '魅魔', '兽人', 
        '龙族', '史莱姆', '花仙(Fairy)', '人鱼', '亡灵', '拉米亚(蛇娘)', '哈比(鸟人)'
    ],
    '东方古风': [
        '人类', '九尾狐仙', '龙女', '花妖', '画中仙', '僵尸', '鬼魂', '修罗', '玉兔', '麒麟化身'
    ],
    '未来科幻': [
        '人类', '仿生人', '强殖装甲人', '赛博格', '智械', '变异体', '全息AI'
    ],
    'Random': [
        '人类', '精灵', '女神', '兽耳娘', '恶魔', '魔法少女', '吸血鬼', '仿生人', '天使', '人鱼', '克苏鲁系'
    ]
};

const JOBS_MAP: Record<string, string[]> = {
    '现代都市': [
        '学生', '青梅竹马', '咖啡店员', '甜点店长', '偶像', '幼儿园老师', '老师', '花店店长', '护士', '图书管理员', '钢琴家', '画家',
        '黑客', '总裁', '杀手', '侦探', '家里蹲', '黑道千金', '便利店员', '法医', '漫画家', '不良少女',
        '游戏开发者', '程序员', '警察', '游戏策划', '乐队主唱', '乐队贝斯手'
    ],
    '奇幻异界': [
        '公主', '圣女', '白魔法师', '公会接待员', '花语者', '神官', '弓箭手', '驯兽师',
        '骑士', '法师', '魔王', '冒险者', '炼金术士', '盗贼', '死灵法师', '邪教徒', '赏金猎人', '奴隶商人'
    ],
    '东方古风': [
        '大家闺秀', '琴师', '舞姬', '神医', '客栈老板娘', '侠客', '刺客', '公主', '巫女', '道士', '魔教教主', '女将军'
    ],
    '未来科幻': [
        '赛博浪客', '义体医生', '网络黑客', '歌姬', '外交官', '医生', '植物学家', '机甲驾驶员', '赏金猎人', '科学家', '反抗军领袖'
    ],
    'Random': [
        '学生', '咖啡店员', '花店店长', '骑士', '公主', '黑客', '魔王', '偶像', '巫女', '死灵法师', '杀手'
    ]
};

const PERSONALITY_MAP: string[] = [
    '大和抚子 (Yamato Nadeshiko)', '治愈系 (Healing)', '温柔 (Gentle)', '天然呆 (Clumsy)', 
    '元气 (Genki)', '纯真 (Pure)', '理智 (Intellectual)', '圣母 (Saint-like)', '邻家姐姐 (Sisterly)',
    '小恶魔 (Playful)', '傲娇 (Tsundere)', '病娇 (Yandere)', '三无 (Kuudere)', '害羞 (Dandere)', 
    '抖S (Sadist)', '抖M (Masochist)', '腹黑 (Manipulative)', '高傲 (Haughty)',
    '阴郁 (Gloomy)', '懒惰 (Lazy)', '中二病 (Chuunibyou)'
];

const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// LocalStorage Keys (Legacy) & Config Keys
const SAVE_KEY_ACTIVE_SESSION_ID = 'WAIFU_GAME_ACTIVE_SESSION_ID';
const SAVE_KEY_PHASE = 'WAIFU_GAME_ACTIVE_PHASE';
const SAVE_KEY_IS_R18 = 'WAIFU_GAME_SAVE_IS_R18';
const SAVE_KEY_CUSTOM_DRAFT = 'WAIFU_GAME_CUSTOM_DRAFT';
const SAVE_KEY_HISTORY_LEGACY = 'WAIFU_GAME_HISTORY_LIST';
const SAVE_KEY_IMAGE_SERVICE = 'WAIFU_GAME_IMAGE_SERVICE';

// Default Gradio endpoint from environment variable
const DEFAULT_GRADIO_ENDPOINT = import.meta.env.VITE_GRADIO_ENDPOINT || "";

export const App: React.FC = () => {
  const [hasKey, setHasKey] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>('config');
  const [genMode, setGenMode] = useState<GenerationMode>('preset');
  
  // Configuration State
  const [config, setConfig] = useState({
      world: 'Random',
      race: 'Random',
      job: 'Random',
      personality: 'Random',
      artStyle: 'Anime'
  });
  const [userNameInput, setUserNameInput] = useState(''); // Name input in preview phase
  
  // Custom Mode State
  const [customData, setCustomData] = useState({
      name: '',
      persona: '', // Bio/Personality
      world: '',   // World Setting
      plot: '',    // Story Outline
      appearance: '', // Portrait Description
      referenceImage: '', // Base64 of uploaded image
      playerPersona: '', // User's persona
      artStyle: 'Anime'
  });

  const [shouldPolish, setShouldPolish] = useState(true);
  const [isR18, setIsR18] = useState(false);

  // Image Service Configuration
  const [imageService, setImageService] = useState<ImageServiceConfig>({
      type: 'gradio',
      gradioEndpoint: DEFAULT_GRADIO_ENDPOINT
  });
  const [showImageServiceSettings, setShowImageServiceSettings] = useState(false); 

  const [previewProfile, setPreviewProfile] = useState<WaifuProfile | null>(null);
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>({
    sessionId: '',
    lastUpdated: 0,
    hasApiKey: false,
    userName: '',
    waifu: null,
    waifuImage: null,
    initialSceneImage: null,
    currentSceneVisual: '',
    visualState: { 
        waifuPose: 'Standing', 
        waifuClothing: 'Default outfit', 
        userAction: 'Standing nearby', 
        envAtmosphere: 'Initial meeting' 
    },
    affectionScore: 40,
    chatHistory: [],
    suggestedReplies: [],
    inventory: [],
    memories: [],
    unlockedSecrets: [],
    isSeparated: false,
    hasContactInfo: false,
    artStyle: 'Anime',
    playerPersona: '',
    isCustomCharacter: false
  });
  
  // Saved Sessions List
  const [savedSessions, setSavedSessions] = useState<GameState[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [showInventoryDesktop, setShowInventoryDesktop] = useState(false);
  const [showMemoriesDesktop, setShowMemoriesDesktop] = useState(false);

  const [endingData, setEndingData] = useState<EndingData | null>(null);

  const [imageSize] = useState<"1K" | "2K" | "4K">("1K"); // Fixed to 1K for Gradio compatibility
  const [isThinking, setIsThinking] = useState(false);
  
  const chatSessionRef = useRef<Chat | null>(null);
  const lastSummaryIndexRef = useRef<number>(0);

  // Modal State
  const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  // Text Editor Modal State
  const [editorModal, setEditorModal] = useState<{
      isOpen: boolean;
      title: string;
      field: keyof typeof customData;
      value: string;
      placeholder: string;
  }>({ isOpen: false, title: '', field: 'persona', value: '', placeholder: '' });

  const openEditor = (field: keyof typeof customData, title: string, placeholder: string) => {
      setEditorModal({
          isOpen: true,
          title,
          field,
          value: customData[field],
          placeholder
      });
  };

  const handleEditorSave = (value: string) => {
      setCustomData(prev => ({ ...prev, [editorModal.field]: value }));
  };

  useEffect(() => {
    checkApiKey().then(setHasKey);
  }, []);

  // --- SAVE / LOAD LOGIC ---
  
  const loadSessionsFromDB = async () => {
      try {
          const sessions = await getAllSessions();
          setSavedSessions(sessions);
          return sessions;
      } catch (e) {
          console.error("Failed to load sessions from DB", e);
          return [];
      }
  };

  // Mount logic: Migrate legacy, Load DB, Restore Active Session
  useEffect(() => {
    const initStorage = async () => {
        // 1. Attempt migration of legacy LocalStorage data
        await migrateFromLocalStorage(SAVE_KEY_HISTORY_LEGACY);

        // 2. Load from IndexedDB
        const sessions = await loadSessionsFromDB();

        // 3. Load other localstorage configs
        const draftJson = localStorage.getItem(SAVE_KEY_CUSTOM_DRAFT);
        if (draftJson && draftJson !== "undefined") setCustomData(JSON.parse(draftJson));

        const savedR18 = localStorage.getItem(SAVE_KEY_IS_R18);
        if (savedR18 && savedR18 !== "undefined") setIsR18(JSON.parse(savedR18));

        const savedImageService = localStorage.getItem(SAVE_KEY_IMAGE_SERVICE);
        if (savedImageService && savedImageService !== "undefined") {
            setImageService(JSON.parse(savedImageService));
        }

        // 4. Restore active session if ID matches
        const activeSessionId = localStorage.getItem(SAVE_KEY_ACTIVE_SESSION_ID);
        const savedPhase = localStorage.getItem(SAVE_KEY_PHASE);
        
        if (activeSessionId && savedPhase) {
            const session = sessions.find((s: any) => s.sessionId === activeSessionId);
            if (session) {
                setGameState(session);
                setPhase(savedPhase as GenerationPhase);
                if ((savedPhase === 'chat' || savedPhase === 'generating_images') && session.waifu?.name) {
                     reinitChatSession(session, JSON.parse(savedR18 || 'false'));
                }
            }
        }
    };
    initStorage();
  }, []);

  // Cache Custom Data Draft
  useEffect(() => {
      localStorage.setItem(SAVE_KEY_CUSTOM_DRAFT, JSON.stringify(customData));
  }, [customData]);

  // Cache Image Service Config
  useEffect(() => {
      localStorage.setItem(SAVE_KEY_IMAGE_SERVICE, JSON.stringify(imageService));
  }, [imageService]);

  // Auto-Save Active Session to IndexedDB
  useEffect(() => {
    if (gameState.waifu && phase === 'chat') {
        const autoSave = async () => {
            try {
                // Update local list state
                const updatedState = { ...gameState, lastUpdated: Date.now() };
                
                // Save to DB
                await saveSession(updatedState);
                
                // Update pointers
                localStorage.setItem(SAVE_KEY_ACTIVE_SESSION_ID, gameState.sessionId);
                localStorage.setItem(SAVE_KEY_PHASE, phase);
                localStorage.setItem(SAVE_KEY_IS_R18, JSON.stringify(isR18));

                // Refresh list view silently
                setSavedSessions(prev => {
                    const exists = prev.some(s => s.sessionId === updatedState.sessionId);
                    if (exists) return prev.map(s => s.sessionId === updatedState.sessionId ? updatedState : s);
                    return [updatedState, ...prev];
                });
            } catch (e) {
                console.warn("Auto-save failed:", e);
            }
        };
        const timer = setTimeout(autoSave, 1000); // Debounce auto-save
        return () => clearTimeout(timer);
    }
  }, [gameState, phase, isR18]);

  const reinitChatSession = (state: GameState, r18: boolean) => {
        const allMemoriesText = state.memories.map(m => `[${m.title}]: ${m.description}`).join('\n');
        chatSessionRef.current = createChatSession(
            state.waifu!,
            state.affectionScore,
            r18,
            state.userName,
            allMemoriesText,
            state.chatHistory,
            state.playerPersona
        );
        setIsThinking(false);
        lastSummaryIndexRef.current = state.chatHistory.length;
  };

  const handleExitGame = (e?: React.MouseEvent) => {
      if (e) {
          e.stopPropagation();
      }
      
      setConfirmModal({
          isOpen: true,
          message: "确定要退出当前剧情吗？进度已自动保存，你可以随时在历史记录中继续。",
          onConfirm: () => {
              // Force save one last time
              saveSession({ ...gameState, lastUpdated: Date.now() }).then(loadSessionsFromDB);
              
              localStorage.removeItem(SAVE_KEY_ACTIVE_SESSION_ID);
              localStorage.removeItem(SAVE_KEY_PHASE);
              
              // Reset to config state
              setPhase('config');
              setGameState({
                  sessionId: '',
                  lastUpdated: 0,
                  hasApiKey: true,
                  userName: '',
                  waifu: null,
                  waifuImage: null,
                  initialSceneImage: null,
                  currentSceneVisual: '',
                  visualState: { waifuPose: '', waifuClothing: '', userAction: '', envAtmosphere: '' },
                  affectionScore: 40,
                  chatHistory: [],
                  suggestedReplies: [],
                  inventory: [],
                  memories: [],
                  unlockedSecrets: [],
                  isSeparated: false,
                  hasContactInfo: false,
                  artStyle: 'Anime',
                  playerPersona: '',
                  isCustomCharacter: false
              });
              setPreviewProfile(null);
              setEndingData(null);
              closeConfirm();
          }
      });
  };

  const handleLoadSession = (session: GameState) => {
      setConfirmModal({
          isOpen: true,
          message: `确定要读取存档：${session.waifu?.name} (${new Date(session.lastUpdated).toLocaleDateString()}) 吗？`,
          onConfirm: () => {
              setGameState(session);
              setPhase('chat');
              localStorage.setItem(SAVE_KEY_ACTIVE_SESSION_ID, session.sessionId);
              localStorage.setItem(SAVE_KEY_PHASE, 'chat');
              reinitChatSession(session, isR18); 
              closeConfirm();
          }
      });
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      setConfirmModal({
          isOpen: true,
          message: "确定要删除这个存档吗？无法找回。",
          onConfirm: () => {
              deleteSession(sessionId).then(() => {
                  setSavedSessions(prev => prev.filter(s => s.sessionId !== sessionId));
                  if (gameState.sessionId === sessionId) {
                      localStorage.removeItem(SAVE_KEY_ACTIVE_SESSION_ID);
                  }
              });
              closeConfirm();
          }
      });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setCustomData(prev => ({ ...prev, referenceImage: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleClearReferenceImage = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setCustomData(prev => ({ ...prev, referenceImage: '' }));
  };

  // Step 1: Generate Text Profile
  const handleGenerateProfile = async () => {
      setIsGeneratingProfile(true);
      try {
          let finalConfig: any = { ...config };

          if (genMode === 'custom') {
              finalConfig = {
                  customName: customData.name,
                  customPersona: customData.persona,
                  customWorld: customData.world,
                  customPlot: customData.plot,
                  customAppearance: customData.appearance,
                  customImage: customData.referenceImage,
                  playerPersona: customData.playerPersona,
                  polish: shouldPolish,
                  isR18: isR18,
                  userName: "你",
                  artStyle: customData.artStyle
              };
          } else {
              if (finalConfig.world === 'Random') finalConfig.world = getRandomItem(Object.keys(RACES_MAP).filter(k => k !== 'Random'));
              if (finalConfig.race === 'Random') finalConfig.race = getRandomItem(RACES_MAP[finalConfig.world] || RACES_MAP['Random']);
              if (finalConfig.job === 'Random') finalConfig.job = getRandomItem(JOBS_MAP[finalConfig.world] || JOBS_MAP['Random']);
              if (finalConfig.personality === 'Random') finalConfig.personality = getRandomItem(PERSONALITY_MAP);
              
              finalConfig.isR18 = isR18;
              finalConfig.userName = "你";
          }

          const profile = await generateWaifuProfile(finalConfig);
          setPreviewProfile(profile);
          setPhase('preview');
      } catch (e) {
          console.error(e);
          alert("生成设定失败，请重试。");
      } finally {
          setIsGeneratingProfile(false);
      }
  };

  // Step 2: Confirm and Generate Images
  const handleStartGame = async () => {
    if (!previewProfile) return;
    if (!userNameInput.trim()) {
        alert("请输入你的名字");
        return;
    }
    
    setPhase('generating_images');
    const isCustom = genMode === 'custom';

    try {
        const startSceneVisual = `${previewProfile.initialScenario}, high quality detailed background art`;

        // 1. Generate Character Image First (Sequential to reuse it for scene)
        const characterImage = await generateWaifuImage(
            `${previewProfile.appearance}, ${previewProfile.race}, ${previewProfile.job}`, 
            imageSize, 
            isR18,
            isCustom && customData.referenceImage ? customData.referenceImage : undefined,
            isCustom ? customData.artStyle : config.artStyle,
            isCustom,
            imageService // Pass image service config
        );

        // 2. Generate Scene Image (Using character image as reference for consistency)
        const sceneImage = await generateSceneImage(
            previewProfile.appearance, 
            {
                waifuPose: 'Standing naturally',
                waifuClothing: 'Default outfit',
                userAction: 'Approaching',
                envAtmosphere: 'Initial meeting'
            }, 
            startSceneVisual, 
            imageSize, 
            isR18, 
            isCustom ? customData.artStyle : config.artStyle,
            isCustom,
            characterImage, // Pass the generated character image as reference
            imageService // Pass image service config
        );
        
        const startAffection = previewProfile.initialAffection ?? 40;

        // Initialize chat
        const chat = createChatSession(
            previewProfile, 
            startAffection, 
            isR18, 
            userNameInput, 
            "", 
            [],
            isCustom ? customData.playerPersona : ''
        );
        chatSessionRef.current = chat;
        lastSummaryIndexRef.current = 0;

        const prologueMsg: ChatMessage = {
            id: 'prologue',
            sender: 'system',
            text: `【序章：${previewProfile.initialMemoryTitle || "初遇"}】\n${previewProfile.initialScenario}`,
            timestamp: Date.now() - 1000,
            imageUrl: sceneImage 
        };

        const initialMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'waifu',
            text: previewProfile.openingMessage,
            timestamp: Date.now()
        };

        const initialSuggestions = await generateReplySuggestions(
            [`system: ${previewProfile.initialScenario}`, `waifu: ${previewProfile.openingMessage}`], 
            previewProfile,
            startAffection, 
            gameState.isSeparated,
            userNameInput,
            isCustom ? customData.plot : undefined
        );

        const firstMemory: StoryMemory = {
            id: 'init-memory',
            title: previewProfile.initialMemoryTitle || "初遇",
            description: previewProfile.initialScenario,
            imageUrl: sceneImage,
            timestamp: Date.now()
        };

        const newGameState: GameState = {
            sessionId: Date.now().toString(), // Unique Session ID
            lastUpdated: Date.now(),
            hasApiKey: true,
            userName: userNameInput,
            waifu: previewProfile,
            waifuImage: characterImage,
            initialSceneImage: sceneImage,
            currentSceneVisual: startSceneVisual,
            visualState: { 
                waifuPose: 'Standing', 
                waifuClothing: 'Default outfit', 
                userAction: 'Standing nearby', 
                envAtmosphere: 'Initial meeting' 
            },
            affectionScore: startAffection,
            chatHistory: [prologueMsg, initialMsg],
            suggestedReplies: initialSuggestions,
            inventory: [],
            memories: [firstMemory], 
            unlockedSecrets: [],
            isSeparated: false,
            hasContactInfo: false,
            artStyle: isCustom ? customData.artStyle : config.artStyle,
            playerPersona: isCustom ? customData.playerPersona : '',
            isCustomCharacter: isCustom
        };

        setGameState(newGameState);
        lastSummaryIndexRef.current = 2;

        // Save immediately
        await saveSession(newGameState);
        setSavedSessions(prev => [newGameState, ...prev]);

        setPhase('chat');
    } catch (error) {
        console.error(error);
        alert("生成图像失败，请重试。");
        setPhase('preview'); 
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!chatSessionRef.current || !gameState.waifu) return;

    const timestamp = Date.now();
    // Unique IDs for user and bot to prevent collision during fast execution
    const userMsg: ChatMessage = {
        id: `msg-user-${timestamp}`,
        sender: 'user',
        text,
        timestamp: timestamp
    };

    const botMsgId = `msg-waifu-${timestamp}`;
    const botMsg: ChatMessage = {
        id: botMsgId,
        sender: 'waifu',
        text: '...', // Visual placeholder for streaming
        timestamp: timestamp + 1
    };
    
    setGameState(prev => ({
        ...prev,
        chatHistory: [...prev.chatHistory, userMsg, botMsg],
        suggestedReplies: []
    }));
    
    setIsThinking(true);

    try {
        let currentAffection = gameState.affectionScore;
        let sceneImage: string | undefined = undefined;
        let newItem: InventoryItem | undefined = undefined;
        const turnMemories: StoryMemory[] = [];
        let sceneUpdate: { name: string, desc: string } | undefined = undefined;
        let separationUpdate: { separated: boolean, summary?: string } | undefined = undefined;
        let contactUpdate: boolean = false;
        let eventUpdate: { name: string, desc: string } | undefined = undefined;
        let endingTriggered: EndingData | undefined = undefined;
        let secretUnlocked: string | undefined = undefined;
        
        // Track visual updates locally before committing to state
        let tempVisualState = { ...gameState.visualState };
        let shouldResetContext = false;
        const injectedMessages: ChatMessage[] = []; // Stores system messages (like item received)
        let botMsgText = "";

        // Send message with STREAMING enabled
        let loopCount = 0;
        const MAX_LOOPS = 5;
        
        // FIX: Use named parameter object for sendMessageStream
        let activeStream = await chatSessionRef.current.sendMessageStream({ message: text });

        while (loopCount < MAX_LOOPS) {
            loopCount++;
            
            // 1. Process Stream Chunks and collect function calls
            let functionCalls: any[] = [];
            
            for await (const chunk of activeStream) {
                // Extract text from chunk
                let chunkText = "";
                try {
                    chunkText = chunk.text || "";
                } catch (e) {
                    // Ignore non-text chunks
                }

                if (chunkText) {
                    botMsgText += chunkText;
                    setGameState(prev => ({
                        ...prev,
                        chatHistory: prev.chatHistory.map(msg => 
                            msg.id === botMsgId ? { ...msg, text: botMsgText } : msg
                        )
                    }));
                }
                
                // Check for function calls in this chunk - use ONLY chunk.functionCalls (primary source)
                // This avoids duplicate collection from both functionCalls property and parts array
                if (chunk.functionCalls && Array.isArray(chunk.functionCalls) && chunk.functionCalls.length > 0) {
                    console.log("[DEBUG] Found functionCalls on chunk:", chunk.functionCalls.map((fc: any) => fc.name));
                    functionCalls.push(...chunk.functionCalls);
                }
            }
            
            console.log("[DEBUG] Total functionCalls collected:", functionCalls.length, functionCalls.map((c: any) => c.name));
            
            // Safe check
            if (functionCalls.length === 0) {
                break;
            }
            
            console.log("✅ Function calls detected:", functionCalls.map((c: any) => c.name));

            // 3. Execute Tools
            const functionResponses: Part[] = [];
            for (const call of functionCalls) {
                const callName = call.name;
                const callArgs = call.args;
                let functionResult: any = { result: "ok" };
                const baseInstruction = "Action completed. Now YOU MUST generate a natural verbal response to the user's last message or this action.";

                if (callName === 'updateAffection') {
                    const change = Number(callArgs['change']) || 0;
                    currentAffection = Math.min(1000, Math.max(0, currentAffection + change));
                    functionResult = { result: `Affection updated. Current: ${currentAffection}`, system_instruction: baseInstruction };
                } 
                else if (callName === 'updateVisualState') {
                    if (callArgs['waifuPose']) tempVisualState.waifuPose = String(callArgs['waifuPose']);
                    if (callArgs['waifuClothing']) tempVisualState.waifuClothing = String(callArgs['waifuClothing']);
                    if (callArgs['userAction']) tempVisualState.userAction = String(callArgs['userAction']);
                    if (callArgs['envAtmosphere']) tempVisualState.envAtmosphere = String(callArgs['envAtmosphere']);
                    functionResult = { result: "Visual state tracked.", system_instruction: "State updated. Describe the new view." };
                }
                else if (callName === 'generateScene') {
                    const actionDescription = String(callArgs['description']);
                    console.log("[DEBUG] 🎨 generateScene called with:", { actionDescription, imageSize, isR18, artStyle: gameState.artStyle });
                    console.log("[DEBUG] 🎨 tempVisualState:", tempVisualState);
                    console.log("[DEBUG] 🎨 imageService:", imageService);
                    try {
                         // Non-blocking image generation in background for UI speed, but await here for logic simplicity
                         // We can optimize to not await if we want purely async images, but we want it in this turn.
                         console.log("[DEBUG] 🎨 Calling generateSceneImage...");
                         sceneImage = await generateSceneImage(
                             gameState.waifu.appearance, 
                             tempVisualState, 
                             actionDescription, 
                             imageSize, 
                             isR18, 
                             gameState.artStyle, 
                             gameState.isCustomCharacter,
                             gameState.waifuImage || undefined,
                             imageService // Pass image service config
                        );
                         console.log("[DEBUG] 🎨 generateSceneImage returned:", sceneImage ? `Image (${sceneImage.substring(0, 50)}...)` : 'null/undefined');
                         turnMemories.push({
                            id: Date.now().toString() + Math.random(),
                            title: "精彩瞬间", 
                            description: actionDescription,
                            imageUrl: sceneImage,
                            timestamp: Date.now()
                         });
                         functionResult = { result: "Scene image generated.", system_instruction: "Scene updated. Describe the new view." };
                         console.log("[DEBUG] 🎨 Scene image generation SUCCESS");
                    } catch (err) {
                        console.error("[DEBUG] 🎨 generateScene FAILED with error:", err);
                        functionResult = { result: "Failed to generate scene." };
                    }
                }
                else if (callName === 'generateItem') {
                    const name = String(callArgs['name']);
                    const desc = String(callArgs['description']);
                    try {
                        const itemImage = await generateItemImage(String(callArgs['visualPrompt']), imageService);
                        newItem = { id: Date.now().toString(), name, description: desc, imageUrl: itemImage, obtainedAt: Date.now() };
                        injectedMessages.push({
                            id: `item-${Date.now()}`,
                            sender: 'system',
                            text: `【获得道具】${name}\n${desc}`,
                            timestamp: Date.now(),
                            imageUrl: itemImage
                        });
                        functionResult = { result: `Item '${name}' generated.`, system_instruction: `Item ${name} given.` };
                    } catch (err) {
                        functionResult = { result: "Failed to generate item." };
                    }
                }
                else if (callName === 'saveMemory') {
                    try {
                        const memoryImage = await generateSceneImage(gameState.waifu.appearance, tempVisualState, String(callArgs['visualPrompt']), imageSize, isR18, gameState.artStyle, gameState.isCustomCharacter, gameState.waifuImage || undefined, imageService);
                        turnMemories.push({ id: Date.now().toString(), title: String(callArgs['title']), description: String(callArgs['description']), imageUrl: memoryImage, timestamp: Date.now() });
                        functionResult = { result: "Memory saved.", system_instruction: "Memory recorded." };
                    } catch (err) { functionResult = { result: "Failed memory image." }; }
                }
                else if (callName === 'switchScene') {
                    const locationName = String(callArgs['locationName']);
                    const description = String(callArgs['description']);
                    const visualPrompt = String(callArgs['visualPrompt']);
                    try {
                        tempVisualState = { 
                            waifuPose: 'Standing', 
                            waifuClothing: tempVisualState.waifuClothing, 
                            userAction: 'Standing nearby', 
                            envAtmosphere: visualPrompt 
                        };
                        const newSceneImage = await generateSceneImage(gameState.waifu.appearance, tempVisualState, description, imageSize, isR18, gameState.artStyle, gameState.isCustomCharacter, gameState.waifuImage || undefined, imageService);
                        sceneUpdate = { name: locationName, desc: description };
                        sceneImage = newSceneImage; 
                         turnMemories.push({ id: Date.now().toString() + Math.random(), title: locationName, description: description, imageUrl: newSceneImage, timestamp: Date.now() });
                        setGameState(prev => ({ ...prev, initialSceneImage: newSceneImage, currentSceneVisual: visualPrompt, waifu: prev.waifu ? { ...prev.waifu, initialScenario: description } : null }));
                        shouldResetContext = true;
                        functionResult = { result: `Scene switched to ${locationName}.`, system_instruction: "Scene switched. Narrate arrival." };
                    } catch (err) { functionResult = { result: "Failed scene switch." }; }
                }
                else if (callName === 'updateSeparationStatus') {
                    const isSeparated = Boolean(callArgs['isSeparated']);
                    separationUpdate = { separated: isSeparated, summary: callArgs['narrativeSummary'] ? String(callArgs['narrativeSummary']) : undefined };
                    functionResult = { result: `Separation updated.`, system_instruction: isSeparated ? "Separation confirmed." : "Reunion confirmed." };
                }
                else if (callName === 'grantContactInfo') {
                    contactUpdate = true;
                    functionResult = { result: "Contact info granted.", system_instruction: "Contact info given." };
                }
                else if (callName === 'triggerEvent') {
                    eventUpdate = { name: String(callArgs['eventName']), desc: String(callArgs['description']) };
                    functionResult = { result: "Event triggered.", system_instruction: "Event started." };
                }
                else if (callName === 'triggerEnding') {
                    const type = String(callArgs['type']) as 'HE' | 'BE';
                    try {
                        const endingImage = await generateSceneImage(gameState.waifu.appearance, tempVisualState, String(callArgs['visualPrompt']), imageSize, isR18, gameState.artStyle, gameState.isCustomCharacter, gameState.waifuImage || undefined, imageService);
                        endingTriggered = { type, title: String(callArgs['title']), description: String(callArgs['description']), imageUrl: endingImage };
                        functionResult = { result: "Ending triggered.", system_instruction: "Story ended." };
                    } catch (err) { functionResult = { result: "Failed ending." }; }
                }
                else if (callName === 'unlockSecret') {
                    secretUnlocked = String(callArgs['secretContent']);
                    functionResult = { result: "Secret unlocked.", system_instruction: "Secret revealed." };
                }
                
                functionResponses.push({ 
                    functionResponse: {
                        name: callName, 
                        response: functionResult 
                    }
                });
            }
            
            // 4. Send Tool Responses back to model and continue streaming
            if (functionResponses.length > 0) {
                 // FIX: Use named parameter object for sendMessageStream
                 activeStream = await chatSessionRef.current.sendMessageStream({ message: functionResponses });
            } else {
                break;
            }
        }

        // --- Final State Update after all loops ---
        if (endingTriggered) {
             setEndingData(endingTriggered);
             return; 
        }

        // Attach image to the bot message if generated
        setGameState(prev => {
            const finalHistory = [...prev.chatHistory, ...injectedMessages];
            // Ensure the bot message is the last one or re-find it
            const historyWithoutBot = finalHistory.filter(m => m.id !== botMsgId);
            const updatedBotMsg = { ...botMsg, text: botMsgText, imageUrl: sceneImage };
            
            const nextHistory = [...historyWithoutBot, ...injectedMessages, updatedBotMsg];
            const nextMemories = [...prev.memories, ...turnMemories];
            let nextSeparated = prev.isSeparated;
            if (separationUpdate) nextSeparated = separationUpdate.separated;
            
            return {
                ...prev,
                affectionScore: currentAffection,
                chatHistory: nextHistory,
                inventory: newItem ? [...prev.inventory, newItem] : prev.inventory,
                memories: nextMemories,
                isSeparated: nextSeparated,
                hasContactInfo: contactUpdate || prev.hasContactInfo,
                unlockedSecrets: secretUnlocked ? [...prev.unlockedSecrets, secretUnlocked] : prev.unlockedSecrets,
                visualState: tempVisualState // Commit new state
            };
        });

        if (shouldResetContext && gameState.waifu) {
             const historyToSummarize = [...gameState.chatHistory, userMsg, { ...botMsg, text: botMsgText }];
             summarizeHistory(historyToSummarize, gameState.waifu.name, gameState.userName).then(summary => {
                const segmentImage = historyToSummarize.reverse().find(m => m.imageUrl)?.imageUrl || gameState.initialSceneImage;
                const memoryItem: StoryMemory = { id: Date.now().toString(), title: summary.title, description: summary.content, imageUrl: segmentImage || undefined, timestamp: Date.now() };
                setGameState(prev => ({ ...prev, memories: [...prev.memories, memoryItem] }));
                const allMemoriesText = [...gameState.memories, memoryItem].map(m => `[${m.title}]: ${m.description}`).join('\n');
                chatSessionRef.current = createChatSession(gameState.waifu!, currentAffection, isR18, gameState.userName, allMemoriesText, undefined, gameState.playerPersona);
                lastSummaryIndexRef.current = 0; // Reset
            });
        }

        const newSuggestions = await generateReplySuggestions(
            [...gameState.chatHistory.slice(-4).map(m => `${m.sender}: ${m.text}`), `user: ${text}`, `waifu: ${botMsgText}`], 
            gameState.waifu, currentAffection, separationUpdate ? separationUpdate.separated : gameState.isSeparated, gameState.userName,
            genMode === 'custom' ? customData.plot : undefined
        );
        
        setGameState(prev => ({ ...prev, suggestedReplies: newSuggestions }));

    } catch (error) {
        console.error("Chat error", error);
        // If error, remove the thinking placeholder or mark error
        setGameState(prev => ({
            ...prev,
            chatHistory: prev.chatHistory.map(m => m.id === botMsgId ? { ...m, text: "(Connection Error...)" } : m)
        }));
    } finally {
        setIsThinking(false);
    }
  };

  const handleReturnToMenu = () => {
       setPhase('config');
       setGameState({
          sessionId: '', lastUpdated: 0, hasApiKey: true, userName: '', waifu: null, waifuImage: null, initialSceneImage: null, currentSceneVisual: '',
          visualState: { waifuPose: '', waifuClothing: '', userAction: '', envAtmosphere: '' },
          affectionScore: 40, chatHistory: [], suggestedReplies: [], inventory: [], memories: [], unlockedSecrets: [], isSeparated: false, hasContactInfo: false,
          artStyle: 'Anime', playerPersona: '', isCustomCharacter: false
       });
       setPreviewProfile(null);
       setEndingData(null);
  }

  if (!hasKey) {
    return <ApiKeyModal onSuccess={() => setHasKey(true)} />;
  }

  return (
    <>
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
        onCancel={closeConfirm} 
      />
      <TextEditorModal 
        isOpen={editorModal.isOpen} 
        title={editorModal.title} 
        initialValue={editorModal.value} 
        placeholder={editorModal.placeholder}
        onSave={handleEditorSave} 
        onClose={() => setEditorModal(prev => ({ ...prev, isOpen: false }))} 
      />

      {/* RENDER CONFIGURATION SCREEN */}
      {phase === 'config' && (
          <div className="h-screen w-full bg-slate-900 text-white overflow-y-auto scrollbar-hide">
              <div className="min-h-full flex flex-col items-center p-4 md:p-8 pt-20 md:pt-24 pb-20">
                  <div className="max-w-4xl w-full space-y-8 pb-10">
                      {/* Header */}
                      <div className="text-center space-y-2">
                          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-600 animate-float">
                              Waifu Generator AI
                          </h1>
                          <p className="text-slate-400">基于 Google Gemini 打造的深度角色扮演体验</p>
                      </div>

                      {/* Mode Tabs */}
                      <div className="flex justify-center mb-6">
                          <div className="bg-slate-800 p-1 rounded-xl flex">
                              <button onClick={() => setGenMode('preset')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${genMode === 'preset' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>✨ 随机向导</button>
                              <button onClick={() => setGenMode('custom')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${genMode === 'custom' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>📄 自定义</button>
                              <button onClick={() => setGenMode('history')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${genMode === 'history' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>📜 历史记录</button>
                          </div>
                      </div>

                      {/* History Mode UI */}
                      {genMode === 'history' && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                              <h2 className="text-xl font-bold text-slate-300 mb-4">存档列表</h2>
                              {savedSessions.length === 0 ? (
                                  <div className="text-center py-10 text-slate-500 bg-slate-800/50 rounded-xl border border-white/5">
                                      <p>暂无存档。去开始一段新的邂逅吧！</p>
                                  </div>
                              ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {savedSessions.map(session => (
                                          <div key={session.sessionId} className="bg-slate-800 border border-white/10 rounded-xl p-4 flex gap-4 hover:border-purple-500/50 transition-all group relative cursor-pointer" onClick={() => handleLoadSession(session)}>
                                              {/* Image */}
                                              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-black/30">
                                                  {session.waifuImage && <img src={session.waifuImage} className="w-full h-full object-cover" />}
                                              </div>
                                              
                                              {/* Info */}
                                              <div className="flex-1 min-w-0">
                                                  <div className="flex justify-between items-start">
                                                      <h3 className="font-bold text-white text-lg truncate">{session.waifu?.name}</h3>
                                                      <span className="text-xs text-slate-500 bg-black/20 px-2 py-0.5 rounded">{session.waifu?.race}</span>
                                                  </div>
                                                  <p className="text-sm text-purple-400 mb-1">{session.waifu?.job}</p>
                                                  <div className="flex items-center gap-3 text-xs text-slate-400">
                                                      <span className="flex items-center gap-1"><span className="text-pink-500">♥</span> {session.affectionScore}</span>
                                                      <span>📅 {new Date(session.lastUpdated).toLocaleDateString()}</span>
                                                  </div>
                                              </div>

                                              {/* Actions */}
                                              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/80 rounded-lg p-1 z-10">
                                                  <button onClick={(e) => handleDeleteSession(e, session.sessionId)} className="p-2 text-red-400 hover:bg-red-900/30 rounded" title="删除存档">
                                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                  </button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      )}

                      {/* Wizard Mode UI */}
                      {genMode === 'preset' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                              <div className="space-y-4">
                                  <label className="text-purple-400 font-bold uppercase tracking-wider text-sm">1. 选择世界观</label>
                                  <div className="grid grid-cols-1 gap-3">
                                      {WORLD_OPTIONS.map(opt => (
                                          <button key={opt.id} onClick={() => setConfig({...config, world: opt.id, race: 'Random', job: 'Random'})} className={`p-4 rounded-xl border text-left transition-all ${config.world === opt.id ? 'bg-purple-600/20 border-purple-500' : 'bg-slate-800 border-white/5 hover:border-white/20'}`}>
                                              <div className="font-bold">{opt.label}</div>
                                              <div className="text-xs text-slate-400 mt-1">{opt.desc}</div>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <div className="space-y-6">
                                  <div>
                                      <label className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-3 block">2. 种族 (Race)</label>
                                      <div className="flex flex-wrap gap-2">
                                          <button onClick={() => setConfig({...config, race: 'Random'})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${config.race === 'Random' ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>✨ AI 自主设计</button>
                                          {(RACES_MAP[config.world] || RACES_MAP['Random']).map(r => (
                                              <button key={r} onClick={() => setConfig({...config, race: r})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${config.race === r ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{r}</button>
                                          ))}
                                      </div>
                                  </div>
                                  
                                  {/* Job Selector */}
                                  <div>
                                      <label className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-3 block">3. 职业 (Job)</label>
                                      <div className="flex flex-wrap gap-2">
                                          <button onClick={() => setConfig({...config, job: 'Random'})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${config.job === 'Random' ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>✨ AI 自主设计</button>
                                          {(JOBS_MAP[config.world] || JOBS_MAP['Random']).map(j => (
                                              <button key={j} onClick={() => setConfig({...config, job: j})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${config.job === j ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{j}</button>
                                          ))}
                                      </div>
                                  </div>

                                  {/* Personality Selector */}
                                  <div>
                                      <label className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-3 block">4. 性格 (Personality)</label>
                                      <div className="flex flex-wrap gap-2">
                                          <button onClick={() => setConfig({...config, personality: 'Random'})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${config.personality === 'Random' ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>✨ AI 自主设计</button>
                                          {PERSONALITY_MAP.map(p => (
                                              <button key={p} onClick={() => setConfig({...config, personality: p})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${config.personality === p ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{p}</button>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* Custom Mode UI ... (Simplified for brevity as no changes needed, but keeping structure) */}
                      {genMode === 'custom' && (
                          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 max-w-4xl mx-auto">
                               {/* ... Custom UI content same as before ... */}
                               <section className="space-y-4">
                                  <h3 className="text-purple-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center text-xs">1</span>
                                      角色设定
                                  </h3>
                                  <div className="bg-slate-800 p-6 rounded-2xl border border-white/5 space-y-5">
                                      <div>
                                          <label className="text-slate-400 text-xs uppercase font-bold mb-2 block">名字 (可选)</label>
                                          <input 
                                              type="text" 
                                              value={customData.name} 
                                              onChange={(e) => setCustomData({...customData, name: e.target.value})}
                                              placeholder="角色姓名..." 
                                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                          />
                                      </div>
                                      <div className="relative group">
                                          <div className="flex justify-between items-center mb-2">
                                              <label className="text-slate-400 text-xs uppercase font-bold block">人设/性格/职业</label>
                                              <button onClick={() => openEditor('persona', '角色人设', '详细描述角色性格...')} className="text-slate-500 hover:text-white transition-colors p-1" title="放大编辑">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                              </button>
                                          </div>
                                          <textarea 
                                              value={customData.persona} 
                                              onChange={(e) => setCustomData({...customData, persona: e.target.value})}
                                              placeholder="例如：一位来自古老吸血鬼家族的傲娇大小姐..." 
                                              className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white resize-none focus:outline-none focus:border-purple-500 transition-colors"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-slate-400 text-xs uppercase font-bold mb-2 block">世界观设定</label>
                                          <input 
                                              type="text" 
                                              value={customData.world} 
                                              onChange={(e) => setCustomData({...customData, world: e.target.value})}
                                              placeholder="例如：赛博朋克2077、哈利波特魔法世界..." 
                                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                          />
                                      </div>
                                      <div className="relative group">
                                          <div className="flex justify-between items-center mb-2">
                                              <label className="text-slate-400 text-xs uppercase font-bold block">剧情梗概 / 初遇</label>
                                              <button onClick={() => openEditor('plot', '剧情梗概', '详细描述初遇场景...')} className="text-slate-500 hover:text-white transition-colors p-1" title="放大编辑">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                              </button>
                                          </div>
                                          <textarea 
                                              value={customData.plot} 
                                              onChange={(e) => setCustomData({...customData, plot: e.target.value})}
                                              placeholder="描述你们是如何相遇的..." 
                                              className="w-full h-24 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white resize-none focus:outline-none focus:border-purple-500 transition-colors"
                                          />
                                      </div>
                                  </div>
                              </section>
                              <section className="space-y-4">
                                   <h3 className="text-purple-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center text-xs">2</span>
                                      外貌与参考图
                                  </h3>
                                  <div className="bg-slate-800 p-6 rounded-2xl border border-white/5">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                          <div className="md:col-span-2 relative group">
                                              <div className="flex justify-between items-center mb-2">
                                                  <label className="text-slate-400 text-xs uppercase font-bold block">外貌描述 (Prompt)</label>
                                                  <button onClick={() => openEditor('appearance', '外貌描述', '详细描述外貌特征...')} className="text-slate-500 hover:text-white transition-colors p-1" title="放大编辑">
                                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                                  </button>
                                              </div>
                                              <textarea 
                                                  value={customData.appearance} 
                                                  onChange={(e) => setCustomData({...customData, appearance: e.target.value})}
                                                  placeholder="银发，红瞳，双马尾..." 
                                                  className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white resize-none focus:outline-none focus:border-purple-500 transition-colors"
                                              />
                                          </div>
                                          <div>
                                               <label className="text-slate-400 text-xs uppercase font-bold mb-2 block">参考图 (可选)</label>
                                               <div className="w-full aspect-square bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl overflow-hidden flex flex-col items-center justify-center relative group hover:border-purple-500 transition-colors cursor-pointer">
                                                  {customData.referenceImage ? (
                                                      <>
                                                          <img src={customData.referenceImage} alt="Reference" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                          <button 
                                                              onClick={handleClearReferenceImage}
                                                              className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-md transition-colors z-20"
                                                          >
                                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                          </button>
                                                      </>
                                                  ) : (
                                                      <>
                                                          <span className="text-slate-500 text-xs">点击上传</span>
                                                      </>
                                                  )}
                                                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </section>
                          </div>
                      )}
                          
                          {/* Common Options */}
                          <div className="mt-8 bg-slate-800/50 p-6 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-bottom-8">
                                <div className="flex flex-wrap gap-6 justify-center items-center">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={shouldPolish} onChange={e => setShouldPolish(e.target.checked)} className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 bg-slate-700 border-slate-600" />
                                        <span className="text-slate-300 text-sm">✨ AI 智能润色设定</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={isR18} onChange={e => setIsR18(e.target.checked)} className="w-5 h-5 rounded text-red-600 focus:ring-red-500 bg-slate-700 border-slate-600" />
                                        <span className="text-slate-300 text-sm group-hover:text-red-400 transition-colors">🔞 启用 R18 (Adult Mode)</span>
                                    </label>
                                    {/* Image Service Settings Button */}
                                    <button 
                                        onClick={() => setShowImageServiceSettings(true)} 
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm transition-colors border border-slate-600"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <span>🖼️ {imageService.type === 'gradio' ? 'Gradio' : 'Gemini'}</span>
                                    </button>
                                </div>
                          </div>

                          {/* Image Service Settings Modal */}
                          {showImageServiceSettings && (
                              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                                  <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6">
                                      <div className="flex justify-between items-center">
                                          <h3 className="text-xl font-bold text-white">🖼️ 图片生成服务设置</h3>
                                          <button onClick={() => setShowImageServiceSettings(false)} className="text-slate-400 hover:text-white">
                                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                          </button>
                                      </div>
                                      
                                      {/* Service Type Selection */}
                                      <div className="space-y-3">
                                          <label className="text-slate-400 text-xs uppercase font-bold block">服务类型</label>
                                          <div className="flex gap-3">
                                              <button
                                                  onClick={() => setImageService(prev => ({ ...prev, type: 'gradio' }))}
                                                  className={`flex-1 py-3 px-4 rounded-xl border text-sm font-bold transition-all ${imageService.type === 'gradio' ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                              >
                                                  🚀 Gradio (推荐)
                                              </button>
                                              <button
                                                  onClick={() => setImageService(prev => ({ ...prev, type: 'gemini' }))}
                                                  className={`flex-1 py-3 px-4 rounded-xl border text-sm font-bold transition-all ${imageService.type === 'gemini' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                              >
                                                  ✨ Gemini
                                              </button>
                                          </div>
                                      </div>

                                      {/* Gradio Endpoint Input */}
                                      {imageService.type === 'gradio' && (
                                          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                              <label className="text-slate-400 text-xs uppercase font-bold block">Gradio 服务地址</label>
                                              <input
                                                  type="text"
                                                  value={imageService.gradioEndpoint}
                                                  onChange={(e) => setImageService(prev => ({ ...prev, gradioEndpoint: e.target.value }))}
                                                  placeholder={DEFAULT_GRADIO_ENDPOINT}
                                                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
                                              />
                                              <p className="text-xs text-slate-500">
                                                  默认: {DEFAULT_GRADIO_ENDPOINT}
                                              </p>
                                              <button
                                                  onClick={() => setImageService(prev => ({ ...prev, gradioEndpoint: DEFAULT_GRADIO_ENDPOINT }))}
                                                  className="text-xs text-green-400 hover:text-green-300 underline"
                                              >
                                                  恢复默认地址
                                              </button>
                                          </div>
                                      )}

                                      {imageService.type === 'gemini' && (
                                          <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-500/30 animate-in fade-in slide-in-from-top-2">
                                              <p className="text-sm text-blue-300">
                                                  ✨ 使用 Google Gemini 进行图片生成，需要有效的 API Key。
                                              </p>
                                              <p className="text-xs text-slate-400 mt-2">
                                                  支持 2K/4K 画质，但可能受内容政策限制。
                                              </p>
                                          </div>
                                      )}

                                      <div className="pt-4 flex justify-end">
                                          <button
                                              onClick={() => setShowImageServiceSettings(false)}
                                              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all"
                                          >
                                              保存设置
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {/* Generate Button */}
                          <div className="mt-8 flex justify-center">
                              <button 
                                  onClick={handleGenerateProfile}
                                  disabled={isGeneratingProfile}
                                  className="px-12 py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-lg font-bold rounded-2xl shadow-xl shadow-purple-900/30 transform transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                  {isGeneratingProfile ? (
                                      <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        正在构思角色...
                                      </>
                                  ) : (
                                      <>✨ 生成老婆设定</>
                                  )}
                              </button>
                          </div>
                  </div>
              </div>
          </div>
      )}

      {/* PREVIEW PHASE */}
      {phase === 'preview' && previewProfile && (
          <div className="h-screen w-full bg-slate-900 text-white overflow-y-auto scrollbar-hide">
             <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-8 pt-20 md:pt-24 pb-20 bg-black/20">
                 <div className="max-w-md w-full bg-slate-800 p-6 rounded-2xl border border-white/10 shadow-2xl space-y-6">
                    <h2 className="text-2xl font-bold text-white text-center">角色预览</h2>
                    <div className="space-y-4 text-sm text-slate-300">
                        <p><strong className="text-purple-400">姓名:</strong> {previewProfile.name}</p>
                        <p><strong className="text-purple-400">种族:</strong> {previewProfile.race}</p>
                        <p><strong className="text-purple-400">职业:</strong> {previewProfile.job}</p>
                        <p><strong className="text-purple-400">性格:</strong> {previewProfile.personality}</p>
                        <p className="bg-black/30 p-3 rounded-lg border border-white/5 italic">"{previewProfile.initialScenario}"</p>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-slate-500">请输入你的名字</label>
                        <input 
                            type="text" 
                            value={userNameInput} 
                            onChange={(e) => setUserNameInput(e.target.value)}
                            placeholder="你的名字..." 
                            className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-purple-500"
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button onClick={() => setPhase('config')} className="flex-1 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-colors">返回修改</button>
                        <button onClick={handleStartGame} className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg">开始剧情</button>
                    </div>
                 </div>
             </div>
          </div>
      )}

      {/* GENERATING IMAGES PHASE */}
      {phase === 'generating_images' && (
          <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-24 h-24 mb-8 relative">
                  <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-t-purple-500 border-r-pink-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2 animate-pulse">正在生成立绘与场景...</h2>
              <p className="text-slate-400">这可能需要几秒钟，请耐心等待 AI 绘图</p>
              <p className="text-slate-600 text-sm mt-8">Tips: 高分辨率图片生成较慢</p>
          </div>
      )}

      {/* CHAT PHASE */}
      {phase === 'chat' && gameState.waifu && (
        <div className="h-full w-full bg-slate-900 flex overflow-hidden relative">
            {/* Background Layer */}
            <div className="absolute inset-0 z-0">
                {gameState.initialSceneImage && (
                    <img 
                        src={gameState.initialSceneImage} 
                        alt="Background" 
                        className="w-full h-full object-cover opacity-30 blur-sm scale-110"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
            </div>

            {/* Desktop: Inventory & Memories Modals */}
            <Inventory items={gameState.inventory} isOpen={showInventoryDesktop} onClose={() => setShowInventoryDesktop(false)} />
            {showMemoriesDesktop && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-600 rounded-2xl w-full max-w-4xl h-[80vh] shadow-2xl overflow-hidden relative">
                        <MemoryGallery memories={gameState.memories} onClose={() => setShowMemoriesDesktop(false)} />
                    </div>
                </div>
            )}
            
            <div className="relative z-10 w-full h-full flex flex-col md:flex-row max-w-7xl mx-auto md:px-6 md:pb-0 gap-6">
                
                {/* Desktop Left: Character Card */}
                <div className="hidden md:block w-1/3 max-w-sm h-full pb-4 pt-[10vh]">
                    <CharacterCard 
                        profile={gameState.waifu} 
                        image={gameState.waifuImage || ''} 
                        affection={gameState.affectionScore}
                        hasContactInfo={gameState.hasContactInfo}
                        unlockedSecrets={gameState.unlockedSecrets}
                    />
                </div>

                {/* Desktop Middle / Mobile: Chat Interface */}
                <div className={`flex-1 flex flex-col relative ${activeTab === 'chat' ? 'block' : 'hidden md:flex'}`} style={{ height: '90%', marginTop: 'auto' }}>
                    <ChatInterface 
                        messages={gameState.chatHistory}
                        suggestions={gameState.suggestedReplies}
                        onSendMessage={handleSendMessage}
                        isThinking={isThinking}
                        profile={gameState.waifu}
                        isSeparated={gameState.isSeparated}
                        onExit={handleExitGame}
                    />
                </div>

                {/* Mobile Tabs Content */}
                <div className="md:hidden flex-1 h-full overflow-hidden relative z-20">
                    {activeTab === 'profile' && (
                        <div className="h-full p-4 overflow-y-auto pt-20">
                            <CharacterCard 
                                profile={gameState.waifu} 
                                image={gameState.waifuImage || ''} 
                                affection={gameState.affectionScore}
                                hasContactInfo={gameState.hasContactInfo}
                                unlockedSecrets={gameState.unlockedSecrets}
                            />
                        </div>
                    )}
                    {activeTab === 'inventory' && (
                        <div className="h-full bg-slate-900 pt-16">
                             <Inventory items={gameState.inventory} isOpen={true} onClose={() => {}} />
                        </div>
                    )}
                    {activeTab === 'memories' && (
                        <div className="h-full bg-slate-900 pt-16">
                            <MemoryGallery memories={gameState.memories} />
                        </div>
                    )}
                </div>

                {/* Desktop Right: Tools / Inventory Button */}
                <div className="hidden md:flex flex-col gap-4 py-4 pt-16">
                     <button onClick={() => setShowInventoryDesktop(true)} className="p-4 bg-slate-800 hover:bg-purple-600 rounded-xl border border-white/10 transition-all text-white shadow-lg group">
                        <svg className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        <span className="text-xs font-bold uppercase">背包</span>
                     </button>
                     <button onClick={() => setShowMemoriesDesktop(true)} className="p-4 bg-slate-800 hover:bg-pink-600 rounded-xl border border-white/10 transition-all text-white shadow-lg group">
                        <svg className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="text-xs font-bold uppercase">回忆</span>
                     </button>
                </div>
            </div>

            {/* Mobile Nav */}
            <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      )}

      {/* ENDING SCREEN */}
      {endingData && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-1000">
               <div className="w-full max-w-4xl flex flex-col items-center space-y-8">
                   <h1 className={`text-5xl md:text-7xl font-bold ${endingData.type === 'HE' ? 'text-pink-500' : 'text-blue-500'} mb-4 tracking-wider`}>
                       {endingData.type === 'HE' ? 'HAPPY ENDING' : 'BAD ENDING'}
                   </h1>
                   <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
                       <img src={endingData.imageUrl} alt="Ending" className="w-full h-full object-cover" />
                   </div>
                   <h2 className="text-3xl text-white font-serif italic">"{endingData.title}"</h2>
                   <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">{endingData.description}</p>
                   <button onClick={handleReturnToMenu} className="px-8 py-3 border border-white/30 text-white rounded-full hover:bg-white/10 transition-colors mt-8">
                       返回主菜单
                   </button>
               </div>
          </div>
      )}
  </>
  );
};