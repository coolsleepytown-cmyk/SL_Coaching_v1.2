import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, DevelopmentLevel, Scenario, Message, SessionRecord, TeamAnalysisResult } from "../types";

// Helper to safely get the AI client
const getAIClient = () => {
  // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
  // Assume this variable is pre-configured, valid, and accessible.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const modelFlash = 'gemini-2.5-flash';
// Pro model reserved for complex creative tasks if needed, but Flash is used for analysis for speed
const modelPro = 'gemini-3-pro-preview';

// Retry wrapper for API calls to handle 503/429 errors
// INCREASED RETRIES and DELAY for stability
const callWithRetry = async <T>(
  operation: () => Promise<T>, 
  retries = 5, 
  delay = 2000
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const msg = error.message || JSON.stringify(error);
    const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('Overloaded') || msg.includes('UNAVAILABLE');
    
    if (retries > 0 && isTransient) {
      // Exponential backoff with jitter to prevent thundering herd
      const actualDelay = delay * (1 + Math.random() * 0.5); 
      console.warn(`API Busy (503/429). Retrying in ${Math.round(actualDelay)}ms... attempts left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, actualDelay));
      return callWithRetry(operation, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Helper to get SLII description text
const getSLIIDefinitions = () => `
Context: Ken Blanchard's Situational Leadership II (SLII).
- D1 (Enthusiastic Beginner): Low Competence, High Commitment. Needs S1 (Directing).
- D2 (Disillusioned Learner): Low/Some Competence, Low Commitment. Needs S2 (Coaching).
- D3 (Capable but Cautious): Mod/High Competence, Variable Commitment. Needs S3 (Supporting).
- D4 (Self-Reliant Achiever): High Competence, High Commitment. Needs S4 (Delegating).

Styles:
- S1 (Directing): High Directive, Low Supportive. Define roles, give specific instructions.
- S2 (Coaching): High Directive, High Supportive. Explain decisions, solicit suggestions, support progress.
- S3 (Supporting): Low Directive, High Supportive. Facilitate, listen, encourage, share responsibility for decision-making.
- S4 (Delegating): Low Directive, Low Supportive. Turn over responsibility for decisions and implementation.
`;

// Helper to strip markdown code blocks if present
const cleanJsonString = (text: string): string => {
  if (!text) return "[]";
  // Remove ```json and ``` or just ```
  let clean = text.replace(/```json/g, "").replace(/```/g, "");
  return clean.trim();
};

// Data pools for Dynamic Fallback Generation
const FALLBACK_DATA = {
  names: ["김지민", "이민수", "박현우", "최수진", "정다운", "강하늘", "송민호", "윤서연", "임재범", "한소희"],
  roles: ["마케팅 인턴", "백엔드 개발자", "UI 디자이너", "영업 과장", "기획 팀장", "HR 매니저", "데이터 분석가", "품질 관리자", "고객 지원", "재무 담당"],
  situations: [
    "새로운 프로젝트를 시작하는 상황",
    "업무 프로세스가 갑자기 변경된 상황",
    "중요한 발표를 앞두고 있는 상황",
    "반복적인 업무에 지쳐있는 상황",
    "동료와의 갈등으로 스트레스를 받는 상황",
    "승진 누락으로 의욕이 저하된 상황",
    "새로운 툴 도입으로 혼란스러운 상황"
  ]
};

// Generate randomized fallback scenarios so the "Refresh" button always produces new content
// even if the API is failing or missing.
const generateDynamicFallbackScenarios = (timestamp: number): Scenario[] => {
  const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  
  return [
    {
      id: `fallback-d1-${timestamp}`,
      title: "열정적인 신입의 도전 (D1)",
      description: `${getRandom(FALLBACK_DATA.situations)}. ${DevelopmentLevel.D1} 단계로, 의욕은 넘치지만 구체적인 방법은 모릅니다.`,
      employeeName: getRandom(FALLBACK_DATA.names),
      employeeRole: getRandom(FALLBACK_DATA.roles),
      developmentLevel: DevelopmentLevel.D1,
      initialMessage: "팀장님! 저 이번 일 정말 잘해보고 싶습니다! 아이디어는 많은데... 구체적으로 뭐부터 시작하면 좋을까요?"
    },
    {
      id: `fallback-d2-${timestamp}`,
      title: "혼란스러운 실무자 (D2)",
      description: `${getRandom(FALLBACK_DATA.situations)}. ${DevelopmentLevel.D2} 단계로, 초기 기대와 달리 업무가 어려워 좌절감을 느끼고 있습니다.`,
      employeeName: getRandom(FALLBACK_DATA.names),
      employeeRole: getRandom(FALLBACK_DATA.roles),
      developmentLevel: DevelopmentLevel.D2,
      initialMessage: "팀장님, 열심히 하려고 했는데 자꾸 계획이 바뀌니까... 솔직히 어떻게 해야 할지 모르겠고 좀 지치네요."
    },
    {
      id: `fallback-d3-${timestamp}`,
      title: "신중한 전문가 (D3)",
      description: `${getRandom(FALLBACK_DATA.situations)}. ${DevelopmentLevel.D3} 단계로, 역량은 충분하지만 자신감이 부족하거나 실수를 두려워합니다.`,
      employeeName: getRandom(FALLBACK_DATA.names),
      employeeRole: getRandom(FALLBACK_DATA.roles),
      developmentLevel: DevelopmentLevel.D3,
      initialMessage: "제가 이걸 맡아도 될까요? 지난번처럼 혹시라도 실수할까 봐... 좀 더 검토가 필요할 것 같습니다."
    },
    {
      id: `fallback-d4-${timestamp}`,
      title: "독립적인 에이스 (D4)",
      description: `${getRandom(FALLBACK_DATA.situations)}. ${DevelopmentLevel.D4} 단계로, 해당 업무에 통달해 있으며 자율적인 권한을 원합니다.`,
      employeeName: getRandom(FALLBACK_DATA.names),
      employeeRole: getRandom(FALLBACK_DATA.roles),
      developmentLevel: DevelopmentLevel.D4,
      initialMessage: "팀장님, 이번 건은 제가 알아서 진행하겠습니다. 결과만 나중에 보고드릴 테니 믿고 맡겨주십시오."
    }
  ];
};

// Robust Safety Settings using Enums
const commonSafetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const generateScenarios = async (industry?: string, role?: string): Promise<Scenario[]> => {
  const domains = ['IT Startup', 'Manufacturing', 'Hospital', 'Sales Team', 'Design Agency', 'Bank', 'Retail'];
  // Use provided industry or pick random if not provided
  const targetIndustry = industry?.trim() ? industry : domains[Math.floor(Math.random() * domains.length)];
  const targetRoleInstruction = role?.trim() ? `Job Role focus: ${role}.` : 'Various job roles.';
  
  const timestamp = Date.now();

  const systemInstruction = `
    You are a corporate leadership trainer. Generate 4 distinct workplace scenarios for a manager to practice Situational Leadership.
    Each scenario must feature a subordinate at a different Development Level (D1, D2, D3, and D4).
    Industry Context: ${targetIndustry}.
    ${targetRoleInstruction}
    The output must be in Korean.
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING, description: "Detailed context of the situation." },
        employeeName: { type: Type.STRING },
        employeeRole: { type: Type.STRING },
        developmentLevel: { type: Type.STRING, enum: ["D1", "D2", "D3", "D4"] },
        initialMessage: { type: Type.STRING, description: "The first thing the employee says to the leader (a question, complaint, or status update)." }
      },
      required: ["id", "title", "description", "employeeName", "employeeRole", "developmentLevel", "initialMessage"]
    }
  };

  try {
    const ai = getAIClient();
    const prompt = `Generate exactly 4 diverse leadership scenarios (D1, D2, D3, D4) in Korean. 
                    Industry: ${targetIndustry}. 
                    ${role ? `Role: ${role}` : ''}
                    Random seed: ${timestamp}`;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelFlash,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.9,
      }
    }));

    const text = cleanJsonString(response.text || "");
    if (!text) throw new Error("No response from Gemini");
    
    let scenarios = JSON.parse(text) as Scenario[];
    
    if (!Array.isArray(scenarios)) {
      scenarios = [];
    }

    // Fallback Logic: Ensure exactly 4 items
    if (scenarios.length < 4) {
      console.warn(`API returned ${scenarios.length} scenarios. Filling from fallback.`);
      const fallback = generateDynamicFallbackScenarios(timestamp);
      // Merge distinct levels if possible
      const existingLevels = new Set(scenarios.map(s => s.developmentLevel));
      
      for (const fbItem of fallback) {
        if (scenarios.length >= 4) break;
        if (!existingLevels.has(fbItem.developmentLevel)) {
          scenarios.push({ ...fbItem, id: `gen-${timestamp}-${scenarios.length}` });
          existingLevels.add(fbItem.developmentLevel);
        }
      }
      // If still < 4, just fill sequentially
      let i = 0;
      while (scenarios.length < 4) {
         scenarios.push({ ...fallback[i], id: `fill-${timestamp}-${i}` });
         i = (i + 1) % 4;
      }
    }

    return scenarios;
  } catch (error) {
    console.error("Error generating scenarios:", error);
    // Return dynamic fallback scenarios so the user sees new content even if API fails
    return generateDynamicFallbackScenarios(timestamp);
  }
};

export const getEmployeeResponse = async (
  scenario: Scenario,
  history: Message[]
): Promise<string> => {
  const systemInstruction = `
    You are roleplaying as ${scenario.employeeName}, a ${scenario.employeeRole} at development level ${scenario.developmentLevel}.
    
    Context: ${scenario.description}
    
    Your Traits based on ${scenario.developmentLevel}:
    - D1: Enthusiastic but inexperienced. Needs direction.
    - D2: Frustrated or overwhelmed. Needs coaching and encouragement.
    - D3: Capable but cautious/insecure. Needs support and listening.
    - D4: Confident and expert. Needs autonomy.

    Respond to the manager (User) naturally in Korean. Keep responses concise (under 3 sentences).
    Stay in character. If the manager gives bad leadership (e.g., micromanaging a D4), show annoyance or disengagement.
    If the manager uses the right style, react positively.
  `;

  // CLEANUP: Filter empty messages AND previous error messages to prevent pollution
  const validHistory = history.filter(msg => 
    msg.text && 
    msg.text.trim() !== '' && 
    !msg.text.includes("시스템 오류") && 
    !msg.text.includes('{"error"')
  );

  // Convert history to Gemini format
  let contents = validHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  // Ensure the conversation starts with a User turn for the API
  if (contents.length === 0 || contents[0].role === 'model') {
    contents = [
      { role: 'user', parts: [{ text: "상황극을 시작합니다. (Start Roleplay)" }] },
      ...contents
    ];
  }

  try {
    const ai = getAIClient();
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelFlash,
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        safetySettings: commonSafetySettings,
      }
    }));
    return response.text || "...";
  } catch (error: any) {
    console.error("Error in chat loop:", error);
    
    // Parse error for better UI
    const errorMsg = error.message || JSON.stringify(error);
    
    if (errorMsg.includes("429") || errorMsg.includes("503") || errorMsg.includes("Overloaded")) {
      return "시스템 오류: 사용량이 많아 잠시 지연되고 있습니다. 5초 뒤에 다시 시도해주세요.";
    }
    
    // Return a clean error message, NOT the raw JSON
    return "시스템 오류가 발생했습니다. 잠시 후 다시 말씀해 주세요.";
  }
};

export const analyzeFullSession = async (
  scenario: Scenario,
  messages: Message[]
): Promise<AnalysisResult> => {
  const systemInstruction = `
    You are a master Situational Leadership coach.
    Analyze the ENTIRE transcript between a Manager (User) and an Employee (${scenario.developmentLevel}).
    
    ${getSLIIDefinitions()}
    
    The Subordinate is level: ${scenario.developmentLevel}.
    
    Task:
    1. Identify the Manager's leadership style distribution (S1, S2, S3, S4). 
       Estimate the percentage of time each style was used (Must sum to 100%).
    2. Identify the top 2 styles based on the distribution.
    3. Score the effectiveness (0-100).
    4. Provide specific feedback for key turns in the conversation.
    5. Create a concrete Action Plan (Mission) for the manager to improve.
    
    Output in Korean.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      leaderStyleIdentified: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING, enum: ["S1", "S2", "S3", "S4"] },
        description: "The two most dominant leadership styles used by the manager."
      },
      styleScore: {
        type: Type.OBJECT,
        description: "Percentage distribution of styles used. Sum must be 100.",
        properties: {
          S1: { type: Type.INTEGER },
          S2: { type: Type.INTEGER },
          S3: { type: Type.INTEGER },
          S4: { type: Type.INTEGER }
        },
        required: ["S1", "S2", "S3", "S4"]
      },
      isMatch: { type: Type.BOOLEAN },
      score: { type: Type.INTEGER },
      summaryFeedback: { type: Type.STRING, description: "Overall summary of the session." },
      turnByTurnAnalysis: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            userMessageSnippet: { type: Type.STRING },
            critique: { type: Type.STRING },
            betterAlternative: { type: Type.STRING }
          }
        }
      },
      actionPlan: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            task: { type: Type.STRING, description: "Specific practice task" },
            deadline: { type: Type.STRING },
            metric: { type: Type.STRING, description: "How to verify completion" }
          }
        }
      }
    },
    required: ["leaderStyleIdentified", "styleScore", "isMatch", "score", "summaryFeedback", "turnByTurnAnalysis", "actionPlan"]
  };

  // CLEANUP: Filter out error messages from transcript analysis
  const cleanMessages = messages.filter(m => !m.text.includes("시스템 오류"));
  const transcript = cleanMessages.map(m => `${m.role === 'user' ? 'Manager' : 'Employee'}: ${m.text}`).join('\n');

  try {
    const ai = getAIClient();
    // CHANGED: Use modelFlash instead of modelPro for significantly faster analysis
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelFlash,
      contents: `
        Scenario: ${scenario.description}
        Employee: ${scenario.employeeName} (${scenario.developmentLevel})
        
        TRANSCRIPT:
        ${transcript}
        
        Analyze the manager's performance.
      `,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1, // Lower temperature for faster, deterministic output
        safetySettings: commonSafetySettings,
      }
    }));

    const text = cleanJsonString(response.text || "");
    if (!text) throw new Error("No analysis from Gemini (Empty Response)");
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Error analyzing session:", error);
    throw error;
  }
};

export const generateTeamAnalysis = async (records: SessionRecord[]): Promise<TeamAnalysisResult> => {
  if (records.length === 0) throw new Error("No records to analyze");

  const systemInstruction = `
    You are an HR Executive Coach. Analyze the aggregated performance data of a leadership team practicing Situational Leadership II.
    
    Data Provided: A list of session summaries including 'styleScore' (percentage of styles used in each session).
    
    Task:
    1. Summarize the team's overall leadership capability.
    2. Calculate the **AVERAGE** usage percentage of each style (S1, S2, S3, S4) across the entire team based on the provided styleScores.
    3. Provide executive recommendations.
    
    Output in Korean.
  `;

  // Safely map records, ensuring styleUsed is always an array for the LLM
  const simplifiedData = records.map(r => {
    // Legacy support: if styleScore missing, estimate from identified styles
    let stylesObj = r.result.styleScore;
    if (!stylesObj) {
      const identified = Array.isArray(r.result.leaderStyleIdentified) 
        ? r.result.leaderStyleIdentified 
        : [r.result.leaderStyleIdentified as string];
      
      // Rough estimation for legacy data
      stylesObj = { S1: 0, S2: 0, S3: 0, S4: 0 };
      const weight = Math.floor(100 / identified.length);
      identified.forEach(s => {
        if (s in stylesObj!) (stylesObj as any)[s] = weight;
      });
    }

    return {
      user: r.userName,
      scenario: r.scenarioTitle,
      score: r.result.score,
      styleDistribution: stylesObj, // Pass the percentage object
      feedback: r.result.summaryFeedback.substring(0, 100) + "..."
    };
  });

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      overallScore: { type: Type.INTEGER, description: "Average score of the team" },
      participantCount: { type: Type.INTEGER },
      styleDistribution: { 
        type: Type.OBJECT, 
        description: "The AVERAGE percentage of each style used across the team. (e.g., S1: 15, S2: 40...)",
        properties: {
          S1: { type: Type.INTEGER },
          S2: { type: Type.INTEGER },
          S3: { type: Type.INTEGER },
          S4: { type: Type.INTEGER }
        }
      },
      keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      commonWeaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
      trainingRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      executiveSummary: { type: Type.STRING, description: "Comprehensive paragraph summarising the team's state." }
    },
    required: ["overallScore", "participantCount", "styleDistribution", "keyStrengths", "commonWeaknesses", "trainingRecommendations", "executiveSummary"]
  };

  try {
    const ai = getAIClient();
    // CHANGED: Use modelFlash instead of modelPro for faster dashboard reporting
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelFlash,
      contents: `Analyze this team data:\n${JSON.stringify(simplifiedData, null, 2)}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1 // Lower temperature for speed
      }
    }));

    const text = cleanJsonString(response.text || "");
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as TeamAnalysisResult;
  } catch (error) {
    console.error("Error generating team report:", error);
    throw error;
  }
};