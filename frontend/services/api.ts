import { router } from "expo-router";
import { Alert } from "react-native";

import { useAuthStore } from "../store/authStore";
import { useComplaintsStore } from "../store/complaintsStore";

const DEFAULT_NATIVE_BASE_URL = "http://10.187.103.184:8000";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveBaseUrl(): string {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envBaseUrl) {
    try {
      const normalized = normalizeBaseUrl(envBaseUrl);
      const parsed = new URL(normalized);
      if (!parsed.protocol || !parsed.host) {
        throw new Error("Missing protocol or host");
      }

      return normalized;
    } catch (error) {
      console.warn(
        "[startup] Invalid EXPO_PUBLIC_API_BASE_URL. Falling back to default base URL.",
        error,
      );
    }
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "https" : "http";
    const hostname = window.location.hostname || "localhost";
    return `${protocol}://${hostname}:8000`;
  }

  return DEFAULT_NATIVE_BASE_URL;
}

const BASE_URL = resolveBaseUrl();
const API_PREFIX = "/api/v1";

const ENDPOINTS = {
  register: `${API_PREFIX}/auth/register`,
  login: `${API_PREFIX}/auth/login`,
  health: `${API_PREFIX}/health`,
  legacyHealth: "/health",
  voice: `${API_PREFIX}/voice`,
  voiceUpload: `${API_PREFIX}/voice/upload`,
  submitComplaint: `${API_PREFIX}/complaints`,
  complaints: `${API_PREFIX}/complaints/user`,
  feed: `${API_PREFIX}/complaints/feed`,
  complaintById: (id: string) => `${API_PREFIX}/complaints/${id}`,
  notifications: `${API_PREFIX}/notifications`,
  registerPushToken: `${API_PREFIX}/push-token`,
} as const;

type HttpMethod = "GET" | "POST";

type QueryParams = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  method: HttpMethod;
  endpoint: string;
  body?: unknown;
  query?: QueryParams;
  retries?: number;
  timeoutMs?: number;
  includeContentType?: boolean;
}

interface ApiErrorShape {
  detail?: string;
  message?: string;
  error?: {
    message?: string;
    code?: string;
  };
  [key: string]: unknown;
}

interface AuthResponseShape {
  token?: string;
  access_token?: string;
  jwt?: string;
  user?: unknown;
  data?: {
    token?: string;
    access_token?: string;
    jwt?: string;
    user?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ComplaintDetailResponse {
  id: string;
  userId?: string;
  title?: string;
  description: string;
  category: string;
  department: string;
  status: string;
  priority?: string;
  created_at?: string;
  createdAt?: string;
  updatedAt?: string;
  location?: unknown;
  imageUrl?: string;
  image_url?: string;
  image?: string;
  latitude?: number;
  longitude?: number;
  votes?: number;
  comments?: number;
  verified?: boolean;
  [key: string]: unknown;
}

export interface ComplaintListItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  department?: string;
  status: string;
  priority?: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  location?: unknown;
  imageUrl?: string;
  image_url?: string;
  image?: string;
  votes?: number;
  comments?: number;
  verified?: boolean;
  [key: string]: unknown;
}

export interface RegisterRequest {
  name?: string;
  email: string;
  password: string;
  [key: string]: unknown;
}

export interface LoginRequest {
  email: string;
  password: string;
  [key: string]: unknown;
}

export interface ComplaintPayload {
  title: string;
  description: string;
  category: string;
  department: string;
  priority: string;
  location: string;
  push_token?: string;
}

export interface SubmitComplaintResponse {
  complaintId?: string;
  complaint_id?: string;
  id?: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface RegisterPushTokenRequest {
  token: string;
}

export interface VoiceTranscriptionResponse {
  transcription: string;
  filePath?: string;
  raw: unknown;
}

export interface NotificationItem {
  id: string;
  description: string;
  category?: string;
  department?: string;
  status?: string;
  createdAt?: string;
  read?: boolean;
  [key: string]: unknown;
}

export interface FeedItem extends ComplaintListItem {
  votes?: number;
  comments?: number;
  impact?: string;
  verified?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export type ComplaintCreatedListener = (complaint: ComplaintListItem) => void;

export const AUTH_TOKEN_KEY = "auth_token";
const SESSION_EXPIRED_MESSAGE = "Session expired. Please login again";
let authRecoveryInProgress = false;
let authRecoveryResetTimer: ReturnType<typeof setTimeout> | null = null;
let latestSubmittedComplaint: ComplaintListItem | null = null;
const complaintCreatedListeners = new Set<ComplaintCreatedListener>();

const CATEGORY_MAP: Record<string, string> = {
  water: "water",
  road: "road",
  roads: "road",
  "road accident": "road",
  sanitation: "sanitation",
  garbage: "sanitation",
  trash: "sanitation",
  waste: "sanitation",
  infrastructure: "other",
  "fire accident": "other",
  fire: "other",
  accident: "other",
  electricity: "electricity",
  power: "electricity",
};

export function normalizeComplaintCategory(value: unknown): string {
  if (typeof value !== "string") {
    return "other";
  }

  const normalizedInput = value.trim().toLowerCase();
  if (!normalizedInput) {
    return "other";
  }

  return CATEGORY_MAP[normalizedInput] ?? "other";
}

function emitComplaintCreated(complaint: ComplaintListItem) {
  for (const listener of complaintCreatedListeners) {
    try {
      listener(complaint);
    } catch {
      // Never let listener errors break request flow.
    }
  }
}

export function onComplaintCreated(
  listener: ComplaintCreatedListener,
): () => void {
  complaintCreatedListeners.add(listener);

  return () => {
    complaintCreatedListeners.delete(listener);
  };
}

function buildUrl(endpoint: string, query?: QueryParams): string {
  const url = new URL(`${BASE_URL}${endpoint}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function toAbsoluteMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  // Normalize Windows-style paths from backend/local storage.
  const normalizedPath = trimmed.replace(/\\+/g, "/");

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/")) {
    return `${BASE_URL}${normalizedPath}`;
  }

  return `${BASE_URL}/${normalizedPath}`;
}

export function normalizeMediaUrl(value: unknown): string | undefined {
  return toAbsoluteMediaUrl(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractNestedData(payload: unknown): unknown {
  if (!isObject(payload)) {
    return payload;
  }

  const first = payload.data;
  if (isObject(first) && "data" in first) {
    return (first as Record<string, unknown>).data;
  }

  return first ?? payload;
}

function extractCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isObject(payload)) {
    return [];
  }

  const data = payload.data;
  if (Array.isArray(data)) {
    return data;
  }

  if (isObject(data)) {
    if (Array.isArray(data.data)) {
      return data.data;
    }
    if (Array.isArray(data.complaints)) {
      return data.complaints;
    }
    if (Array.isArray(data.notifications)) {
      return data.notifications;
    }
  }

  if (Array.isArray(payload.complaints)) {
    return payload.complaints;
  }

  if (Array.isArray(payload.notifications)) {
    return payload.notifications;
  }

  return [];
}

function inferAudioMimeType(fileUri: string): string {
  const extension = fileUri.split("?")[0]?.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
    case "mp4":
      return "audio/mp4";
    default:
      return "audio/mp4";
  }
}

function inferAudioFileName(fileUri: string): string {
  const fromPath = fileUri.split("?")[0]?.split("/").pop()?.trim();
  if (fromPath) {
    return fromPath;
  }

  return `voice-recording-${Date.now()}.m4a`;
}

function extractVoiceTranscription(payload: unknown): string {
  const nested = extractNestedData(payload);
  if (isObject(nested) && typeof nested.transcription === "string") {
    return nested.transcription;
  }

  if (isObject(nested) && typeof nested.text === "string") {
    return nested.text;
  }

  if (isObject(payload) && typeof payload.transcription === "string") {
    return payload.transcription;
  }

  if (isObject(payload) && typeof payload.text === "string") {
    return payload.text;
  }

  return "";
}

function extractTotal(payload: unknown, fallback: number): number {
  if (isObject(payload)) {
    if (typeof payload.total === "number") {
      return payload.total;
    }

    if (isObject(payload.data) && typeof payload.data.total === "number") {
      return payload.data.total;
    }
  }

  return fallback;
}

function extractApiErrorMessage(payload: unknown): string {
  if (!isObject(payload)) {
    return "";
  }

  const apiPayload = payload as ApiErrorShape;
  if (typeof apiPayload.detail === "string" && apiPayload.detail.trim()) {
    return apiPayload.detail;
  }
  if (typeof apiPayload.message === "string" && apiPayload.message.trim()) {
    return apiPayload.message;
  }
  if (
    apiPayload.error &&
    typeof apiPayload.error.message === "string" &&
    apiPayload.error.message.trim()
  ) {
    return apiPayload.error.message;
  }

  return "";
}

function isUnauthorizedError(status: number, payload: unknown): boolean {
  if (status === 401) {
    return true;
  }

  const message = extractApiErrorMessage(payload).toLowerCase();
  return message.includes("not authenticated") || message.includes("token");
}

function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function isRetriableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError") {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    error instanceof TypeError ||
    message.includes("network") ||
    message.includes("timed out") ||
    message.includes("failed to fetch")
  );
}

function normalizeComplaintFromUnknown(
  payload: unknown,
): ComplaintListItem | null {
  if (!isObject(payload)) {
    return null;
  }

  const raw = payload as ComplaintDetailResponse & {
    complaint_id?: string;
    complaintId?: string;
    image_url?: string;
    image?: string;
  };

  const id = String(raw.id ?? raw.complaint_id ?? raw.complaintId ?? "").trim();
  if (!id) {
    return null;
  }

  const title =
    typeof raw.title === "string" && raw.title.trim().length > 0
      ? raw.title
      : "Untitled Complaint";

  const category =
    typeof raw.category === "string" && raw.category.trim().length > 0
      ? raw.category
      : "General";

  const status =
    typeof raw.status === "string" && raw.status.trim().length > 0
      ? raw.status
      : "pending";

  const createdAt =
    String(raw.createdAt ?? raw.created_at ?? "").trim() ||
    new Date().toISOString();

  return {
    ...raw,
    id,
    title,
    category,
    status,
    createdAt,
    imageUrl: toAbsoluteMediaUrl(raw.imageUrl ?? raw.image_url ?? raw.image),
  };
}

function buildOptimisticComplaintFromSubmission(
  payload: ComplaintPayload,
  response: unknown,
): ComplaintListItem | null {
  const responseObject = isObject(response)
    ? (response as Record<string, unknown>)
    : null;

  const idCandidates: unknown[] = [
    responseObject?.id,
    responseObject?.complaint_id,
    responseObject?.complaintId,
  ];

  const nested = extractNestedData(response);
  if (isObject(nested)) {
    idCandidates.push(
      (nested as Record<string, unknown>).id,
      (nested as Record<string, unknown>).complaint_id,
      (nested as Record<string, unknown>).complaintId,
    );
  }

  const id =
    idCandidates
      .map((value) => String(value ?? "").trim())
      .find((value) => value.length > 0) ?? "";

  if (!id) {
    return null;
  }

  return {
    id,
    title: payload.title,
    description: payload.description,
    category: normalizeComplaintCategory(payload.category),
    department: payload.department,
    status: "pending",
    priority: payload.priority,
    createdAt: new Date().toISOString(),
    location: payload.location,
    imageUrl: toAbsoluteMediaUrl(
      responseObject?.imageUrl ??
        responseObject?.image_url ??
        responseObject?.image ??
        (isObject(nested)
          ? ((nested as Record<string, unknown>).imageUrl ??
            (nested as Record<string, unknown>).image_url ??
            (nested as Record<string, unknown>).image)
          : undefined),
    ),
    votes: 0,
    comments: 0,
    verified: false,
  };
}

function mergeLatestSubmittedComplaint<T extends ComplaintListItem>(
  items: T[],
): T[] {
  if (!latestSubmittedComplaint) {
    return items;
  }

  const exists = items.some((item) => item.id === latestSubmittedComplaint?.id);
  if (exists) {
    latestSubmittedComplaint = null;
    return items;
  }

  return [latestSubmittedComplaint as T, ...items];
}

function extractTokenFromPayload(payload: unknown): string {
  if (!isObject(payload)) {
    return "";
  }

  const authPayload = payload as AuthResponseShape;
  const directToken =
    authPayload.access_token ?? authPayload.token ?? authPayload.jwt ?? "";

  if (typeof directToken === "string" && directToken.trim().length > 0) {
    return directToken.trim();
  }

  const nestedToken =
    authPayload.data?.access_token ??
    authPayload.data?.token ??
    authPayload.data?.jwt ??
    "";

  if (typeof nestedToken === "string" && nestedToken.trim().length > 0) {
    return nestedToken.trim();
  }

  return "";
}

function extractUserFromAuthPayload(
  payload: unknown,
): Record<string, unknown> | null {
  if (!isObject(payload)) {
    return null;
  }

  if (isObject(payload.user)) {
    return payload.user;
  }

  if (isObject(payload.data) && isObject(payload.data.user)) {
    return payload.data.user;
  }

  if (isObject(payload.data)) {
    const candidate = payload.data as Record<string, unknown>;
    if (
      typeof candidate.email === "string" ||
      typeof candidate.name === "string"
    ) {
      return candidate;
    }
  }

  return null;
}

async function parseResponseBody<T>(
  response: Response,
): Promise<T | ApiErrorShape> {
  const responseText = await response.text();
  if (!responseText) {
    return {} as T;
  }

  try {
    return JSON.parse(responseText) as T | ApiErrorShape;
  } catch {
    return { message: responseText } as ApiErrorShape;
  }
}

async function buildAuthHeaders(
  includeContentType: boolean,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  const token = await getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function triggerAuthRecoveryFlow() {
  if (authRecoveryInProgress) {
    return;
  }

  authRecoveryInProgress = true;
  await clearAuthToken();
  Alert.alert("Authentication Required", SESSION_EXPIRED_MESSAGE);

  try {
    router.replace("/(auth)/login");
  } catch {
    // Ignore route errors and let the next app transition recover navigation.
  }

  if (authRecoveryResetTimer) {
    clearTimeout(authRecoveryResetTimer);
  }

  authRecoveryResetTimer = setTimeout(() => {
    authRecoveryInProgress = false;
    authRecoveryResetTimer = null;
  }, 2000);
}

async function getErrorMessageForResponse(
  status: number,
  payload: unknown,
): Promise<string> {
  if (isUnauthorizedError(status, payload)) {
    await triggerAuthRecoveryFlow();
    return SESSION_EXPIRED_MESSAGE;
  }

  const message = extractApiErrorMessage(payload);
  if (message) {
    return message;
  }

  return `Request failed with status ${status}`;
}

function waitBeforeRetry(attempt: number): Promise<void> {
  const delayMs = 300 * attempt;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function request<T>({
  method,
  endpoint,
  body,
  query,
  retries = MAX_RETRIES,
  timeoutMs = REQUEST_TIMEOUT_MS,
  includeContentType = true,
}: RequestOptions): Promise<T> {
  const url = buildUrl(endpoint, query);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: await buildAuthHeaders(includeContentType),
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseJson = await parseResponseBody<T>(response);

      if (!response.ok) {
        if (attempt < retries && isRetriableStatus(response.status)) {
          await waitBeforeRetry(attempt + 1);
          continue;
        }

        const errorMessage = await getErrorMessageForResponse(
          response.status,
          responseJson,
        );
        throw new Error(errorMessage);
      }

      return responseJson as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (attempt < retries && isRetriableNetworkError(error)) {
        await waitBeforeRetry(attempt + 1);
        continue;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          "Request timed out. Please check your connection and try again.",
        );
      }

      if (error instanceof Error) {
        throw new Error(`API request failed: ${error.message}`);
      }

      throw new Error("API request failed due to an unknown error");
    }
  }

  throw new Error("API request failed after maximum retries");
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return useAuthStore.getState().token;
  } catch {
    return null;
  }
}

export async function setAuthToken(
  token: string,
  user: Record<string, unknown> | null = null,
): Promise<void> {
  await useAuthStore.getState().login(token, user);
}

export async function clearAuthToken(): Promise<void> {
  await useAuthStore.getState().logout();
}

export async function registerUser<T = unknown>(
  data: RegisterRequest,
): Promise<T> {
  return await request<T>({
    method: "POST",
    endpoint: ENDPOINTS.register,
    body: data,
  });
}

export async function loginUser<T = unknown>(data: LoginRequest): Promise<T> {
  const response = await request<T>({
    method: "POST",
    endpoint: ENDPOINTS.login,
    body: data,
  });

  const token = extractTokenFromPayload(response);
  if (!token) {
    throw new Error("Login response did not include a JWT token");
  }

  const user = extractUserFromAuthPayload(response);
  await setAuthToken(token, user);

  return response;
}

export async function getHealth<T = unknown>(): Promise<T> {
  try {
    return await request<T>({ method: "GET", endpoint: ENDPOINTS.health });
  } catch {
    return await request<T>({
      method: "GET",
      endpoint: ENDPOINTS.legacyHealth,
    });
  }
}

export async function uploadAudio<T = unknown>(fileUri: string): Promise<T> {
  const formData = new FormData();
  const mimeType = inferAudioMimeType(fileUri);
  const fileName = inferAudioFileName(fileUri);

  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  return await request<T>({
    method: "POST",
    endpoint: ENDPOINTS.voiceUpload,
    body: formData,
    includeContentType: false,
  });
}

export async function uploadVoiceForTranscription(
  fileUri: string,
): Promise<VoiceTranscriptionResponse> {
  const trimmedUri = fileUri.trim();
  if (!trimmedUri) {
    throw new Error("Audio file URI is required");
  }

  const formData = new FormData();
  const mimeType = inferAudioMimeType(trimmedUri);
  const fileName = inferAudioFileName(trimmedUri);

  formData.append("file", {
    uri: trimmedUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  let response: unknown;

  try {
    response = await request<unknown>({
      method: "POST",
      endpoint: ENDPOINTS.voice,
      body: formData,
      includeContentType: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const isRouteFallbackCase =
      message.includes("status 404") || message.includes("status 405");

    if (!isRouteFallbackCase) {
      throw error;
    }

    response = await request<unknown>({
      method: "POST",
      endpoint: ENDPOINTS.voiceUpload,
      body: formData,
      includeContentType: false,
    });
  }

  const transcription = extractVoiceTranscription(response).trim();
  if (!transcription) {
    throw new Error("Voice transcription was empty in response");
  }

  const nested = extractNestedData(response);
  const filePath =
    isObject(nested) && typeof nested.file_path === "string"
      ? nested.file_path
      : isObject(response) && typeof response.file_path === "string"
        ? response.file_path
        : undefined;

  return {
    transcription,
    filePath,
    raw: response,
  };
}

export async function submitComplaint<T = SubmitComplaintResponse>(
  data: ComplaintPayload,
  imageUri?: string | null,
): Promise<T> {
  const normalizedCategory = normalizeComplaintCategory(data.category);

  const formData = new FormData();
  formData.append("title", data.title);
  formData.append("description", data.description);
  formData.append("category", normalizedCategory);
  formData.append("department", data.department);
  formData.append("priority", data.priority);
  formData.append("location", data.location);

  if (
    typeof data.push_token === "string" &&
    data.push_token.trim().length > 0
  ) {
    formData.append("push_token", data.push_token);
  }

  if (typeof imageUri === "string" && imageUri.trim().length > 0) {
    const fileName =
      imageUri.split("/").pop() ?? `complaint-image-${Date.now()}.jpg`;
    const extension = fileName.split(".").pop()?.toLowerCase();
    const mimeType = extension === "png" ? "image/png" : "image/jpeg";

    formData.append("image", {
      uri: imageUri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
  }

  const response = await request<T>({
    method: "POST",
    endpoint: ENDPOINTS.submitComplaint,
    body: formData,
    includeContentType: false,
  });

  const created =
    normalizeComplaintFromUnknown(extractNestedData(response) ?? response) ??
    buildOptimisticComplaintFromSubmission(data, response);

  if (created) {
    latestSubmittedComplaint = created;
    useComplaintsStore.getState().prependComplaint(created);
    useComplaintsStore.getState().markNeedsRefresh();
    emitComplaintCreated(created);
  }

  return response;
}

export async function getComplaintById<T = ComplaintDetailResponse>(
  id: string,
): Promise<T> {
  const complaintId = id.trim();
  if (!complaintId) {
    throw new Error("getComplaintById failed: complaint ID is required");
  }

  const response = await request<unknown>({
    method: "GET",
    endpoint: ENDPOINTS.complaintById(complaintId),
  });

  const payload = extractNestedData(response) ?? response;
  if (!isObject(payload)) {
    throw new Error("getComplaintById failed: invalid complaint payload");
  }

  const raw = payload as ComplaintDetailResponse;
  const normalized: ComplaintDetailResponse = {
    ...raw,
    createdAt: raw.createdAt ?? raw.created_at,
    imageUrl: toAbsoluteMediaUrl(raw.imageUrl ?? raw.image_url ?? raw.image),
  };

  return normalized as T;
}

export async function getComplaintsPage(
  options: PaginationOptions = {},
): Promise<PaginatedResult<ComplaintListItem>> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;

  const response = await request<unknown>({
    method: "GET",
    endpoint: ENDPOINTS.complaints,
    query: { page, limit },
  });

  const rawItems = extractCollection(response);
  const mapped = rawItems
    .map((item) => normalizeComplaintFromUnknown(item))
    .filter((item): item is ComplaintListItem => item !== null);

  const items = mergeLatestSubmittedComplaint(mapped);
  const total = extractTotal(response, items.length);

  return {
    items,
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}

export async function getComplaints<T = ComplaintListItem[]>(): Promise<T> {
  const page = await getComplaintsPage({ page: 1, limit: 20 });
  return page.items as T;
}

function toFeedItem(raw: unknown): FeedItem | null {
  const normalized = normalizeComplaintFromUnknown(raw);
  if (!normalized) {
    return null;
  }

  const source = isObject(raw) ? (raw as Record<string, unknown>) : {};

  return {
    ...normalized,
    votes: typeof source.votes === "number" ? source.votes : 0,
    comments: typeof source.comments === "number" ? source.comments : 0,
    verified: Boolean(source.verified),
  };
}

export async function getFeedPage(
  options: PaginationOptions = {},
): Promise<PaginatedResult<FeedItem>> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;

  try {
    const response = await request<unknown>({
      method: "GET",
      endpoint: ENDPOINTS.feed,
      query: { page, limit },
    });

    const rawItems = extractCollection(response);
    const mapped = rawItems
      .map((item) => toFeedItem(item))
      .filter((item): item is FeedItem => item !== null);

    const items = mergeLatestSubmittedComplaint(mapped);
    const total = extractTotal(response, items.length);

    return {
      items,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  } catch {
    const complaintsPage = await getComplaintsPage({ page, limit });
    return {
      items: complaintsPage.items as FeedItem[],
      page: complaintsPage.page,
      limit: complaintsPage.limit,
      total: complaintsPage.total,
      hasMore: complaintsPage.hasMore,
    };
  }
}

export async function getFeed<T = FeedItem[]>(): Promise<T> {
  const page = await getFeedPage({ page: 1, limit: 20 });
  return page.items as T;
}

export async function registerPushToken<T = unknown>(
  token: string,
): Promise<T> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw new Error("registerPushToken failed: token is required");
  }

  return await request<T>({
    method: "POST",
    endpoint: ENDPOINTS.registerPushToken,
    body: { token: trimmedToken } satisfies RegisterPushTokenRequest,
  });
}

export async function getNotifications<T = NotificationItem[]>(): Promise<T> {
  const response = await request<unknown>({
    method: "GET",
    endpoint: ENDPOINTS.notifications,
  });

  const source = extractCollection(response);
  return (source || []) as T;
}

export { BASE_URL };

export async function logoutUser() {
  await clearAuthToken();
}
