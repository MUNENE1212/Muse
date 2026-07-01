import { signal } from "@preact/signals";

export const isMenuOpenSignal = signal(false);
export const isCaptureOpenSignal = signal(false);
export const isProfileOpenSignal = signal(false);
export const isNotificationsOpenSignal = signal(false);

export type AppTheme = "dark" | "dim" | "tint" | "light";
export type AppAccentColor =
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "green"
  | "yellow"
  | "red"
  | "white";
export type AppFontSize = "small" | "medium" | "large";

const THEME_STORAGE_KEY = "muse-theme";
const SETTINGS_STORAGE_KEY = "muse-fresh-settings";

const ACCENT_RGB_MAP: Record<AppAccentColor, string> = {
  cyan: "34 211 238",
  blue: "96 165 250",
  purple: "192 132 252",
  pink: "244 114 182",
  green: "74 222 128",
  yellow: "250 204 21",
  red: "248 113 113",
  white: "241 245 249",
};

const LIGHT_THEME_ACCENT_MAP: Record<AppAccentColor, string> = {
  cyan: "8 145 178",
  blue: "37 99 235",
  purple: "147 51 234",
  pink: "219 39 119",
  green: "22 163 74",
  yellow: "202 138 4",
  red: "220 38 38",
  white: "15 23 42", // slate-900 (black equivalent for white accent on light theme)
};

const FONT_SIZE_MAP: Record<AppFontSize, string> = {
  small: "15px",
  medium: "16px",
  large: "18px",
};

export const appThemeSignal = signal<AppTheme>("dark");
export const appAccentSignal = signal<AppAccentColor>("cyan");
export const appFontSizeSignal = signal<AppFontSize>("medium");
export const customAccentHexSignal = signal<string>("");

// HSL → Hex conversion utility (shared with room/thread creation)
export function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 100 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)) / 100;
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgbString(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "34 211 238";
  return `${r} ${g} ${b}`;
}

function readSettings(): {
  appearance?: Record<string, unknown>;
  [key: string]: unknown;
} {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as {
      appearance?: Record<string, unknown>;
      [key: string]: unknown;
    };
  } catch {
    return {};
  }
}

function updateStoredAppearance(
  partial: Partial<
    { theme: AppTheme; accentColor: AppAccentColor; fontSize: AppFontSize }
  >,
) {
  const parsed = readSettings();
  const next = {
    ...parsed,
    appearance: {
      ...(parsed.appearance ?? {}),
      ...partial,
    },
  };
  try {
    globalThis.localStorage?.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // Best effort persistence.
  }
}

function resolveSavedTheme(): AppTheme {
  try {
    const direct = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    const themes: AppTheme[] = ["dark", "dim", "tint", "light"];
    if (themes.includes(direct as AppTheme)) return direct as AppTheme;

    const parsed = readSettings();
    const theme = parsed.appearance?.theme as string | undefined;
    if (theme === "light") return "light";
    if (theme === "dark") return "dark";
    if (theme === "system") {
      return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
  } catch {
    // Keep fallback below.
  }

  return "dark";
}

function applyThemeToDocument(theme: AppTheme) {
  const docEl = globalThis.document?.documentElement;
  if (!docEl) return;
  docEl.setAttribute("data-theme", theme);
}

function applyAccentToDocument(accentColor: AppAccentColor, theme: AppTheme) {
  const docEl = globalThis.document?.documentElement;
  if (!docEl) return;
  const isLight = theme === "light" || theme === "tint";
  const rgb = isLight
    ? LIGHT_THEME_ACCENT_MAP[accentColor]
    : ACCENT_RGB_MAP[accentColor];
  docEl.style.setProperty("--muse-accent-rgb", rgb);
}

function applyFontSizeToDocument(fontSize: AppFontSize) {
  const docEl = globalThis.document?.documentElement;
  if (!docEl) return;
  docEl.style.fontSize = FONT_SIZE_MAP[fontSize];
}

export function initializeTheme() {
  const theme = resolveSavedTheme();
  appThemeSignal.value = theme;
  applyThemeToDocument(theme);
  try {
    const parsed = readSettings();
    const appearance = parsed.appearance as {
      accentColor?: AppAccentColor;
      customAccentHex?: string;
      compactMode?: boolean;
      animations?: boolean;
      reduceMotion?: boolean;
    } | undefined;
    if (appearance?.accentColor) {
      appAccentSignal.value = appearance.accentColor;
    }
    // Restore custom accent hex if saved
    if (appearance?.customAccentHex) {
      customAccentHexSignal.value = appearance.customAccentHex;
      applyCustomAccentToDocument(appearance.customAccentHex);
      return; // Custom accent takes priority
    }
    // Restore appearance data attributes
    if (appearance) {
      applyAppearanceAttributes(appearance);
    }
  } catch {
    // Ignore
  }
  applyAccentToDocument(appAccentSignal.value, theme);
}

function applyCustomAccentToDocument(hex: string) {
  const docEl = globalThis.document?.documentElement;
  if (!docEl || !hex) return;
  docEl.style.setProperty("--muse-accent-rgb", hexToRgbString(hex));
}

function applyAppearanceAttributes(
  appearance?: {
    compactMode?: boolean;
    animations?: boolean;
    reduceMotion?: boolean;
  },
) {
  const docEl = globalThis.document?.documentElement;
  if (!docEl || !appearance) return;
  if (appearance.compactMode !== undefined) {
    docEl.setAttribute("data-compact", String(appearance.compactMode));
  }
  if (appearance.animations !== undefined) {
    docEl.setAttribute("data-animations", String(appearance.animations));
  }
  if (appearance.reduceMotion !== undefined) {
    docEl.setAttribute("data-reduce-motion", String(appearance.reduceMotion));
  }
}

export function setTheme(theme: AppTheme) {
  appThemeSignal.value = theme;
  applyThemeToDocument(theme);
  applyAccentToDocument(appAccentSignal.value, theme);

  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Best effort persistence.
  }

  updateStoredAppearance({ theme });
}

export function toggleTheme() {
  const themes: AppTheme[] = ["dark", "dim", "tint", "light"];
  const currentIndex = themes.indexOf(appThemeSignal.value);
  const nextIndex = (currentIndex + 1) % themes.length;
  setTheme(themes[nextIndex]);
}

export function setAccentColor(accentColor: AppAccentColor) {
  appAccentSignal.value = accentColor;
  customAccentHexSignal.value = ""; // Clear custom when preset chosen
  applyAccentToDocument(accentColor, appThemeSignal.value);
  updateStoredAppearance(
    { accentColor, customAccentHex: "" } as Partial<
      {
        theme: AppTheme;
        accentColor: AppAccentColor;
        fontSize: AppFontSize;
        customAccentHex: string;
      }
    >,
  );
}

export function setCustomAccentHex(hex: string) {
  customAccentHexSignal.value = hex;
  applyCustomAccentToDocument(hex);
  updateStoredAppearance(
    { customAccentHex: hex } as Partial<
      {
        theme: AppTheme;
        accentColor: AppAccentColor;
        fontSize: AppFontSize;
        customAccentHex: string;
      }
    >,
  );
}

export function setAppearanceAttribute(
  key: "compactMode" | "animations" | "reduceMotion",
  value: boolean,
) {
  const docEl = globalThis.document?.documentElement;
  if (!docEl) return;
  const attr = key === "compactMode"
    ? "data-compact"
    : key === "animations"
    ? "data-animations"
    : "data-reduce-motion";
  docEl.setAttribute(attr, String(value));
}

export function setGlobalFontSize(fontSize: AppFontSize) {
  appFontSizeSignal.value = fontSize;
  applyFontSizeToDocument(fontSize);
  updateStoredAppearance({ fontSize });
}

export function toggleMenu() {
  isMenuOpenSignal.value = !isMenuOpenSignal.value;
}

export function closeMenu() {
  isMenuOpenSignal.value = false;
}

export function toggleCapture() {
  isCaptureOpenSignal.value = !isCaptureOpenSignal.value;
}

export function toggleProfile() {
  isProfileOpenSignal.value = !isProfileOpenSignal.value;
}

export function toggleNotifications() {
  isNotificationsOpenSignal.value = !isNotificationsOpenSignal.value;
}

export function closeNotifications() {
  isNotificationsOpenSignal.value = false;
}
