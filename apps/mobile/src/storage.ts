import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  apiBaseUrl: "stablepay.apiBaseUrl",
  recentPayees: "stablepay.recentPayees",
  onboardDone: "stablepay.onboardDone",
} as const;

export async function isOnboardDone(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEYS.onboardDone)) === "1"; } catch { return false; }
}
export async function markOnboardDone(): Promise<void> {
  try { await AsyncStorage.setItem(KEYS.onboardDone, "1"); } catch {}
}

export async function getStoredApiBaseUrl(): Promise<string | null> {
  try { return await AsyncStorage.getItem(KEYS.apiBaseUrl); } catch { return null; }
}
export async function setStoredApiBaseUrl(url: string): Promise<void> {
  try { await AsyncStorage.setItem(KEYS.apiBaseUrl, url); } catch {}
}
export async function clearStoredApiBaseUrl(): Promise<void> {
  try { await AsyncStorage.removeItem(KEYS.apiBaseUrl); } catch {}
}

export type RecentPayee = { vpa: string; display_name?: string; last_used: number; count: number };

export async function getRecentPayees(): Promise<RecentPayee[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.recentPayees);
    return raw ? (JSON.parse(raw) as RecentPayee[]) : [];
  } catch { return []; }
}

export async function recordPayee(vpa: string, display_name?: string): Promise<void> {
  try {
    const list = await getRecentPayees();
    const existing = list.find((p) => p.vpa === vpa);
    const now = Date.now();
    if (existing) {
      existing.last_used = now;
      existing.count += 1;
      if (display_name) existing.display_name = display_name;
    } else {
      list.push({ vpa, display_name, last_used: now, count: 1 });
    }
    list.sort((a, b) => b.last_used - a.last_used);
    await AsyncStorage.setItem(KEYS.recentPayees, JSON.stringify(list.slice(0, 20)));
  } catch {}
}
