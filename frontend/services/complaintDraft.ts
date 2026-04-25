import * as SecureStore from "expo-secure-store";

import type { ComplaintPayload } from "./api";

const DRAFT_COMPLAINT_KEY = "@voice2gov:draft-complaint";

export type ComplaintDraft = {
  payload: ComplaintPayload;
  imageUri: string | null;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  createdAt: number;
};

export async function saveComplaintDraft(
  draft: Omit<ComplaintDraft, "createdAt">,
): Promise<void> {
  const payload: ComplaintDraft = {
    ...draft,
    createdAt: Date.now(),
  };

  await SecureStore.setItemAsync(DRAFT_COMPLAINT_KEY, JSON.stringify(payload));
}

export async function getComplaintDraft(): Promise<ComplaintDraft | null> {
  const raw = await SecureStore.getItemAsync(DRAFT_COMPLAINT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ComplaintDraft>;
    if (!parsed.payload || typeof parsed.payload !== "object") {
      return null;
    }

    return {
      payload: parsed.payload as ComplaintPayload,
      imageUri: typeof parsed.imageUri === "string" ? parsed.imageUri : null,
      coordinates:
        parsed.coordinates &&
        typeof parsed.coordinates.latitude === "number" &&
        typeof parsed.coordinates.longitude === "number"
          ? {
              latitude: parsed.coordinates.latitude,
              longitude: parsed.coordinates.longitude,
            }
          : null,
      createdAt:
        typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export async function clearComplaintDraft(): Promise<void> {
  await SecureStore.deleteItemAsync(DRAFT_COMPLAINT_KEY);
}
