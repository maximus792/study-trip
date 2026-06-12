export type PostType =
  | "thought-leadership"
  | "educational"
  | "case-study"
  | "trending-topic"
  | "event-cta"
  | "poll";

export type PostStatus = "draft" | "proposed" | "approved" | "published" | "rejected";

export interface TrendingTopic {
  title: string;
  summary: string;
  source: string;
  relevanceScore: number;
  suggestedAngle: string;
}

export interface PostProposal {
  id: string;
  topic: string;
  hook: string;
  bodyOutline: string;
  targetSegment: string;
  postType: PostType;
  contentPillar: string;
  createdAt: string;
}

export interface PostDraft {
  id: string;
  proposalId?: string;
  content: string;
  hook: string;
  hashtags: string[];
  cta: string;
  postType: PostType;
  imagePrompt?: string;
  imageUrl?: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewQuestion {
  question: string;
  purpose: string;
  required: boolean;
}

export interface InterviewAnswers {
  topic: string;
  answers: Record<string, string>;
}

export interface AgentResponse<T> {
  success: boolean;
  data: T;
  tokensUsed: number;
}

export type PipelineStepId = "research" | "ideate" | "review" | "write" | "visual";

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  status: "pending" | "active" | "waiting" | "done" | "error";
  tokensUsed?: number;
  logs: string[];
}
