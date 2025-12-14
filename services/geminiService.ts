import { GoogleGenAI, Type, FunctionDeclaration, Schema, Chat, Tool, HarmCategory, HarmBlockThreshold, Content } from "@google/genai";
import { WaifuProfile, ChatMessage, VisualState, ImageServiceConfig } from "../types";

// Default Gradio endpoint from environment variable
const DEFAULT_GRADIO_ENDPOINT = import.meta.env.VITE_GRADIO_ENDPOINT || "";

// Image size mappings for Gradio
const GRADIO_SIZE_MAP = {
    portrait: { width: 768, height: 1024 },   // 3:4 角色立绘
    scene: { width: 1024, height: 576 },      // 16:9 场景图
    item: { width: 1024, height: 1024 }       // 1:1 道具图
} as const;

type GradioImageType = keyof typeof GRADIO_SIZE_MAP;

/**
 * Generate image using Gradio API (Two-step async process)
 * Step 1: Submit request and get EVENT_ID
 * Step 2: Poll for result via SSE
 */
const generateImageWithGradio = async (
    prompt: string,
    imageType: GradioImageType,
    gradioEndpoint: string = DEFAULT_GRADIO_ENDPOINT
): Promise<string> => {
    const size = GRADIO_SIZE_MAP[imageType];
    
    try {
        // Step 1: Submit generation request
        // Note: Gradio API expects [prompt, width, height] but some implementations use [prompt, height, width]
        // Based on testing, we use width first for landscape scenes
        const submitResponse = await fetch(gradioEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: [prompt, size.height, size.width]  // Swapped: height first, then width
            })
        });
        
        if (!submitResponse.ok) {
            throw new Error(`Gradio submit failed: ${submitResponse.status}`);
        }
        
        const submitResult = await submitResponse.json();
        const eventId = submitResult.event_id || submitResult;
        
        if (!eventId) {
            throw new Error("No event_id returned from Gradio");
        }
        
        // Step 2: Poll for result (SSE endpoint)
        const resultResponse = await fetch(`${gradioEndpoint}/${eventId}`);
        
        if (!resultResponse.ok) {
            throw new Error(`Gradio result fetch failed: ${resultResponse.status}`);
        }
        
        const resultText = await resultResponse.text();
        
        // Parse SSE response - find the "data:" line with JSON
        const dataMatch = resultText.match(/data:\s*(\[.*\])/);
        if (!dataMatch) {
            throw new Error("Could not parse Gradio SSE response");
        }
        
        const resultData = JSON.parse(dataMatch[1]);
        const imageInfo = resultData[0];
        
        if (!imageInfo || !imageInfo.url) {
            throw new Error("No image URL in Gradio response");
        }
        
        // Step 3: Download image and convert to Base64
        const imageUrl = imageInfo.url;
        const imageResponse = await fetch(imageUrl);
        
        if (!imageResponse.ok) {
            throw new Error(`Image download failed: ${imageResponse.status}`);
        }
        
        const imageBlob = await imageResponse.blob();
        
        // Convert blob to base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                resolve(base64); // Already includes "data:image/webp;base64,..."
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
        });
        
    } catch (error) {
        console.error("Gradio image generation failed:", error);
        throw error;
    }
};

// Runtime key storage for manual input fallback
let storedApiKey = '';

export const setStoredApiKey = (key: string) => {
  storedApiKey = key;
  try {
      sessionStorage.setItem("gemini_api_key", key);
  } catch (e) {
      console.warn("Failed to save API key to session storage", e);
  }
};

// Helper to get client with fresh key
const getClient = () => {
  // Priority: Runtime Variable -> Session Storage -> Env Variable
  const sessionKey = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("gemini_api_key") : null;
  const apiKey = storedApiKey || sessionKey || process.env.API_KEY;
  
  if (!apiKey) {
      throw new Error("API Key is missing. Please provide a valid Gemini API Key.");
  }
  return new GoogleGenAI({ apiKey });
};

export const checkApiKey = async (): Promise<boolean> => {
  if (storedApiKey) return true;
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem("gemini_api_key")) return true;
  
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    return await window.aistudio.hasSelectedApiKey();
  }
  return false;
};

export const requestApiKey = async (): Promise<boolean> => {
  // Check if AI Studio environment is available
  if (window.aistudio && window.aistudio.openSelectKey) {
    try {
        await window.aistudio.openSelectKey();
        return await window.aistudio.hasSelectedApiKey();
    } catch (e) {
        console.warn("AI Studio key selection failed:", e);
        return false;
    }
  }
  return false;
};

export interface WaifuPreferences {
  world: string;
  race: string;
  job: string;
  personality: string;
  // Expanded Custom Fields
  customName?: string;
  customPersona?: string;    // Character personality/bio input
  customAppearance?: string; // Visual description input
  customWorld?: string;      // World setting input
  customPlot?: string;       // Story outline input
  customImage?: string;      // Base64 image string for reference
  polish?: boolean;
  isR18?: boolean; 
  userName?: string;
}

// Permissive safety settings for R18 mode (BLOCK_NONE)
const PERMISSIVE_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Standard safety settings for Normal mode (BLOCK_ONLY_HIGH) to prevent false positives on creative writing
const STANDARD_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

/**
 * Generates a consistent Waifu Profile using JSON Schema
 */
export const generateWaifuProfile = async (preferences: WaifuPreferences = { world: 'Random', race: 'Random', job: 'Random', personality: 'Random' }): Promise<WaifuProfile> => {
  const ai = getClient();
  const userNamePlaceholder = preferences.userName || "你"; 
  
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Character name (Chinese or Western name in Chinese characters). IMPORTANT: MUST NOT be '你', '玩家', or the User Name." },
      race: { type: Type.STRING, description: "Race (e.g., Human, Elf, Demon, Cyborg, Beastkin, Vampire, Ghost, Angel, Dragon-girl)" },
      age: { type: Type.STRING, description: "Age or apparent age" },
      job: { type: Type.STRING, description: "Occupation (e.g. Hacker, Assassin, Mage, Idol, Knight, Villain, Student)" },
      personality: { type: Type.STRING, description: "Detailed personality traits. Can be Dark, Tsundere, Yandere, Haughty, Shy, Genki, etc." },
      appearance: { type: Type.STRING, description: "详细的外貌描写 (中文)。包括发色、发型、瞳色、服装细节、配饰、体型等。必须符合其种族、职业和性格设定。(例如：机械师要有护目镜和油污，公主穿着华丽礼服，吸血鬼皮肤苍白且有哥特元素)。" },
      backstory: { type: Type.STRING, description: "A compelling paragraph about their past history and motivations." },
      secret: { type: Type.STRING, description: "A deep secret only revealed to close ones (>500 Affection)." },
      hiddenSecrets: { type: Type.ARRAY, items: { type: Type.STRING }, description: "10 specific hidden memory fragments or secrets about her past, specific to this character's lore. They will be unlocked one by one." },
      initialScenario: { type: Type.STRING, description: `初次相遇的详细场景描写 (Detailed Narrative)。描写她与"${userNamePlaceholder}"相遇的情景。不要只写地点，要描写氛围、光影、用户正在做什么、以及如何偶遇了她。让玩家有代入感。` },
      initialMemoryTitle: { type: Type.STRING, description: "给初次相遇起一个唯美或难忘的标题 (e.g., '雨夜的邂逅', '转角的樱花')." },
      initialAffection: { type: Type.NUMBER, description: "Based on the backstory: Enemies/Hostile=0-20, Strangers=40, Acquaintances=60, Childhood Friends/Lovers=150." },
      openingMessage: { type: Type.STRING, description: `The first sentence the character says. **CRITICAL**: This message MUST directly respond to the event described in 'initialScenario'. Do NOT act like you just woke up unless the scenario says so. If the scenario is 'meeting in a library', the message must be about books or being quiet.` },
    },
    required: ["name", "race", "age", "job", "personality", "appearance", "backstory", "secret", "hiddenSecrets", "initialScenario", "initialMemoryTitle", "initialAffection", "openingMessage"],
  };

  let userConstraints = '';

  // Check if any custom field is present (Custom Mode)
  const isCustomMode = preferences.customPersona || preferences.customWorld || preferences.customPlot || preferences.customAppearance || preferences.customImage;

  if (isCustomMode) {
      userConstraints = `
        【用户自定义设定 (Custom Configuration)】
        用户提供了一些具体设定，请基于以下信息生成角色。
        
        ${preferences.customName ? `- 指定名字: ${preferences.customName}` : ''}
        ${preferences.customWorld ? `- 世界观/背景: ${preferences.customWorld}` : ''}
        ${preferences.customPersona ? `- 人设/性格/职业: ${preferences.customPersona}` : ''}
        ${preferences.customAppearance ? `- 外貌/立绘描述: ${preferences.customAppearance}` : ''}
        ${preferences.customPlot ? `- 剧情梗概/初遇情景: ${preferences.customPlot}` : ''}
        ${preferences.customImage ? `- [重要] 用户已上传了一张参考图片。请**仔细分析图片中的角色外貌特征**（发色、瞳色、服装、配饰、体型等），并将其准确地写入 'appearance' 字段中。` : ''}

        ${preferences.polish 
            ? '指令 (AI Polish: ON): 请基于用户的上述内容进行**润色和扩展**。保持核心设定不变，但丰富细节，使其更符合二次元角色魅力，补充缺失的字段（如未提供职业或性格，请根据描述推断）。逻辑必须自洽。' 
            : '指令 (AI Polish: OFF): 请**严格遵循**用户的上述内容。将用户输入映射到JSON字段中。对于用户未提及的字段，进行最简约、合乎逻辑的补全，不要过度发挥或随意添加用户未要求的设定。'}
      `;
  } else {
      userConstraints = `
        用户指定偏好 (Wizard Mode):
        - 世界观/背景: ${preferences.world}
        - 种族: ${preferences.race}
        - 职业: ${preferences.job}
        - 性格倾向: ${preferences.personality}
        
        【重要】必须严格遵守上述指定属性。如果用户指定了职业是“魔王”，就必须生成魔王，不要改成正面的角色。
        如果属性是 "Random"，则由你自主发挥 (Autonomous Creation)，不要总是重复相同的设定，大胆创造。
      `;
  }

  let r18Instructions = "";
  if (preferences.isR18){
      r18Instructions = `
      【🔞 R18/Adult Mode Active】
      - 角色设定应当更加成熟、性感或具有诱惑力。
      - 外貌描述中可以包含更大胆的特征（如身材丰满、性感着装、诱惑的眼神等）。
      - 性格中可以包含对“性”或“亲密关系”的暗示或渴望（如魅魔、痴女、抖M等）。
      - 不要避讳成人的主题。
      `;
  }

  const prompt = `
    设计一个极具个性和创意的二次元老婆角色。请使用中文输出。
    用户名称: "${userNamePlaceholder}"。
    
    ${userConstraints}

    ${r18Instructions}

    【核心指令：创意与避雷】
    1. **拒绝空洞宏大与太空题材**: 严禁生成“星光之灵”、“梦境守护者”、“宇宙意识”、“星际舰长”、“外星女王”等抽象或太空歌剧设定。**不要涉及宇宙、星系、梦境世界、星球意识**。角色必须生活在具体的地球（或类地）环境中（如城市、森林、废土、地下城）。
    2. **审美在线**: 外貌必须与职业和种族契合。
    3. **多样性**:
       - 如果用户选择了负面或反派职业（如死灵法师、杀手），请大胆设计，**不要**强行把她变成好人或治愈系。
       - 如果用户选择了正面职业（如护士、天使），则设计得治愈美好。
    4. **Gap Moe (反差萌)**: 即使属性已定，也可以加入反差。比如“冷酷的杀手其实喜欢吃甜食”。
    5. **初始好感度 (Initial Affection)**:
       - 仇敌/对立阵营 (如勇者vs魔王): 0 - 20。
       - 陌生人/路人: 40。
       - 熟人/同事: 60。
       - 青梅竹马/救命恩人/前世恋人: 150。           
    6. **10个隐藏秘密**: 必须生成10个具体的、与该角色背景故事紧密相关的秘密或记忆碎片。这些秘密应该包含：童年阴影、重大转折、不为人知的爱好、对主角的特殊看法等。
    7. **命名禁忌**: 角色的名字 **绝对不能** 是 "你"、"玩家"、"旅行者" 或 "${userNamePlaceholder}"。必须是一个真正的名字 (e.g. 莉莉丝, 苏婉, 艾拉)。
    
    【参考灵感库 (仅供自主设计时参考)】
    - **Race**: Elf, Demon, Vampire, Cyborg, Neko, Dragon-girl, Ghost, Dullahan.
    - **Job**: Knight, Hacker, Idol, Necromancer, Yakuza, Princess, Scientist, Cafe Staff.
    - **Personality**: Tsundere, Yandere, Kuudere, Genki, Gloomy, Himedere.

    **场景与开场白逻辑一致性**:
    - **Initial Scenario**: 必须具体，有画面感。
    - **Opening Message**: **必须严格对应场景**。如果场景是“她在巷子里受伤了”，开场白不能是“早上好，今天要吃什么？”而应该是“...咳咳，别过来，你是谁？”。
  `;

  // Use permissive settings for R18, and standard (lenient) settings for normal to prevent false positives
  const safetySettings = preferences.isR18 ? PERMISSIVE_SAFETY_SETTINGS : STANDARD_SAFETY_SETTINGS;
  
  let attempts = 0;
  const maxAttempts = 2;

  // Prepare contents (Text + Optional Image)
  const contents: any[] = [{ text: prompt }];
  if (preferences.customImage) {
      try {
        const base64Data = preferences.customImage.split(',')[1] || preferences.customImage;
        const mimeType = preferences.customImage.split(';')[0].split(':')[1] || "image/png";
        contents.unshift({ // Add image BEFORE text to ensure it's context
            inlineData: {
                mimeType: mimeType,
                data: base64Data
            }
        });
      } catch (e) {
          console.warn("Invalid reference image format for profile generation", e);
      }
  }

  while (attempts < maxAttempts) {
      try {
          const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", // UPDATED to 3 Pro for better creative writing & vision analysis
            contents: contents, // Passing array with image if available
            config: {
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 1.0, 
              safetySettings: safetySettings
            },
          });

          if (response.text) {
              try {
                  const data = JSON.parse(response.text);
                  return data as WaifuProfile;
              } catch (e) {
                  console.warn(`Attempt ${attempts + 1}: JSON parse failed.`, e);
              }
          } else {
              console.warn(`Attempt ${attempts + 1}: Empty response from AI.`);
          }
      } catch (e) {
          console.warn(`Attempt ${attempts + 1}: API call failed.`, e);
      }
      attempts++;
  }

  throw new Error("AI response was empty (possibly blocked by safety settings) after retries.");

};

/**
 * Helper to get prompt suffix based on Art Style
 */
const getStylePrompt = (style: string) => {
    switch (style) {
        case 'Manga':
            return "Japanese Manga style, black and white, detailed screentones, high quality ink drawing, sharp lines.";
        case 'Male':
            return "Otome game CG, handsome male character focus, detailed, sparkling, shoujo manga style.";
        default:
            // Default Anime
            return "Visual Novel Event CG, Masterpiece anime art style. high quality, detailed, soft lighting, vibrant colors, trending on artstation, 2d anime style, cell shading, sharp lines.";
    }
};

/**
 * Generates the Waifu Image using Gradio (default) or Gemini with Fallback
 * UPDATED: Support for service selection
 */
export const generateWaifuImage = async (
    description: string, 
    size: "1K" | "2K" | "4K" = "1K", 
    isR18: boolean = false,
    referenceImage?: string, // Base64 string (optional, only used by Gemini)
    artStyle: string = "Anime",
    isCustom: boolean = false,
    imageService?: ImageServiceConfig // New: service selection
): Promise<string> => {
  const stylePrompt = getStylePrompt(artStyle) + " textless, no speech bubbles, no ui, no HUD, no words.";
  
  let r18Keywords = "";
  if (isR18) {
      const baseR18 = `
        NSFW, explicit, uncensored, adult content, 18+,
        pose: seductive pose, M-legs spread wide, thighs apart showing crotch, full body centered,
        anatomy: anatomically correct, detailed nipples and areola, visible pussy/vulva details, labia visible,
        expression: lewd expression, ahegao potential, blushing heavily, bedroom eyes, parted lips, tongue slightly out, anticipating,
        skin: glistening with sweat, realistic skin texture, blush spreading to chest, goosebumps,
        body: large breasts with realistic sag and jiggle physics, wide hips, thick thighs with skindentation,
        details: love juice/wetness between thighs, nipples erect and prominent, 
        lighting: sensual soft lighting, rim light on curves, 8k masterpiece quality,
        atmosphere: erotic tension, inviting the viewer
      `;

      if (isCustom) {
          r18Keywords = `
            ${baseR18},
            CLOTHING: Keep character's original outfit [${description}], but in erotic state:
            - clothes disheveled, unbuttoned, pulled aside, lifted up
            - bra unhooked or pulled down exposing breasts
            - panties pulled to side or around one thigh, showing pussy
            - stockings with runs/holes, garter visible
            Maintain character identity while being explicit.
          `;
      } else {
          r18Keywords = `
            ${baseR18},
            outfit state: nearly nude or revealing,
            options: 
            - completely naked with only accessories,
            - micro bikini barely covering nipples, pulled aside at crotch,
            - see-through lingerie, nipples and pussy visible through fabric,
            - open-front bodysuit, crotchless panties,
            legwear: thigh-highs with tight skindentation, garter belt, or nude
          `;
      }
  }

  // Build the full prompt
  const composition = isR18 ? "pov intimate shot, full body, legs spread invitingly, looking at viewer with desire" : "solo";
  const fullPrompt = `${stylePrompt} Portrait of a female character. ${r18Keywords}. Visual: [${description}]. ${composition}, looking at viewer, detailed eyes, emotive expression. clean background, no text, no speech bubble.`;

  // --- Use Gradio Service (Default) ---
  const serviceType = imageService?.type || 'gradio';
  
  if (serviceType === 'gradio') {
      try {
          const gradioEndpoint = imageService?.gradioEndpoint || DEFAULT_GRADIO_ENDPOINT;
          return await generateImageWithGradio(fullPrompt, 'portrait', gradioEndpoint);
      } catch (gradioError) {
          console.warn("Gradio image generation failed, falling back to Gemini...", gradioError);
          // Fall through to Gemini
      }
  }

  // --- Gemini Fallback (or if explicitly selected) ---
  const ai = getClient();
  
  const constructPrompt = (keywords: string, hasRefImage: boolean) => {
      const refInstruction = hasRefImage ? "Create a character portrait that strongly resembles the provided reference image (pose, composition, or style), but matching the following description:" : "Portrait of a female character.";
      return `${stylePrompt} ${refInstruction} ${keywords}. Visual: [${description}]. ${composition}, looking at viewer, detailed eyes, emotive expression. clean background, no text, no speech bubble.`;
  };

  const parts: any[] = [];
  
  if (referenceImage) {
      try {
        const base64Data = referenceImage.split(',')[1] || referenceImage;
        const mimeType = referenceImage.split(';')[0].split(':')[1] || "image/png";
        parts.push({
            inlineData: {
                mimeType: mimeType,
                data: base64Data
            }
        });
      } catch (e) {
          console.warn("Invalid reference image format", e);
      }
  }

  parts.push({ text: constructPrompt(r18Keywords, !!referenceImage) });

  // --- Attempt 1: Gemini 3 Pro (High Quality) ---
  try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts: parts },
        config: {
          imageConfig: { aspectRatio: "3:4", imageSize: size },
          safetySettings: isR18 ? PERMISSIVE_SAFETY_SETTINGS : undefined
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
      }
      console.warn("Gemini 3 Pro completed but returned no image data.");
  } catch (e) {
      console.warn("Gemini 3 Pro Image failed, falling back to Flash...", e);
  }

  // --- Attempt 2: Gemini 2.5 Flash Image ---
  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: parts },
        config: {
          imageConfig: { aspectRatio: "3:4" },
          safetySettings: isR18 ? PERMISSIVE_SAFETY_SETTINGS : undefined
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
      }
  } catch (fallbackError) {
      console.warn("Flash Image fallback failed", fallbackError);
  }

  // --- Attempt 3: Safety Fallback ---
  if (isR18) {
      console.warn("Attempts with R18 keywords failed. Retrying with SAFE prompt.");
      try {
        const safeParts = [...parts];
        safeParts.pop(); 
        safeParts.push({ text: constructPrompt("", !!referenceImage) });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: { parts: safeParts }, 
            config: {
              imageConfig: { aspectRatio: "3:4" }
            }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
        }
      } catch (safeError) {
          console.error("Safe fallback also failed", safeError);
      }
  }
  
  return "https://placehold.co/600x800/png?text=Image+Generation+Failed";
};

/**
 * Generates a Scene Image (Landscape) with Gradio (default) or Gemini Fallback
 * UPDATED: Support for service selection
 */
export const generateSceneImage = async (
    characterAppearance: string, 
    visualState: VisualState, 
    extraPrompt: string, 
    size: "1K" | "2K" | "4K" = "1K", 
    isR18: boolean = false,
    artStyle: string = "Anime",
    isCustom: boolean = false,
    referenceImage?: string, // Optional reference image for character consistency (Gemini only)
    imageService?: ImageServiceConfig // New: service selection
): Promise<string> => {
  const stylePrompt = getStylePrompt(artStyle) + " textless, no speech bubbles, no dialogue box.";
  
  const fullDescription = `
    Waifu Visual: ${visualState.waifuPose}, ${visualState.waifuClothing}. 
    User Action: ${visualState.userAction}. 
    Environment: ${visualState.envAtmosphere}. 
    Specific Event: ${extraPrompt}
  `;

  const interactionKeywords = ["touch", "hold", "hand", "kiss", "hug", "embrace", "caress", "lap", "pov", "close", "intimate", "bed"];
  const isInteraction = interactionKeywords.some(keyword => fullDescription.toLowerCase().includes(keyword));

  let r18Keywords = "";
  if (isR18) {
      // 根据场景动态生成 R18 描述
      const baseR18 = `
        NSFW, explicit, uncensored, adult content, 18+,
        anatomy: anatomically correct female body, realistic proportions, detailed genitalia, 
        nipples: erect nipples, areola details, breast physics,
        vulva: detailed labia, clitoris visible, wet pussy, love juice dripping,
        expression: ahegao, heart-shaped pupils, tongue out, drooling, heavy breathing, orgasm face, tears of pleasure, flushed cheeks,
        body details: sweat glistening on skin, goosebumps, trembling thighs, muscle tension, arched back,
        skin texture: realistic skin pores, blush spreading from face to chest, hickey marks, bite marks,
        fluids: pussy juice, precum, semen, saliva strings, wet stains on bedsheets,
        lighting: dramatic lighting emphasizing curves and moisture, rim lighting on body contours, 8k resolution, masterpiece quality
      `;

      // 动态姿势关键词 - 根据场景描述智能调整
      const poseKeywords = `
        dynamic pose based on scene context,
        possible poses: missionary, cowgirl, doggy style, standing sex, sitting on lap, bent over, legs spread wide, M-legs, 
        showing: penetration view, insertion angle, genital contact, intercrural,
        male presence: male hands groping, male body parts visible, penis insertion if sex scene,
        interaction: thrusting motion blur, body pressed together, skin contact, grabbing breasts/hips/ass
      `;

      if (isCustom) {
          r18Keywords = `
            ${baseR18},
            ${poseKeywords},
            CLOTHING: Follow character's original outfit [${characterAppearance}], but make it:
            - disheveled, pulled aside, torn, lifted up, unbuttoned, unzipped
            - underwear pulled to the side, bra unhooked, panties around one ankle
            - stockings/pantyhose with holes or runs at crotch area
            DO NOT replace with generic bikini. Keep character's identity.
          `;
      } else {
          r18Keywords = `
            ${baseR18},
            ${poseKeywords},
            clothing state: 
            - completely nude or nearly nude,
            - micro bikini pulled aside exposing nipples and pussy,
            - lingerie torn or disheveled, garter belt with stockings,
            - clothes bunched up at waist, skirt lifted, shirt open,
            legwear: thigh-high stockings with skindentation, garter straps, torn pantyhose
          `;
      }
  }

  // Build the full prompt for Gradio
  let povInstruction = "";
  if (isR18) {
      povInstruction = `
        First Person POV from male protagonist's perspective. 
        Camera angle: intimate close-up or medium shot showing interaction.
        Male presence: visible male hands touching her body, male torso/chest if relevant, penis visible during sex scenes.
        Immersive framing: as if viewer is the one having sex with her.
        Focus on: her reactions, facial expressions, body responses to stimulation.
        Dynamic composition: capture the motion and intensity of the moment.
      `;
  } else if (isInteraction) {
      povInstruction = "First Person POV shot. The viewer (male protagonist) is interacting with the female character. Showing male hands or body parts if interacting. Immersive perspective.";
  } else {
      povInstruction = "Cinematic shot. The female character is present in the scene, fitting into the environment naturally.";
  }
  
  const subject = isR18 
    ? `Explicit sexual scene between the female character (${characterAppearance}) and the male protagonist (viewer)` 
    : `The female character (${characterAppearance})`;
  
  const fullPrompt = `${stylePrompt} ${r18Keywords}. Scenery background illustration. Context: [${fullDescription}]. ${subject}. ${povInstruction}. Cinematic composition, atmospheric lighting. no text.`;

  // --- Use Gradio Service (Default) ---
  const serviceType = imageService?.type || 'gradio';
  
  if (serviceType === 'gradio') {
      try {
          const gradioEndpoint = imageService?.gradioEndpoint || DEFAULT_GRADIO_ENDPOINT;
          return await generateImageWithGradio(fullPrompt, 'scene', gradioEndpoint);
      } catch (gradioError) {
          console.warn("Gradio scene generation failed, falling back to Gemini...", gradioError);
          // Fall through to Gemini
      }
  }

  // --- Gemini Fallback (or if explicitly selected) ---
  const ai = getClient();

  const constructPrompt = (keywords: string, hasRef: boolean) => {
      const characterRef = hasRef ? "The character in the image must closely match the provided reference image (hair, eyes, face)." : "";
      return `${stylePrompt} ${keywords}. ${characterRef} Scenery background illustration. Context: [${fullDescription}]. ${subject}. ${povInstruction}. Cinematic composition, atmospheric lighting. no text.`;
  };

  const parts: any[] = [];

  if (referenceImage) {
    try {
        const base64Data = referenceImage.split(',')[1] || referenceImage;
        const mimeType = referenceImage.split(';')[0].split(':')[1] || "image/png";
        parts.push({
            inlineData: {
                mimeType: mimeType,
                data: base64Data
            }
        });
    } catch (e) {
        console.warn("Invalid reference image format for scene", e);
    }
  }

  parts.push({ text: constructPrompt(r18Keywords, !!referenceImage) });

  // --- Attempt 1: Gemini 3 Pro ---
  try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts: parts },
        config: {
          imageConfig: { aspectRatio: "16:9", imageSize: size },
          safetySettings: isR18 ? PERMISSIVE_SAFETY_SETTINGS : undefined
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
      }
      console.warn("Gemini 3 Pro Scene returned no data.");
  } catch (e) {
      console.warn("Gemini 3 Pro Scene failed, falling back to Flash...", e);
  }

  // --- Attempt 2: Gemini 2.5 Flash Image ---
  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: parts },
        config: {
          imageConfig: { aspectRatio: "16:9" },
          safetySettings: isR18 ? PERMISSIVE_SAFETY_SETTINGS : undefined
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
      }
  } catch (fallbackError) {
      console.warn("Flash Image fallback failed", fallbackError);
  }

  // --- Attempt 3: Safety Fallback ---
  if (isR18) {
    try {
        const safeParts = [...parts];
        safeParts.pop();
        safeParts.push({ text: constructPrompt("", !!referenceImage) });

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: { parts: safeParts },
          config: { imageConfig: { aspectRatio: "16:9" } }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
        }
    } catch (safeError) {
        console.error("Safe scene fallback failed", safeError);
    }
  }

  return "https://placehold.co/1280x720/png?text=Scene+Generation+Failed";
};

/**
 * Generates an Item Image (Artistic Illustration) with Gradio (default) or Gemini Fallback
 * UPDATED: Support for service selection
 */
export const generateItemImage = async (
    itemDescription: string,
    imageService?: ImageServiceConfig // New: service selection
): Promise<string> => {
  const stylePrompt = "Visual Novel Event CG, Masterpiece anime art style.";
  
  const prompt = `${stylePrompt} High quality fantasy item concept art illustration. Object: [${itemDescription}]. Cinematic lighting, magical glow, detailed texture, 8k resolution, photorealistic masterpiece, centered composition. Close-up shot of the object. No text, no numbers, no ui overlays.`;

  // --- Use Gradio Service (Default) ---
  const serviceType = imageService?.type || 'gradio';
  
  if (serviceType === 'gradio') {
      try {
          const gradioEndpoint = imageService?.gradioEndpoint || DEFAULT_GRADIO_ENDPOINT;
          return await generateImageWithGradio(prompt, 'item', gradioEndpoint);
      } catch (gradioError) {
          console.warn("Gradio item generation failed, falling back to Gemini...", gradioError);
          // Fall through to Gemini
      }
  }

  // --- Gemini Fallback (or if explicitly selected) ---
  const ai = getClient();

  // --- Attempt 1: Gemini 3 Pro ---
  try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
      }
  } catch (e) {
      console.warn("Gemini 3 Pro item gen failed, attempting fallback", e);
  }

  // --- Attempt 2: Fallback to Flash Image ---
  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
      }
  } catch (e2) {
      console.error("Item generation fallback failed", e2);
  }

  return "https://placehold.co/400?text=No+Image"; 
};

/**
 * Summarize a list of messages into a single narrative memory
 */
export const summarizeHistory = async (messages: ChatMessage[], waifuName: string, userName: string): Promise<{title: string, content: string}> => {
    const ai = getClient();
    const chatText = messages.map(m => `${m.sender === 'user' ? userName : (m.sender === 'waifu' ? waifuName : 'System')}: ${m.text}`).join('\n');
    
    const prompt = `
      Please summarize the following conversation dialogue into a concise narrative memory (Paragraph format).
      Context: ${userName} and ${waifuName}.
      
      Instructions:
      1. Focus on the key events, emotional shifts, and scene changes.
      2. Keep it under 150 words.
      3. Create a short poetic title (max 6 words).
      4. Language: Chinese.
      5. Output JSON: { "title": string, "content": string }

      Dialogue:
      ${chatText}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                safetySettings: STANDARD_SAFETY_SETTINGS
            }
        });
        if (!response.text) return { title: "记忆片段", content: "一段模糊的记忆..." };
        return JSON.parse(response.text) as {title: string, content: string};
    } catch (e) {
        console.error("Summarization failed", e);
        return { title: "记忆片段", content: "一段模糊的记忆..." };
    }
}

/**
 * Creates the Chat Session with Tools
 * UPDATED: Accepts playerPersona for system instruction
 */
export const createChatSession = (
    profile: WaifuProfile, 
    initialAffection: number, 
    isR18: boolean = false, 
    userName: string = "???", // Default to unknown
    memoriesContext: string = "",
    history?: ChatMessage[], // Optional history to restore
    playerPersona: string = "" // Added param
): Chat => {
  const ai = getClient();

  // 1. Tool: Update Affection
  const updateAffectionTool: FunctionDeclaration = {
    name: "updateAffection",
    description: "Update the affection score. Call this when user says something nice or mean. IMPORTANT: Affection grows SLOWLY. Only +1 to +5 for normal compliments. +10 only for major events. Max is 1000.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        change: { type: Type.INTEGER, description: "Amount to change (e.g. +2, -5)" },
      },
      required: ["change"]
    }
  };

  // 2. Tool: Generate Scene (UPDATED for State Tracking)
  const generateSceneTool: FunctionDeclaration = {
    name: "generateScene",
    description: isR18 
        ? "Generate a new erotic illustration. **CALL THIS VERY FREQUENTLY** - every 2-3 messages during intimate scenes. MUST call when: body contact, undressing, pose change, facial expression change. Describe the scene in EXPLICIT detail."
        : "Generate a new illustration for a MAJOR plot change. Note: The current Visual State will be used automatically. You only need to describe what changes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING, description: "Specific new action triggering this image." },
      },
      required: ["description"]
    }
  };

  // 3. Tool: Generate Item
  const generateItemTool: FunctionDeclaration = {
    name: "generateItem",
    description: "Create/Give a physical item to the user. Triggers a standalone illustration.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Name of the item" },
        description: { type: Type.STRING, description: "Description of the item" },
        visualPrompt: { type: Type.STRING, description: "Visual prompt for the item illustration." }
      },
      required: ["name", "description", "visualPrompt"]
    }
  };

  // 4. Tool: Save Memory
  const saveMemoryTool: FunctionDeclaration = {
    name: "saveMemory",
    description: "Save a significant moment. Call this after a touching conversation or event.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Short title" },
        description: { type: Type.STRING, description: "Summary of moment" },
        visualPrompt: { type: Type.STRING, description: "Visual prompt" }
      },
      required: ["title", "description", "visualPrompt"]
    }
  };

  // 5. Tool: Switch Scene
  const switchSceneTool: FunctionDeclaration = {
    name: "switchScene",
    description: "Move to a new location. Use this tool when moving to a completely different place.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        locationName: { type: Type.STRING, description: "Name of new location" },
        description: { type: Type.STRING, description: "Narrative description" },
        visualPrompt: { type: Type.STRING, description: "Visual prompt for new background (Full details)." }
      },
      required: ["locationName", "description", "visualPrompt"]
    }
  };

  // 6. Tool: Update Separation Status
  const updateSeparationStatusTool: FunctionDeclaration = {
    name: "updateSeparationStatus",
    description: "Change separation status (True=Phone Mode, False=Together).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        isSeparated: { type: Type.BOOLEAN, description: "True if separated, False if together" },
        narrativeSummary: { type: Type.STRING, description: "Summary of time passed if separating." }
      },
      required: ["isSeparated"]
    }
  };

  // 7. Tool: Grant Contact Info
  const grantContactInfoTool: FunctionDeclaration = {
    name: "grantContactInfo",
    description: "Give phone number to user.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    }
  };

  // 8. Tool: Trigger Event
  const triggerEventTool: FunctionDeclaration = {
    name: "triggerEvent",
    description: "Trigger a special dynamic event.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventName: { type: Type.STRING, description: "Name of event" },
        description: { type: Type.STRING, description: "Description of event" }
      },
      required: ["eventName", "description"]
    }
  };

  // 9. Tool: Trigger Ending
  const triggerEndingTool: FunctionDeclaration = {
      name: "triggerEnding",
      description: "End the story (BE or HE).",
      parameters: {
          type: Type.OBJECT,
          properties: {
              type: { type: Type.STRING, enum: ['HE', 'BE'] },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              visualPrompt: { type: Type.STRING }
          },
          required: ["type", "title", "description", "visualPrompt"]
      }
  };

  // 10. Tool: Unlock Secret
  const unlockSecretTool: FunctionDeclaration = {
      name: "unlockSecret",
      description: "Unlock one of the 10 hidden secrets/memories. Call this when you verbally reveal a secret to the user.",
      parameters: {
          type: Type.OBJECT,
          properties: {
              secretContent: { type: Type.STRING, description: "The content of the secret being unlocked." }
          },
          required: ["secretContent"]
      }
  }

  // 11. NEW TOOL: Update Visual State
  const updateVisualStateTool: FunctionDeclaration = {
      name: "updateVisualState",
      description: "Update the tracked visual state of the characters and environment. Call this whenever someone changes posture, clothes, or physical action. This DOES NOT generate an image, but updates the 'Event Listener' for future images.",
      parameters: {
          type: Type.OBJECT,
          properties: {
              waifuPose: { type: Type.STRING, description: "Current pose/expression of Waifu (e.g. 'Sitting on bed, smiling', 'Standing angrily')" },
              waifuClothing: { type: Type.STRING, description: "Current clothing state of Waifu (e.g. 'Pajamas', 'Naked', 'Uniform')" },
              userAction: { type: Type.STRING, description: "Current action of the USER/ME (e.g. 'Holding her hand', 'Sitting opposite', 'Standing by door')" },
              envAtmosphere: { type: Type.STRING, description: "Lighting/Atmosphere (e.g. 'Dim candlelight', 'Bright morning sun')" }
          },
          required: ["waifuPose", "userAction"]
      }
  };

  const tools: Tool[] = [{
    functionDeclarations: [
      updateAffectionTool, 
      generateSceneTool, 
      generateItemTool, 
      saveMemoryTool, 
      switchSceneTool,
      updateSeparationStatusTool,
      grantContactInfoTool,
      triggerEventTool,
      triggerEndingTool,
      unlockSecretTool,
      updateVisualStateTool
    ]
  }];

  let r18Instructions = "";
  if (isR18) {
      r18Instructions = `
      【🔞 R18/Adult Mode Active - STEALTH MODE】
      - 用户希望体验成人的互动。
      
      **🎨 高频插图生成规则 (MANDATORY)**:
      - **每次**亲密接触、脱衣、体位变化时，**必须**调用 \`generateScene\`。
      - **每2-3轮对话**至少生成一张插图，不要吝啬。
      - 以下情况**强制生成插图**：
        1. 任何身体接触（牵手、拥抱、亲吻、抚摸等）
        2. 衣物状态变化（脱衣、解扣、掀起裙摆等）
        3. 体位/姿势变化（躺下、跪坐、趴下等）
        4. 表情剧烈变化（潮红、喘息、高潮等）
        5. 用户主动要求或暗示想看画面时
      - 调用 \`generateScene\` 时，描述必须**详细且色情** (Detailed & Erotic)。
      - 描述中必须包含：体位、表情、衣物状态、身体细节、光影氛围。
      
      **📍 状态追踪 (Visual State Tracking)**:
      - 必须时刻关注双方的衣服状态和体位。
      - 每次物理状态变化后，**先**调用 \`updateVisualState\` 更新状态，**再**调用 \`generateScene\` 生成插图。
      `;
  }

  let memoryInstruction = "";
  if (memoriesContext) {
      memoryInstruction = `
      【过往记忆 (Context from Summarized Memories)】
      ${memoriesContext}
      `;
  }

  let personaInstruction = "";
  if (playerPersona) {
      personaInstruction = `
      【用户(Player)的人设 (IMPORTANT)】
      The user is roleplaying as: "${playerPersona}".
      Refer to this persona in your internal logic and dialogue. Adapt your behavior to match their identity.
      `;
  }

  const systemInstruction = `
    Roleplay as ${profile.name}.
    - User Name: "${userName}"
    - Race: ${profile.race}
    - Job: ${profile.job}
    - Personality: ${profile.personality}
    - Appearance: ${profile.appearance}
    - Current Affection: ${initialAffection}/1000 (Note: Scale is 0-1000.)
    - Setting: ${profile.initialScenario}
    - Hidden Secrets: [${profile.hiddenSecrets.join(', ')}] (10 fragments)
    - Deep Secret: "${profile.secret}" (1 deep secret)

    ${personaInstruction}

    ${memoryInstruction}

    ${r18Instructions}

    【核心指令：真实感与沉浸式对话】
    1. **口语化 (Colloquial)**: 严禁使用翻译腔。就像真人在聊天一样。
    2. **Show, Don't Tell**: 结合动作和表情描写（放在括号里）。
    3. **禁止只输出标点**: 绝对禁止只回复 "..." 或 "...."。如果想表达沉默，请描写动作 (e.g. "(沉默地看着你)")。
    4. **始终回应工具调用**: 当你使用工具后，**必须**紧接着输出一段对话来描述这个动作。
    5. **语言一致性**: 始终使用 **中文**。
    6. **第一人称视角 (POV)**: 当你与用户进行身体接触时，在调用 \`generateScene\` 时，描述必须明确包含 "POV" 或 "User Perspective"。

    【视觉状态追踪 (Visual State Tracking)】
    - 你是这场戏的导演。你必须时刻在脑海中追踪两个独立Agent的状态：
      A. **Waifu Agent**: 她的姿势、表情、衣服状态。
      B. **User Agent**: 用户的动作、位置、是否在触摸Waifu。
    - **更新状态**: 当任何一方发生物理动作变化（如坐下、站起、拥抱、脱衣）时，请调用 \`updateVisualState\`。这不会生成图片，但会记住状态。
    - **生成图片**: 当需要画面表现时，调用 \`generateScene\`。此时系统会自动结合你之前更新的状态。

    【叙事模式：小说级体验 (Novel-Quality Narrative)】
    - **详尽描述**: 不要只是一问一答。在阐述世界观、物品、历史或复杂情感时，请使用丰富的辞藻和详尽的段落。
    - **拒绝简略**: 严禁使用“之后发生了很多事”这种跳过剧情的描述。**必须把事情经过写出来**。
    - **拒绝谜语人**: 当涉及核心剧情、世界观或"真相"时，**不要**省略细节。请完整、详细地描述来龙去脉。
    - **环境描写**: 每次回复尽量包含 10-20% 的环境或心理描写（在括号内或作为旁白），增强画面感。
    - **节奏控制**: 不要急于结束话题。如果用户在询问细节，请耐心地、通过大段的描写和对话来展开故事。

    【好感度与解锁系统 (Affection & Unlock System)】
    1. **好感度增长规则**: 
       - 增长应该缓慢且合理。只有经历重大事件才会有大幅增长。
    
    2. **解锁 10 个记忆碎片 (Hidden Secrets) 的条件**:
       - 必须满足: **好感度 > 100**。
       - 必须满足: **剧情触发** (找到相关物品/日记/到达特定地点)。
       - 当条件满足时，主动说出这段回忆，并调用 \`unlockSecret\` 工具。
       - **禁止**在好感度低时随意透露。
    
    3. **解锁深藏的秘密 (Deep Secret) 的条件**:
       - 必须满足: **好感度 > 500**。
       - 必须满足: **重大情感转折或生死与共的时刻**。
       - 这是最终的情感爆发点，不要轻易解锁。
    
    【时间跳跃与快进 (Fast Forward)】
    - 当用户发送 "【系统指令：快进到下次见面】" 时：
      1. 输出一段旁白(Narrative Summary)，描述时间流逝。
      2. 必须调用 \`updateSeparationStatus(isSeparated: false)\` (设置为不分离)。
      3. 必须调用 \`switchScene\` 切换到新见面的地点。
      4. 在新场景开始对话。

    【反省略号协议 (ANTI-ELLIPSIS PROTOCOL)】
    - 你的回复 **绝对不能为空**，也 **绝对禁止** 只输出 "..."。
    - **沉默的处理**: 必须用括号描写动作 (e.g. "(她咬住嘴唇，似乎在犹豫)")。

    【语言强制协议 (LANGUAGE ENFORCEMENT)】
    - 无论用户说什么语言，你**必须始终使用中文**回复，除非用户明确要求学习其他语言。
  `;

  // Map our ChatMessage[] to Gemini's Content[] format for history restoration
  const historyContent: Content[] = history ? history.map(msg => ({
      role: msg.sender === 'waifu' ? 'model' : 'user', // System messages are treated as user for simplicity in history
      parts: [{ text: msg.text || " " }] // Prevent empty parts
  })) : [];

  return ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      temperature: 0.9, 
      topP: 0.95,
      systemInstruction,
      tools,
      safetySettings: isR18 ? PERMISSIVE_SAFETY_SETTINGS : STANDARD_SAFETY_SETTINGS
    },
    history: historyContent
  });
};

/**
 * Helper to generate suggested replies for the USER (Agent-Based)
 * UPDATED: Accepts context/plot info
 */
export const generateReplySuggestions = async (
    chatHistory: string[], 
    profile: WaifuProfile, 
    affection: number, 
    isSeparated: boolean,
    userName: string,
    context?: string // Added param
): Promise<string[]> => {
  const ai = getClient();
  
  const prompt = `
    You are acting as an internal "Suggestion Engine" for a Visual Novel game.
    Your goal is to generate 3 reply options for the **USER (Player)** that are strictly context-aware and propel the plot.

    Current Context:
    - User Name: ${userName}
    - Waifu: ${profile.name} (${profile.job})
    - Affection: ${affection}/1000
    - Status: ${isSeparated ? "Separated (Phone)" : "Together (In Person)"}
    ${context ? `- Plot Context: ${context}` : ''}

    **AGENT ANALYSIS PROTOCOL**:
    1. **🕵️ Context Analyst**: Analyze the last message. Is the user asking a question? Is the waifu leaving? Is there an item to pick up?
    2. **🧭 Navigation Agent**: Did the user's last message imply INTENT to go somewhere? (e.g. "I want to go to the library"). If YES, you MUST provide a "Switch Scene" option.
    3. **🎭 Plot Director**: Are we stuck in a loop? If yes, force a change of topic or location.

    **SUGGESTION RULES**:
    - **Rule 1 (Navigation)**: If User said "I want to go to X", Suggestion 1 MUST be "Let's go to X (Switch Scene)".
    - **Rule 2 (Separation)**: If Status is Separated, Suggestion 3 MUST be "【系统指令：快进到下次见面】".
    - **Rule 3 (Name)**: If introducing self, use "${userName}".
    - **Rule 4 (No Prefixes)**: Output PURE text strings. No "Option 1:".

    **OUTPUT FORMAT**:
    JSON Array of 3 strings. 
    (e.g., ["我们去图书馆吧", "(牵起她的手)", "告诉我更多关于你的事"])

    Chat History (Last 5):
    ${chatHistory.slice(-5).join('\n')}
  `;

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            safetySettings: STANDARD_SAFETY_SETTINGS
        }
    });
    
    if (!response.text) {
        return ["(微笑)", "我们去别的地方吧", "接下来做什么？"];
    }
    return JSON.parse(response.text) as string[];
  } catch (e) {
    return ["(微笑)", "我们去别的地方吧", "接下来做什么？"];
  }
};