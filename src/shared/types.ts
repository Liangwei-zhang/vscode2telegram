// shared/types.ts - 共享類型定義

export interface BridgeMessage {
  id: string;
  type: MessageType;
  payload: Record<string, any>;
  userId: number;
  timestamp: string;
}

export type MessageType = 
  | 'ping'
  | 'chat'
  | 'terminal'
  | 'file_read'
  | 'file_write'
  | 'run_code'
  | 'get_status'
  | 'list_files';

export interface BridgeResponse {
  id: string;
  type: ResponseType;
  payload: Record<string, any>;
  status: 'success' | 'error' | 'streaming';
  error?: string;
  timestamp: string;
}

export type ResponseType = 
  | 'pong'
  | 'chat_chunk'
  | 'chat_done'
  | 'terminal_output'
  | 'file_content'
  | 'run_result'
  | 'status_info'
  | 'files_list';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Session {
  telegramUserId: number;
  chatHistory: ChatMessage[];
  lastActivity: Date;
  currentRequestId: string | null;
}