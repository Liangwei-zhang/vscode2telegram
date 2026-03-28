// shared/types.ts - 共享類型定義（嚴格類型）

// === Bridge Message (discriminated union) ===

export type BridgeMessage = 
  | PingMessage
  | ChatMessageReq
  | QaProjectMessageReq
  | AgentTaskMessageReq
  | ChatStreamMessageReq
  | TerminalMessageReq
  | FileReadMessageReq
  | FileWriteMessageReq
  | FileDeleteMessageReq
  | CreateDirMessageReq
  | RunCodeMessageReq
  | GetStatusMessageReq
  | ListFilesMessageReq;

interface BaseMessage {
  id: string;
  userId: number;
  timestamp: string;
}

export interface PingMessage extends BaseMessage {
  type: 'ping';
  payload: Record<string, never>;
}

export interface ChatMessageReq extends BaseMessage {
  type: 'chat';
  payload: {
    message: string;
    history?: ChatMessage[];
  };
}

export interface QaProjectMessageReq extends BaseMessage {
  type: 'qa_project';
  payload: {
    question: string;
    history?: ChatMessage[];
  };
}

export interface AgentTaskMessageReq extends BaseMessage {
  type: 'agent_task';
  payload: {
    task: string;
    history?: ChatMessage[];
  };
}

export interface ChatStreamMessageReq extends BaseMessage {
  type: 'chat_stream';
  payload: {
    message: string;
    history?: ChatMessage[];
  };
}

export interface TerminalMessageReq extends BaseMessage {
  type: 'terminal';
  payload: {
    command: string;
  };
}

export interface FileReadMessageReq extends BaseMessage {
  type: 'file_read';
  payload: {
    path: string;
  };
}

export interface FileWriteMessageReq extends BaseMessage {
  type: 'file_write';
  payload: {
    path: string;
    content: string;
  };
}

export interface FileDeleteMessageReq extends BaseMessage {
  type: 'file_delete';
  payload: {
    path: string;
  };
}

export interface CreateDirMessageReq extends BaseMessage {
  type: 'create_dir';
  payload: {
    path: string;
  };
}

export interface RunCodeMessageReq extends BaseMessage {
  type: 'run_code';
  payload: {
    filePath?: string;
  };
}

export interface GetStatusMessageReq extends BaseMessage {
  type: 'get_status';
  payload: Record<string, never>;
}

export interface ListFilesMessageReq extends BaseMessage {
  type: 'list_files';
  payload: {
    path?: string;
  };
}

// === Response Types ===

export type BridgeResponse = 
  | PongResponse
  | ChatDoneResponse
  | AgentResultResponse
  | TerminalOutputResponse
  | FileContentResponse
  | RunResultResponse
  | StatusInfoResponse
  | FilesListResponse
  | ErrorResponse;

export interface BaseResponse {
  id: string;
  status: 'success' | 'error' | 'streaming';
  timestamp: string;
}

export interface ErrorResponse extends BaseResponse {
  type: 'error';
  payload: {
    error: string;
  };
}

export interface PongResponse extends BaseResponse {
  type: 'pong';
  payload: { status?: string };
}

export interface ChatDoneResponse extends BaseResponse {
  type: 'chat_done';
  payload: {
    full_text: string;
  };
}

export interface AgentResultResponse extends BaseResponse {
  type: 'agent_result';
  payload: {
    summary: string;
    filesChanged: string[];
    terminalOutputs: Array<{ command: string; output: string; exitCode: number }>;
  };
}

export interface TerminalOutputResponse extends BaseResponse {
  type: 'terminal_output';
  payload: {
    stdout: string;
    stderr: string;
    exitCode: number;
  };
}

export interface FileContentResponse extends BaseResponse {
  type: 'file_content';
  payload: {
    content?: string;
    path?: string;
    message?: string;
  };
}

export interface RunResultResponse extends BaseResponse {
  type: 'run_result';
  payload: {
    stdout: string;
    stderr: string;
    exitCode: number;
  };
}

export interface StatusInfoResponse extends BaseResponse {
  type: 'status_info';
  payload: {
    connected: boolean;
    extensionVersion?: string;
    workspace?: string;
    editor?: string;
    lmEnabled?: boolean;
    model?: string | { name: string; family: string; vendor: string };
  };
}

export interface FilesListResponse extends BaseResponse {
  type: 'files_list';
  payload: {
    files: string[];
    path?: string;
  };
}

// === Legacy types for compatibility ===

export type MessageType = BridgeMessage['type'];
export type ResponseType = BridgeResponse['type'];

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