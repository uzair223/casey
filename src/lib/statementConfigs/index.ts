/**
 * Statement Configuration System
 * Defines customizable sections/phases for different use cases
 */

export interface StatementPhaseConfig {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface StatementSectionConfig {
  field: string;
  title: string;
  description?: string;
  placeholder?: string;
}

export interface StatementUseCaseConfig {
  id: string;
  name: string;
  agents: {
    chat: string;
    formalize: string;
  };
  phases: StatementPhaseConfig[];
  sections: StatementSectionConfig[];
  includeStatementOfTruth?: boolean;
}

export * from "./config";
export * from "./prompts";
