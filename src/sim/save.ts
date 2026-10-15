import type { SaveData } from "./world";

const KEY = "ironanddust.save.v1";

// Storage can be unavailable (private windows, blocked site data); the game must still run.
export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Ignore: progress just won't persist this session.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
