/**
 * DSS Session & Preferences Persistence
 * 
 * Safe, lightweight storage for user preferences and dispatcher session state.
 * Specifically designed to avoid clogging (quota exhaustion) or interfering with
 * real-time streaming telemetry:
 * - Single isolated namespace key: "mt_dss_preferences_v1"
 * - Compact footprint (~250 bytes) — never stores raw telemetry / GPS coordinates
 * - 24-hour TTL expiry to prevent stale states across days
 * - Fully wrapped in try/catch to protect against private browsing/quota errors
 * - Default theme: "light"
 */

export interface DSSPreferences {
  theme: "light" | "dark";
  activeTab: "hall" | "marey" | "terminal";
  selectedAlertId: string;
  selectedVehicleId: string;
  activeFilter: "all" | "critical" | "bunching";
  searchQuery: string;
  isInspectorOpen: boolean;
  timeStep: string;
  simSpeed: number;
  appliedHoldingIds: string[];
  appliedScenarios: Record<string, string>;
  savedAt: number;
}

const STORAGE_KEY = "mt_dss_preferences_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours TTL

export const DEFAULT_PREFERENCES: DSSPreferences = {
  theme: "light", // Светлая тема по умолчанию
  activeTab: "hall",
  selectedAlertId: "alert_1042",
  selectedVehicleId: "P1042",
  activeFilter: "all",
  searchQuery: "",
  isInspectorOpen: true,
  timeStep: "Сейчас",
  simSpeed: 1.0,
  appliedHoldingIds: [],
  appliedScenarios: {},
  savedAt: Date.now(),
};

/**
 * Loads preferences from localStorage safely.
 * Returns default preferences if storage is empty, corrupted, or older than 24h.
 */
export function loadPreferences(): DSSPreferences {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFERENCES };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_PREFERENCES };
    }

    // Check TTL: discard if older than 24h
    if (parsed.savedAt && Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return { ...DEFAULT_PREFERENCES };
    }

    // Validate and sanitize individual properties
    const theme = parsed.theme === "dark" ? "dark" : "light";
    const activeTab =
      parsed.activeTab === "marey" || parsed.activeTab === "terminal" || parsed.activeTab === "hall"
        ? parsed.activeTab
        : "hall";
    const activeFilter =
      parsed.activeFilter === "critical" || parsed.activeFilter === "bunching" || parsed.activeFilter === "all"
        ? parsed.activeFilter
        : "all";

    return {
      theme,
      activeTab,
      selectedAlertId: typeof parsed.selectedAlertId === "string" ? parsed.selectedAlertId : DEFAULT_PREFERENCES.selectedAlertId,
      selectedVehicleId: typeof parsed.selectedVehicleId === "string" ? parsed.selectedVehicleId : DEFAULT_PREFERENCES.selectedVehicleId,
      activeFilter,
      searchQuery: typeof parsed.searchQuery === "string" ? parsed.searchQuery : "",
      isInspectorOpen: typeof parsed.isInspectorOpen === "boolean" ? parsed.isInspectorOpen : true,
      timeStep: typeof parsed.timeStep === "string" ? parsed.timeStep : "Сейчас",
      simSpeed: typeof parsed.simSpeed === "number" && parsed.simSpeed >= 0.1 && parsed.simSpeed <= 10 ? parsed.simSpeed : 1.0,
      appliedHoldingIds: Array.isArray(parsed.appliedHoldingIds) ? parsed.appliedHoldingIds : [],
      appliedScenarios: parsed.appliedScenarios && typeof parsed.appliedScenarios === "object" ? parsed.appliedScenarios : {},
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Saves partial updates to preferences without blocking or throwing.
 */
export function savePreferences(updates: Partial<DSSPreferences>): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    const current = loadPreferences();
    const updated: DSSPreferences = {
      ...current,
      ...updates,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Graceful fallback for quota exceeded or storage disabled
  }
}

/**
 * Clears preferences back to clean state.
 */
export function clearPreferences(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
