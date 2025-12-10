import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, DevelopmentLevel, Scenario, Message, SessionRecord, TeamAnalysisResult } from "../types";

// Helper to safely get the AI client
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const modelFlash = 'gemini-2.5-flash';

// Retry wrapper for API calls to handle 503/429 errors
const callWithRetry = async <T>(
  operation: () => Promise<T>, 
  retries = 5, 
  delay = 2000
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const msg = (error.message || JSON.stringify(error)).toLowerCase();
    const isTransient = 
      msg.includes('503') || 
      msg.includes('429') || 
      msg.includes('overloaded') || 
      msg.includes('unavailable') || 
      msg.includes('resource exhausted') ||
      msg.includes('quota') ||
      msg.includes('internal error');
    
    if (retries > 0 && isTransient) {
      const actualDelay = delay * (1 + Math.random() * 0.5); 
      console.warn(`API Busy (Status: ${msg}). Retrying in ${Math.round(actualDelay)}ms... attempts left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, actualDelay));
      return callWithRetry(operation, retries - 1, Math.min(delay * 1.5, 10000));
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

const commonSafetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const generateScenarios = async (industry?: string, role?: string): Promise<Scenario[]> => {
  const domains = ['IT Startup', 'Manufacturing', 'Hospital', 'Sales Team', 'Design Agency', 'Bank', 'Retail'];
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
    }), 3, 2000);

    const text = cleanJsonString(response.text || "");
    if (!text) throw new Error("No response from Gemini");
    
    let scenarios = JSON.parse(text) as Scenario[];
    
    if (!Array.isArray(scenarios)) {
      scenarios = [];
    }

    if (scenarios.length < 4) {
      console.warn(`API returned ${scenarios.length} scenarios. Filling from fallback.`);
      const fallback = generateDynamicFallbackScenarios(timestamp);
      const existingLevels = new Set(scenarios.map(s => s.developmentLevel));
      
      for (const fbItem of fallback) {
        if (scenarios.length >= 4) break;
        if (!existingLevels.has(fbItem.developmentLevel)) {
          scenarios.push({ ...fbItem, id: `gen-${timestamp}-${scenarios.length}` });
          existingLevels.add(fbItem.developmentLevel);
        }
      }
      let i = 0;
      while (scenarios.length < 4) {
         scenarios.push({ ...fallback[i], id: `fill-${timestamp}-${i}` });
         i = (i + 1) % 4;
      }
    }

    return scenarios;
  } catch (error) {
    console.error("Error generating scenarios:", error);
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
    Stay in character.
  `;

  const validHistory = history.filter(msg => 
    msg.text && 
    msg.text.trim() !== '' && 
    !msg.text.includes("시스템 오류") && 
    !msg.text.includes('{"error"')
  );

  let contents = validHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

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
    }), 8, 3000);

    return response.text || "...";
  } catch (error: any) {
    console.error("Error in chat loop:", error);
    const msg = error.message || String(error);
    if (msg.includes("429") || msg.includes("503") || msg.includes("quota")) {
       return "시스템 오류: 사용량이 많아 잠시 지연되고 있습니다. 5초 뒤에 다시 시도해주세요.";
    }
    return "시스템 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
};

export const analyzeFullSession = async (
  scenario: Scenario,
  history: Message[]
): Promise<AnalysisResult> => {
  const systemInstruction = `
    You are an expert SLII Leadership Assessor. 
    Analyze the conversation between a Manager (User) and an Employee (AI).
    
    Employee Context:
    - Name: ${scenario.employeeName}
    - Level: ${scenario.developmentLevel}
    - Needs: ${getSLIIDefinitions()}

    Your Task:
    1. Identify the user's PRIMARY and SECONDARY leadership styles used (S1, S2, S3, S4).
    2. Estimate the percentage distribution of each style used (must sum to 100%).
    3. Determine if the style matched the employee's development level.
    4. Provide a score (0-100).
    5. Give specific actionable feedback and an action plan.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      leaderStyleIdentified: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "The top 2 leadership styles used (e.g. ['S1', 'S2'])" 
      },
      styleScore: {
        type: Type.OBJECT,
        properties: {
          S1: { type: Type.NUMBER },
          S2: { type: Type.NUMBER },
          S3: { type: Type.NUMBER },
          S4: { type: Type.NUMBER }
        },
        required: ["S1", "S2", "S3", "S4"]
      },
      isMatch: { type: Type.BOOLEAN },
      score: { type: Type.NUMBER },
      summaryFeedback: { type: Type.STRING },
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
            task: { type: Type.STRING },
            deadline: { type: Type.STRING },
            metric: { type: Type.STRING }
          }
        }
      }
    },
    required: ["leaderStyleIdentified", "styleScore", "isMatch", "score", "summaryFeedback", "turnByTurnAnalysis", "actionPlan"]
  };

  const conversationText = history
    .map(m => `${m.role === 'user' ? 'Manager' : 'Employee'}: ${m.text}`)
    .join("\n");

  try {
    const ai = getAIClient();
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelFlash,
      contents: `Analyze this roleplay session:\n${conversationText}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1, // Low temp for consistent analysis
      }
    }), 5, 2000);

    const text = cleanJsonString(response.text || "");
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Analysis Error:", error);
    // Return a dummy result to prevent crash
    return {
      leaderStyleIdentified: ["Unknown"],
      styleScore: { S1: 25, S2: 25, S3: 25, S4: 25 },
      isMatch: false,
      score: 0,
      summaryFeedback: "분석 중 시스템 오류가 발생했습니다. 다시 시도해 주세요.",
      turnByTurnAnalysis: [],
      actionPlan: []
    };
  }
};

export const generateTeamAnalysis = async (records: SessionRecord[]): Promise<TeamAnalysisResult> => {
  if (records.length === 0) {
    throw new Error("No records to analyze");
  }

  // Pre-calculate stats to help the AI
  const totalScore = records.reduce((acc, r) => acc + r.score, 0);
  const avgScore = Math.round(totalScore / records.length);
  
  // Aggregate style scores
  const totalStyles = { S1: 0, S2: 0, S3: 0, S4: 0 };
  let count = 0;
  
  records.forEach(r => {
    if (r.result.styleScore) {
      totalStyles.S1 += r.result.styleScore.S1 || 0;
      totalStyles.S2 += r.result.styleScore.S2 || 0;
      totalStyles.S3 += r.result.styleScore.S3 || 0;
      totalStyles.S4 += r.result.styleScore.S4 || 0;
      count++;
    } else {
      // Legacy support: if styleScore missing, infer from leaderStyleIdentified
      const styles = Array.isArray(r.result.leaderStyleIdentified) 
        ? r.result.leaderStyleIdentified 
        : [r.result.leaderStyleIdentified];
      styles.forEach(s => {
        if (s === 'S1') totalStyles.S1 += 100;
        if (s === 'S2') totalStyles.S2 += 100;
        if (s === 'S3') totalStyles.S3 += 100;
        if (s === 'S4') totalStyles.S4 += 100;
      });
      count++;
    }
  });

  // Calculate average percentage
  const styleDistribution = {
    S1: count ? Math.round(totalStyles.S1 / count) : 0,
    S2: count ? Math.round(totalStyles.S2 / count) : 0,
    S3: count ? Math.round(totalStyles.S3 / count) : 0,
    S4: count ? Math.round(totalStyles.S4 / count) : 0
  };

  const systemInstruction = `
    You are an HR Analytics Expert. Analyze the aggregate coaching data of a team.
    
    Data Summary:
    - Participants: ${records.length}
    - Average Score: ${avgScore}
    - Style Distribution (Average Usage %): ${JSON.stringify(styleDistribution)}
    
    Task:
    1. Write an Executive Summary of the team's leadership capability.
    2. Identify Key Strengths (3 bullet points).
    3. Identify Common Weaknesses/Blind spots (3 bullet points).
    4. Recommend Training Actions.
    
    Output in Korean.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      overallScore: { type: Type.NUMBER },
      participantCount: { type: Type.NUMBER },
      styleDistribution: {
        type: Type.OBJECT,
        properties: {
          S1: { type: Type.NUMBER },
          S2: { type: Type.NUMBER },
          S3: { type: Type.NUMBER },
          S4: { type: Type.NUMBER }
        }
      },
      keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      commonWeaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
      trainingRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      executiveSummary: { type: Type.STRING }
    },
    required: ["executiveSummary", "keyStrengths", "commonWeaknesses", "trainingRecommendations"]
  };

  try {
    const ai = getAIClient();
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelFlash,
      contents: "Generate Team Analysis Report based on the provided summary data.",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
      }
    }), 3, 3000);

    const text = cleanJsonString(response.text || "");
    const aiResult = JSON.parse(text);

    // Merge AI insights with hard calculations
    return {
      ...aiResult,
      overallScore: avgScore,
      participantCount: records.length,
      styleDistribution: styleDistribution
    };
  } catch (error) {
    console.error("Team Analysis Error:", error);
    throw error;
  }
};
