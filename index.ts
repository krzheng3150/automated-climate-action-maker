/// <reference types="chrome" />

export interface ExtensionMessage<T = unknown> {
  type: 'HELLO' | 'GET_STATUS' | 'RECORD_ACTION';
  payload?: T;
}

export interface HelloStats {
  greetingCount: number;
}

export interface DomainFrequency {
  domain: string;
  count: number;
}

export interface HistoryScanResult {
  googleCount: number;
  nonGoogleCount: number;
  total: number;
  topDomains: DomainFrequency[];
  timestamp: number;
  timeframeDays: number;
}

export interface StreamStep {
  step: number;
  title: string;
  detail: string;
  progress: number;
  done?: boolean;
  payload?: HistoryScanResult;
  error?: string;
}

export const DEFAULT_SCAN_CONFIG = {
  timeframeDays: 7,
  maxResults: 2000,
} as const;
