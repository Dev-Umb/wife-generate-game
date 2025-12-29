import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, SchemaType, ChatSession, GenerationConfig, Content } from "@google/generative-ai";
import { WaifuProfile, ChatMessage, VisualState, ImageServiceConfig } from "../types";

// Default Gradio endpoint
const DEFAULT_GRADIO_ENDPOINT = import.meta.env.VITE_GRADIO_ENDPOINT || "";

const GRADIO_SIZE_MAP = {
  portrait: { width: 768, height: 1024 },
  scene: { width: 1024, height: 576 },
  item: { width: 1024, height: 1024 }
} as const;

type GradioImageType = keyof typeof GRADIO_SIZE_MAP;

/* --- Gradio Logic (Unchanged) --- */
const generateImageWithGradio = async (
  prompt: string,
  imageType: GradioImageType,
  gradioEndpoint: string = DEFAULT_GRADIO_ENDPOINT
): Promise<string> => {
  const size = GRADIO_SIZE_MAP[imageType];
  try {
    const submitResponse = await fetch(gradioEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [prompt, size.height, size.width] })
    });
    if (!submitResponse.ok) throw new Error(`Gradio submit failed: ${submitResponse.status}`);
    const submitResult = await submitResponse.json();
    const eventId = submitResult.event_id || submitResult;
    if (!eventId) throw new Error("No event_id returned");

    const resultResponse = await fetch(`${gradioEndpoint}/${eventId}`);
    if (!resultResponse.ok) throw new Error("Gradio result fetch failed");
    const resultText = await resultResponse.text();
    const dataMatch = resultText.match(/data:\s*(\[.*\])/);
    if (!dataMatch) throw new Error("Could not parse Gradio SSE");
    const resultData = JSON.parse(dataMatch[1]);
    const imageInfo = resultData[0];
    if (!imageInfo?.url) throw new Error("No image URL");

    const imageResponse = await fetch(imageInfo.url);
    const imageBlob = await imageResponse.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });
  } catch (error) {
    console.error("Gradio generation failed:", error);
    return ""; // Return empty string on failure handled by caller
  }
};

/* --- Key Management --- */
let storedApiKey = '';
export const setStoredApiKey = (key: string) => {
  storedApiKey = key;
  try { sessionStorage.setItem("gemini_api_key", key); } catch (e) { }
};

const getClient = () => {
  const sessionKey = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("gemini_api_key") : null;
  const apiKey = storedApiKey || sessionKey || (import.meta as any).env.VITE_GEMINI_API_KEY || "";
  // Note: App.tsx or env handling might differ, logic adapted. 
  // Ideally process.env.API_KEY or import.meta.env.VITE_API_KEY

  if (!apiKey) throw new Error("API Key missing");
  return new GoogleGenerativeAI(apiKey);
};

export const checkApiKey = async (): Promise<boolean> => {
  if (storedApiKey) return true;
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem("gemini_api_key")) return true;
  // @ts-ignore
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    // @ts-ignore
    return await window.aistudio.hasSelectedApiKey();
  }
  return false;
};

export const requestApiKey = async (): Promise<boolean> => {
  // @ts-ignore
  if (window.aistudio && window.aistudio.openSelectKey) {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // @ts-ignore
      return await window.aistudio.hasSelectedApiKey();
    } catch (e) {
      console.error(e);
      return false;
    }
  }
  return false;
};

/* --- Profile Generation --- */
export const generateWaifuProfile = async (preferences: any = { world: 'Random' }): Promise<WaifuProfile> => {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      name: { type: SchemaType.STRING },
      race: { type: SchemaType.STRING },
      age: { type: SchemaType.STRING },
      job: { type: SchemaType.STRING },
      personality: { type: SchemaType.STRING },
      appearance: { type: SchemaType.STRING },
      backstory: { type: SchemaType.STRING },
      secret: { type: SchemaType.STRING },
      hiddenSecrets: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      initialScenario: { type: SchemaType.STRING },
      initialMemoryTitle: { type: SchemaType.STRING },
      initialAffection: { type: SchemaType.NUMBER },
      openingMessage: { type: SchemaType.STRING },
    },
    required: ["name", "race", "age", "job", "personality", "appearance", "backstory", "secret", "hiddenSecrets", "initialScenario", "initialMemoryTitle", "initialAffection", "openingMessage"],
  };

  const prompt = `Design a unique anime waifu. Output JSON.
  User Preferences: ${JSON.stringify(preferences)}.
  Strictly follow fields. Appearance must be detailed.
  Opening Message must match Initial Scenario.`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
      temperature: 1.0,
    }
  });

  return JSON.parse(result.response.text()) as WaifuProfile;
};

/* --- Image Wrappers --- */
export const generateWaifuImage = async (
  appearance: string,
  size: "1K" | "2K" | "4K" = "1K",
  isR18: boolean = false,
  refImage?: string,
  artStyle: string = "Anime",
  isCustom: boolean = false,
  service?: ImageServiceConfig
) => {
  let prompt = `(masterpiece), (best quality), ${artStyle} style, ${appearance}`;
  if (isR18) {
    prompt += `, nsfw, mature, detailed features`;
  }
  if (refImage) {
    // In a real implementation with ControlNet, we'd use refImage.
    // Here we might verify if Gradio supports it, but for now just optimize prompt.
    prompt += `, consistent character`;
  }
  return generateImageWithGradio(prompt, 'portrait', service?.gradioEndpoint);
};

export const generateSceneImage = async (
  characterAppearance: string,
  visualState: VisualState,
  context: string,
  size: "1K" | "2K" | "4K" = "1K",
  isR18: boolean = false,
  artStyle: string = "Anime",
  isCustom: boolean = false,
  refImage?: string,
  service?: ImageServiceConfig
) => {
  // Restore detailed prompt structure: [Style] Character Visual: ... Scene Context: ...
  const r18Keywords = isR18 ? "nsfw, mature," : "";
  const visualDesc = `Character Visual: ${characterAppearance}. Pose: ${visualState.waifuPose}. Clothing: ${visualState.waifuClothing}.`;
  const contextDesc = `Scene Context: ${context}. Atmosphere: ${visualState.envAtmosphere}. User Action: ${visualState.userAction}.`;

  const prompt = `(masterpiece), (best quality), ${artStyle} style, ${r18Keywords} ${visualDesc} ${contextDesc}, detailed background, cinematic lighting, 8k resolution`;

  return generateImageWithGradio(prompt, 'scene', service?.gradioEndpoint);
};

export const generateItemImage = async (description: string, service?: ImageServiceConfig) => {
  const prompt = `Game item illustration, (masterpiece), ${description}, single object, black background`;
  return generateImageWithGradio(prompt, 'item', service?.gradioEndpoint);
};

/* --- Chat Session --- */
export const createChatSession = (
  profile: WaifuProfile,
  initialAffection: number,
  isR18: boolean = false,
  userName: string = "Player",
  memoriesContext: string = "",
  history?: ChatMessage[],
  playerPersona: string = ""
): ChatSession => {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    systemInstruction: `You are ${profile.name}, a ${profile.age} year old ${profile.race} ${profile.job}.
    Personality: ${profile.personality}.
    Backstory: ${profile.backstory}.
    Current Affection: ${initialAffection}.
    User is ${userName} (${playerPersona}).
    ${isR18 ? "NSFW allowed." : "Keep it PG-13."}
    Speak in character. Short responses.`
  });

  const historyContent = (history || [])
    .filter(m => m.sender === 'user' || m.sender === 'waifu')
    .map(m => ({
      role: m.sender === 'waifu' ? 'model' : 'user',
      parts: [{ text: m.text }]
    }));

  // Ensure first message is from user (Gemini API requirement)
  if (historyContent.length > 0 && historyContent[0].role === 'model') {
    historyContent.unshift({ role: 'user', parts: [{ text: "(System: Start Conversation)" }] });
  }

  return model.startChat({
    history: historyContent,
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
    }
  });
};

/* --- Reply Suggestions --- */
export const generateReplySuggestions = async (
  chatHistory: string[],
  profile: WaifuProfile,
  affection: number,
  isSeparated: boolean,
  userName: string,
  context?: string
): Promise<string[]> => {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `Suggest 3 user replies for the visual novel.
  Context: ${userName} talking to ${profile.name}.
  History: ${chatHistory.slice(-3).join('\n')}.
  Output JSON array of strings.`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
    }
  });

  return JSON.parse(result.response.text()) as string[];
};

export const summarizeHistory = async (messages: ChatMessage[], waifuName: string, userName: string) => {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const text = messages.map(m => `${m.sender}: ${m.text}`).join('\n');

  const result = await model.generateContent(`Summarize this chat in Chinese. Output JSON {title, content}. Text: ${text}`);
  const validJson = result.response.text().replace(/```json/g, '').replace(/```/g, '');
  return JSON.parse(validJson);
};
