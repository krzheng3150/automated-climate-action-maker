/// <reference types="chrome" />

export interface ExtensionMessage<T = unknown> {
  type: 'HELLO' | 'GET_STATUS';
  payload?: T;
}

export interface HelloStats {
  greetingCount: number;
}