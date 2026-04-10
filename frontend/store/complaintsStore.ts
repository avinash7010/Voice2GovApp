import { create } from "zustand";
import type { ComplaintListItem, FeedItem } from "../services/api";

type MergeMode = "replace" | "append";

interface ComplaintsState {
  complaints: ComplaintListItem[];
  feedItems: FeedItem[];
  refreshKey: number;
  setComplaints: (items: ComplaintListItem[], mode?: MergeMode) => void;
  setFeedItems: (items: FeedItem[], mode?: MergeMode) => void;
  prependComplaint: (complaint: ComplaintListItem) => void;
  markNeedsRefresh: () => void;
  clearAll: () => void;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    unique.push(item);
  }

  return unique;
}

function toFeedFallback(complaint: ComplaintListItem): FeedItem {
  return {
    ...complaint,
    votes: Number(complaint.votes ?? 0),
    comments: Number(complaint.comments ?? 0),
    verified: Boolean(complaint.verified),
  };
}

export const useComplaintsStore = create<ComplaintsState>((set) => ({
  complaints: [],
  feedItems: [],
  refreshKey: 0,

  setComplaints: (items, mode = "replace") => {
    set((state) => {
      const next =
        mode === "append" ? [...state.complaints, ...items] : [...items];
      return { complaints: dedupeById(next) };
    });
  },

  setFeedItems: (items, mode = "replace") => {
    set((state) => {
      const next =
        mode === "append" ? [...state.feedItems, ...items] : [...items];
      return { feedItems: dedupeById(next) };
    });
  },

  prependComplaint: (complaint) => {
    set((state) => ({
      complaints: dedupeById([complaint, ...state.complaints]),
      feedItems: dedupeById([toFeedFallback(complaint), ...state.feedItems]),
    }));
  },

  markNeedsRefresh: () => {
    set((state) => ({ refreshKey: state.refreshKey + 1 }));
  },

  clearAll: () => {
    set({ complaints: [], feedItems: [], refreshKey: 0 });
  },
}));
