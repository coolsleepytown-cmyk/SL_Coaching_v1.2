

export enum AppState {
  INTRO = 'INTRO',
  DASHBOARD = 'DASHBOARD',
  SCENARIO_SELECTION = 'SCENARIO_SELECTION',
  ROLEPLAY = 'ROLEPLAY',
  ANALYSIS = 'ANALYSIS',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
}

export enum DevelopmentLevel {
  D1 = 'D1', // Low Competence, High Commitment (Enthusiastic Beginner)
  D2 = 'D2', // Low/Some Competence, Low Commitment (Disillusioned Learner)
  D3 = 'D3', // Mod/High Competence, Variable Commitment (Capable but Cautious)
  D4 = 'D4', // High Competence, High Commitment (Self-Reliant Achiever)
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  employeeName: string;
  employeeRole: string;
  developmentLevel: DevelopmentLevel;
  initialMessage: string; // The opening line from the follower
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
}

export interface TurnFeedback {
  userMessageSnippet: string;
  critique: string;
  betterAlternative: string;
}

export interface ActionItem {
  task: string;
  deadline: string; // e.g. "Within 1 week"
  metric: string; // How to measure success
}

export interface AnalysisResult {
  // Changed to array to support Primary/Secondary styles. 
  // Backward compatibility note: Old records might have this as a string at runtime.
  leaderStyleIdentified: string[]; 
  
  // New: Percentage distribution of styles (e.g., S1: 20, S2: 50...)
  styleScore?: {
    S1: number;
    S2: number;
    S3: number;
    S4: number;
  };

  isMatch: boolean;
  score: number;
  summaryFeedback: string;
  turnByTurnAnalysis: TurnFeedback[];
  actionPlan: ActionItem[];
}

export interface SessionRecord {
  id: string;
  userName: string;
  companyName?: string; // Added company name field
  scenarioTitle: string;
  date: string;
  score: number;
  isDeleted: boolean; // For trash management
  result: AnalysisResult; // Store full result for review
  
  // Extended details for dashboard view
  employeeName?: string;
  employeeRole?: string;
  developmentLevel?: DevelopmentLevel;
}

export interface TeamAnalysisResult {
  overallScore: number;
  participantCount: number;
  styleDistribution: Record<string, number>;
  keyStrengths: string[];
  commonWeaknesses: string[];
  trainingRecommendations: string[];
  executiveSummary: string;
}

declare global {
  interface Window {
    html2pdf: any;
  }
}