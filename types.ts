export enum AffectionLevel {
  HATED = 'Hated',
  COLD = 'Cold',
  NEUTRAL = 'Neutral',
  FRIENDLY = 'Friendly',
  LOVING = 'Loving',
  DEVOTED = 'Devoted'
}

// Image Service Configuration
export type ImageServiceType = 'gemini' | 'gradio';

export interface ImageServiceConfig {
  type: ImageServiceType;
  gradioEndpoint: string; // Custom Gradio endpoint URL
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  obtainedAt: number;
}

export interface StoryMemory {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  timestamp: number;
}

export interface WaifuProfile {
  name: string;
  race: string;
  age: string;
  job: string;
  personality: string;
  appearance: string;
  backstory: string;
  secret: string; // Unlocked at high affection (>500)
  hiddenSecrets: string[]; // List of 10 memory fragments (Unlocked >100 + Item)
  initialScenario: string; // Context of the meeting
  initialMemoryTitle: string; // Title for the first memory
  initialAffection: number; // Dynamic start score based on relationship
  openingMessage: string; // First message sent by waifu
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'waifu' | 'system';
  text: string;
  timestamp: number;
  imageUrl?: string; // For generated scenes
}

export interface EndingData {
  type: 'HE' | 'BE';
  title: string;
  description: string;
  imageUrl: string;
}

// New Interface for tracking detailed visual context
export interface VisualState {
  waifuPose: string;        // e.g. "Sitting on the edge of the bed, looking shy"
  waifuClothing: string;    // e.g. "Pajamas, slightly disheveled"
  userAction: string;       // e.g. "Holding her hand", "Standing by the door"
  envAtmosphere: string;    // e.g. "Moonlight streaming through window, dim"
}

export interface GameState {
  sessionId: string; // Unique ID for save slot
  lastUpdated: number; // Timestamp
  hasApiKey: boolean;
  userName: string; // Player's name
  waifu: WaifuProfile | null;
  waifuImage: string | null; // Base64
  initialSceneImage: string | null; // Base64 for the background/first scene
  currentSceneVisual: string; // General background description
  visualState: VisualState; // NEW: Specific tracking of actors and details
  affectionScore: number; // 0-1000
  chatHistory: ChatMessage[];
  suggestedReplies: string[];
  inventory: InventoryItem[];
  memories: StoryMemory[];
  unlockedSecrets: string[]; // Secrets unlocked during gameplay
  isSeparated: boolean; // True if user is not physically with the waifu
  hasContactInfo: boolean; // True if user has phone number
  ending?: EndingData; // If present, the game is over
  artStyle: string; // Visual style preference
  playerPersona: string; // Description of the player character
  isCustomCharacter: boolean; // True if created via Custom Mode (Strict adherence to prompt)
}