import { getCurrentUserId } from '../config/currentUser';

export interface NoteResponse {
  id: string;
  requestedByUserId: string | null;
  projectId: string | null;
  projectName: string | null;
  title: string;
  status: string;
  sourceChannel: string;
  inputKind: string;
  primaryLanguage: string | null;
  currentTextVersionId: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteListResponse {
  notes: NoteResponse[];
}

export interface NoteDetailResponse {
  note: NoteResponse;
  inputs: NoteInputResponse[];
  assets: NoteAssetResponse[];
  textVersions: NoteTextVersionResponse[];
  processingRuns: NoteProcessingRunResponse[];
}

export interface NoteInputResponse {
  id: string;
  noteId: string;
  sourceChannel: string;
  externalSourceId: string | null;
  externalMessageId: string | null;
  inputKind: string;
  rawText: string | null;
  rawPayload: Record<string, unknown>;
  status: string;
  receivedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteAssetResponse {
  id: string;
  noteId: string;
  noteInputId: string | null;
  assetType: string;
  mimeType: string;
  storageKey: string;
  originalFilename: string | null;
  sizeBytes: number | null;
  checksumSha256: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NoteTextVersionResponse {
  id: string;
  noteId: string;
  sourceRunId: string | null;
  versionKind: string;
  text: string;
  language: string | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  createdAt: string;
}

export interface NoteProcessingRunResponse {
  id: string;
  noteId: string;
  jobId: string | null;
  stage: string;
  status: string;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  inputHash: string | null;
  request: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramAccountResponse {
  id: string;
  telegramUserId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  languageCode: string | null;
  isBot: boolean;
  lastSeenAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserTelegramAccountResponse {
  id: string;
  requestedByUserId: string;
  telegramAccountId: string;
  linkedAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedTelegramAccountResponse {
  link: UserTelegramAccountResponse;
  account: TelegramAccountResponse;
}

export interface LinkTelegramAccountRequest {
  requestedByUserId: string;
  telegramUserId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  languageCode?: string | null;
  isBot: boolean;
}

export interface CreateNoteRequest {
  requestedByUserId?: string | null;
  projectId?: string | null;
  title: string;
  sourceChannel: string;
  inputKind: string;
  primaryLanguage?: string | null;
  summary?: string | null;
}

export interface GetNotesRequest {
  requestedByUserId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export async function getNotes(request: GetNotesRequest = {}): Promise<NoteResponse[]> {
  const params = new URLSearchParams();
  params.set('requestedByUserId', request.requestedByUserId ?? getCurrentUserId());
  if (request.projectId) params.set('projectId', request.projectId);
  if (request.limit !== undefined) params.set('limit', String(request.limit));
  if (request.offset !== undefined) params.set('offset', String(request.offset));

  const res = await fetch(`/api/notes?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch notes');
  }

  const data = await res.json() as NoteListResponse;
  return data.notes;
}

export async function getNoteDetail(noteId: string): Promise<NoteDetailResponse> {
  const res = await fetch(`/api/notes/${noteId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch note');
  }

  return res.json() as Promise<NoteDetailResponse>;
}

export async function createNote(request: CreateNoteRequest): Promise<NoteDetailResponse> {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error('Failed to create note');
  }

  return res.json() as Promise<NoteDetailResponse>;
}

export async function getLinkedTelegramAccount(requestedByUserId = getCurrentUserId()): Promise<LinkedTelegramAccountResponse | null> {
  const res = await fetch(`/api/notes/telegram/linked/${requestedByUserId}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error('Failed to fetch linked Telegram account');
  }

  return res.json() as Promise<LinkedTelegramAccountResponse>;
}

export async function linkTelegramAccount(request: LinkTelegramAccountRequest): Promise<UserTelegramAccountResponse> {
  const res = await fetch('/api/notes/telegram/link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error('Failed to link Telegram account');
  }

  return res.json() as Promise<UserTelegramAccountResponse>;
}

export async function revokeTelegramAccountLink(userTelegramAccountId: string): Promise<void> {
  const res = await fetch(`/api/notes/telegram/links/${userTelegramAccountId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Failed to revoke Telegram account link');
  }
}
