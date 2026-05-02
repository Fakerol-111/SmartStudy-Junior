export interface TutorConfig {
  subject: string;
  studentName: string;
  weakPoints?: string[];
  strengths?: string[];
  extraInstructions?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_name?: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ChatRequest {
  message: string;
  conversationHistory: Message[];
  subject?: string;
  studentName?: string;
  weakPoints?: string[];
}

// ── Router ─────────────────────────────────────────────────
export type Intent =
  | 'teach'
  | 'verify'
  | 'concept'
  | 'review'
  | 'correct'
  | 'feedback'
  | 'unknown';

export interface RouterResult {
  intent: Intent;
  subjects: string[];
  newTopic: boolean;
  targetHandler: string;
  confidence: number;
}

// ── Handler ────────────────────────────────────────────────
export interface HandlerContext {
  intent: Intent;
  subjects: string[];
  studentName: string;
  history: Message[];
  subject: string;
  studentProfile?: string;
  teacherSoul?: string;
  /** True when the user is continuing the same topic (follow-up, same intent) */
  isContinuation?: boolean;
}

export interface IHandler {
  readonly name: string;
  execute(context: HandlerContext): AsyncGenerator<HarnessEvent>;
}

// ── Reviewer ───────────────────────────────────────────────
export interface ReviewResult {
  passed: boolean;
  issues: string[];
  suggestion?: string;
  upgradeRequired?: boolean;
}

// ── Harness Events ─────────────────────────────────────────
export type HarnessStage =
  | 'router'
  | 'generate'
  | 'review'
  | 'teach'
  | 'verify'
  | 'concept'
  | 'review_handler'
  | 'correct'
  | 'feedback'
  | 'unknown'
  | 'save'
  | 'done'
  | 'idle';

export interface ProgressEvent {
  type: 'progress';
  stage: HarnessStage;
  message: string;
  intent?: Intent;
  subjects?: string[];
}

export type HarnessEvent =
  | { type: 'delta'; content: string }
  | { type: 'error'; detail: string }
  | { type: 'tool_call'; tool_name: string; arguments: string }
  | { type: 'tool_result'; tool_name: string; result: string }
  | { type: 'thinking_done' }
  | { type: 'done'; history: Message[] }
  | { type: 'cancelled' }
  | ProgressEvent;

// ── Memory / Profile / Soul ────────────────────────────────
export interface StudentProfileData {
  description: string;
  scores: Record<string, number>;
  weakPoints: string[];
  strengths: string[];
  updatedAt: string;
}

export interface TeacherSoulData {
  teachingStyle: string;
  communicationPreference: string;
  emotionalStrategy: string;
  dimensions: Record<string, number>;
  updatedAt: string;
}

export interface KnowledgeNodeData {
  id?: number;
  student_id: number;
  subject: string;
  node_name: string;
  mastery_level: number;
  parent_id?: number;
  updated_at?: string;
}

export interface MistakeRecordData {
  id?: number;
  student_id: number;
  subject: string;
  question: string;
  correct_answer?: string;
  student_answer?: string;
  analysis?: string;
  knowledge_points?: string;
  mistake_type?: string;
  created_at?: string;
}

export interface BlacklistEntryData {
  id?: number;
  student_id: number;
  knowledge_point: string;
  subject: string;
  created_at?: string;
}

// ── Model Config ───────────────────────────────────────────
export interface ModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ModelTier {
  fast: ModelConfig;
  flagship?: ModelConfig;
}

/** Model tier: fast (default) + optional flagship upgrade */
export interface TieredModelConfig {
  fast: DeepSeekConfig;
  flagship?: DeepSeekConfig;
}

/** Separate model configs for each Harness component, each with fast/flagship tiers */
export interface HarnessModelConfig {
  handler: TieredModelConfig;
  router: TieredModelConfig;
  reviewer: TieredModelConfig;
}
