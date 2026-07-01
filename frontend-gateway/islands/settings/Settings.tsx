import { useEffect, useRef, useState } from "preact/hooks";
import * as Icons from "lucide-preact";
const SafeIcons = Icons as unknown as Record<
  string,
  import("preact").ComponentType<Record<string, unknown>>
>;
const LucideIcon = (props: {
  icon: import("preact").ComponentType<Record<string, unknown>>;
  className?: string;
  size?: number;
  [key: string]: unknown;
}) => {
  const { icon: IconComponent, ...rest } = props;
  return <IconComponent {...rest} />;
};
import {
  addLink,
  logout,
  removeLink,
  soloModeSignal,
  togglePublicSetting,
  toggleSoloMode,
  updatePrivacySecurity,
  updateProfile,
  type User as UserModel,
  userSignal,
} from "../../signals/user.ts";
import { resetRooms } from "../../signals/rooms.ts";
import { resetItems } from "../../signals/items.ts";
import { resetThreads } from "../../signals/threads.ts";
import { resetJournalEntries } from "../../signals/journal.ts";
import {
  customAccentHexSignal,
  hslToHex,
  setAccentColor,
  setAppearanceAttribute,
  setCustomAccentHex,
  setGlobalFontSize,
  setTheme,
} from "../../signals/ui.ts";
import {
  safeLocalGet,
  safeLocalRemove,
  safeLocalSet,
} from "../../utils/localStorage.ts";

import EmojiInput from "../../components/ui/EmojiInput.tsx";
import TwoFactorModal from "../modals/TwoFactorModal.tsx";

type SettingsTab =
  | "profile"
  | "appearance"
  | "notifications"
  | "privacy"
  | "data";

type SaveStatus = "idle" | "saving" | "saved";

type AppearanceSettings = {
  theme: "dark" | "light" | "dim" | "tint";
  accentColor:
    | "cyan"
    | "blue"
    | "purple"
    | "pink"
    | "green"
    | "yellow"
    | "red"
    | "white";
  fontSize: "small" | "medium" | "large";
  compactMode: boolean;
  animations: boolean;
  reduceMotion: boolean;
  customAccentHex: string;
};

type NotificationSettings = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  notifyOnReply: boolean;
  notifyOnLike: boolean;
  notifyOnFollow: boolean;
  notifyOnAchievement: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
};

type DataSettings = {
  exportFormat: "json" | "csv";
  lastExport: string | null;
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  accentColor: "cyan",
  fontSize: "medium",
  compactMode: false,
  animations: true,
  reduceMotion: false,
  customAccentHex: "",
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailNotifications: true,
  pushNotifications: true,
  inAppNotifications: true,
  notifyOnReply: true,
  notifyOnLike: true,
  notifyOnFollow: true,
  notifyOnAchievement: true,
  weeklyDigest: true,
  productUpdates: false,
};

const NOTIFICATION_OPTIONS: Array<{
  key: keyof NotificationSettings;
  label: string;
  icon: import("preact").ComponentType<Record<string, unknown>>;
  description: string;
}> = [
  {
    key: "notifyOnReply",
    label: "New replies to my threads",
    icon: SafeIcons.MessageCircle,
    description: "Get notified when someone responds to your threads.",
  },
  {
    key: "notifyOnLike",
    label: "Likes on my content",
    icon: SafeIcons.Heart,
    description: "See when people appreciate your work.",
  },
  {
    key: "notifyOnFollow",
    label: "New followers",
    icon: SafeIcons.UserPlus,
    description: "Stay informed when someone starts following you.",
  },
  {
    key: "notifyOnAchievement",
    label: "Achievement unlocks",
    icon: SafeIcons.Award,
    description: "Celebrate progress when you hit milestones.",
  },
  {
    key: "weeklyDigest",
    label: "Weekly digest",
    icon: SafeIcons.Newspaper,
    description: "Receive a weekly summary of activity.",
  },
  {
    key: "productUpdates",
    label: "Product updates",
    icon: SafeIcons.Zap,
    description: "Hear about new features and releases.",
  },
];

const DEFAULT_DATA_SETTINGS: DataSettings = {
  exportFormat: "json",
  lastExport: null,
};

const ACCENT_OPTIONS: Array<
  { value: AppearanceSettings["accentColor"]; className: string }
> = [
  { value: "cyan", className: "bg-cyan-400" },
  { value: "blue", className: "bg-blue-400" },
  { value: "purple", className: "bg-purple-400" },
  { value: "pink", className: "bg-pink-400" },
  { value: "green", className: "bg-green-400" },
  { value: "yellow", className: "bg-yellow-400" },
  { value: "red", className: "bg-red-400" },
  { value: "white", className: "bg-white" },
];

const THEME_OPTIONS: Array<
  {
    value: AppearanceSettings["theme"];
    label: string;
    icon: import("preact").ComponentType<Record<string, unknown>>;
  }
> = [
  { value: "dark", label: "Midnight", icon: SafeIcons.Moon },
  { value: "dim", label: "Slate", icon: SafeIcons.CloudMoon },
  { value: "tint", label: "Glow", icon: SafeIcons.Sparkles },
  { value: "light", label: "Solar", icon: SafeIcons.Sun },
];

const FONT_SIZE_OPTIONS: Array<
  { value: AppearanceSettings["fontSize"]; label: string; size: number }
> = [
  { value: "small", label: "Small", size: 14 },
  { value: "medium", label: "Medium", size: 16 },
  { value: "large", label: "Large", size: 18 },
];

const STORAGE_KEY = "muse-fresh-settings";

// Dynamic IANA timezone list – uses browser API when available, curated fallback otherwise
const IANA_TIMEZONES: string[] = (() => {
  try {
    // Modern browsers support Intl.supportedValuesOf
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return (Intl as unknown as {
        supportedValuesOf: (key: string) => string[];
      })
        .supportedValuesOf("timeZone");
    }
  } catch {
    // Fallback below
  }
  // Curated fallback – major world timezones
  return [
    "Africa/Abidjan",
    "Africa/Accra",
    "Africa/Addis_Ababa",
    "Africa/Algiers",
    "Africa/Cairo",
    "Africa/Casablanca",
    "Africa/Dar_es_Salaam",
    "Africa/Johannesburg",
    "Africa/Lagos",
    "Africa/Nairobi",
    "Africa/Tunis",
    "America/Anchorage",
    "America/Argentina/Buenos_Aires",
    "America/Bogota",
    "America/Chicago",
    "America/Denver",
    "America/Halifax",
    "America/Lima",
    "America/Los_Angeles",
    "America/Mexico_City",
    "America/New_York",
    "America/Phoenix",
    "America/Santiago",
    "America/Sao_Paulo",
    "America/Toronto",
    "America/Vancouver",
    "Asia/Baghdad",
    "Asia/Bangkok",
    "Asia/Colombo",
    "Asia/Dubai",
    "Asia/Hong_Kong",
    "Asia/Jakarta",
    "Asia/Jerusalem",
    "Asia/Karachi",
    "Asia/Kolkata",
    "Asia/Kuala_Lumpur",
    "Asia/Manila",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Taipei",
    "Asia/Tehran",
    "Asia/Tokyo",
    "Atlantic/Azores",
    "Atlantic/Reykjavik",
    "Australia/Adelaide",
    "Australia/Brisbane",
    "Australia/Melbourne",
    "Australia/Perth",
    "Australia/Sydney",
    "Europe/Amsterdam",
    "Europe/Athens",
    "Europe/Berlin",
    "Europe/Brussels",
    "Europe/Bucharest",
    "Europe/Dublin",
    "Europe/Helsinki",
    "Europe/Istanbul",
    "Europe/Lisbon",
    "Europe/London",
    "Europe/Madrid",
    "Europe/Moscow",
    "Europe/Oslo",
    "Europe/Paris",
    "Europe/Prague",
    "Europe/Rome",
    "Europe/Stockholm",
    "Europe/Vienna",
    "Europe/Warsaw",
    "Europe/Zurich",
    "Pacific/Auckland",
    "Pacific/Fiji",
    "Pacific/Honolulu",
    "Pacific/Port_Moresby",
    "Pacific/Tongatapu",
  ];
})();

function getDetectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

function detectLocation(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!globalThis.navigator?.geolocation) {
      resolve(null);
      return;
    }

    // Set timeout so it doesn't hang forever
    const timeout = setTimeout(() => resolve(null), 10000);

    globalThis.navigator.geolocation.getCurrentPosition(
      async (position) => {
        clearTimeout(timeout);
        try {
          const { latitude, longitude } = position.coords;

          // Try reverse geocoding with Nominatim (with proper headers)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                "User-Agent": "Muse-App/1.0",
              },
            },
          );

          if (!response.ok) {
            resolve(null);
            return;
          }

          const data = await response.json() as {
            address?: {
              city?: string;
              town?: string;
              county?: string;
              municipality?: string;
              country?: string;
            };
          };
          const city = data.address?.city || data.address?.town ||
            data.address?.county || data.address?.municipality ||
            data.address?.country;
          resolve(city || null);
        } catch (error) {
          console.warn("Location detection failed:", error);
          resolve(null);
        }
      },
      (error) => {
        clearTimeout(timeout);
        console.warn("Geolocation error:", error.message);
        resolve(null);
      },
      { timeout: 8000, enableHighAccuracy: false },
    );
  });
}

export default function Settings() {
  const user = userSignal.value;
  const soloMode = soloModeSignal.value;

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [appearance, setAppearance] = useState<AppearanceSettings>(
    DEFAULT_APPEARANCE,
  );
  const [notifications, setNotifications] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATIONS,
  );
  const [dataSettings, setDataSettings] = useState<DataSettings>(
    DEFAULT_DATA_SETTINGS,
  );
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [customGender, setCustomGender] = useState("");
  const [customPronouns, setCustomPronouns] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [_showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [_timezoneSearch, setTimezoneSearch] = useState("");
  const [showCustomAccentPicker, setShowCustomAccentPicker] = useState(false);
  const [customHue, setCustomHueState] = useState(200);
  const [customSat, setCustomSatState] = useState(100);
  const [customLight, setCustomLightState] = useState(60);
  const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);

  const hasInitialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const parsed = safeLocalGet<{
      appearance?: AppearanceSettings;
      notifications?: NotificationSettings;
      dataSettings?: DataSettings;
    } | null>(STORAGE_KEY, null);

    if (parsed) {
      if (parsed.appearance) {
        setAppearance({ ...DEFAULT_APPEARANCE, ...parsed.appearance });
      }
      if (parsed.notifications) {
        setNotifications({ ...DEFAULT_NOTIFICATIONS, ...parsed.notifications });
      }
      if (parsed.dataSettings) {
        setDataSettings({ ...DEFAULT_DATA_SETTINGS, ...parsed.dataSettings });
      }
    }
    hasInitialized.current = true;
  }, []);

  useEffect(() => {
    setTheme(appearance.theme);
  }, [appearance.theme]);

  useEffect(() => {
    setAccentColor(appearance.accentColor);
  }, [appearance.accentColor]);

  useEffect(() => {
    setGlobalFontSize(appearance.fontSize);
  }, [appearance.fontSize]);

  useEffect(() => {
    if (!hasInitialized.current || !user) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (hideSavedTimer.current) clearTimeout(hideSavedTimer.current);

    setSaveStatus("saving");

    saveTimer.current = setTimeout(() => {
      safeLocalSet(STORAGE_KEY, { appearance, notifications, dataSettings });

      setSaveStatus("saved");
      hideSavedTimer.current = setTimeout(() => setSaveStatus("idle"), 1800);
    }, 450);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (hideSavedTimer.current) clearTimeout(hideSavedTimer.current);
    };
  }, [
    user,
    appearance,
    notifications,
    dataSettings,
    soloMode,
    user?.name,
    user?.username,
    user?.email,
    user?.bio,
    user?.location,
    user?.gender,
    user?.pronouns,
    user?.birthDate,
    user?.occupation,
    user?.timezone,
    user?.website,
    user?.avatarUrl,
    user?.links,
    user?.privacySecurity.accountVisibility,
    user?.privacySecurity.showEmailInProfile,
    user?.privacySecurity.allowSearchIndexing,
    user?.privacySecurity.twoFactorEnabled,
    user?.publicSettings.showProfile,
    user?.publicSettings.showLocation,
    user?.publicSettings.showRooms,
    user?.publicSettings.showThreads,
    user?.publicSettings.showInsights,
  ]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <a href="/auth" className="text-white underline">Please login</a>
      </div>
    );
  }

  const tabs: Array<
    {
      id: SettingsTab;
      label: string;
      icon: import("preact").ComponentType<Record<string, unknown>>;
    }
  > = [
    { id: "profile", label: "Profile", icon: SafeIcons.User },
    { id: "appearance", label: "Appearance", icon: SafeIcons.Palette },
    { id: "notifications", label: "Notifications", icon: SafeIcons.Bell },
    { id: "privacy", label: "Privacy", icon: SafeIcons.Shield },
    { id: "data", label: "Data", icon: SafeIcons.Database },
  ];

  const handleProfileUpdate = (updates: Partial<UserModel>) => {
    updateProfile(updates);
  };

  const handleAvatarUpload = (event: unknown) => {
    const target = (event as { target: HTMLInputElement | null })
      ?.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      updateProfile({ avatarUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const exportData = () => {
    const payload = {
      profile: {
        name: user.name,
        username: user.username,
        email: user.email,
        bio: user.bio,
        location: user.location,
        gender: user.gender,
        pronouns: user.pronouns,
        birthDate: user.birthDate,
        occupation: user.occupation,
        timezone: user.timezone,
        website: user.website,
        links: user.links,
      },
      publicSettings: user.publicSettings,
      privacySecurity: user.privacySecurity,
      appearance,
      notifications,
      exportedAt: new Date().toISOString(),
    };

    const serialized = dataSettings.exportFormat === "csv"
      ? [
        "key,value",
        `name,${JSON.stringify(user.name)}`,
        `username,${JSON.stringify(user.username)}`,
        `email,${JSON.stringify(user.email)}`,
        `location,${JSON.stringify(user.location || "")}`,
        `gender,${JSON.stringify(user.gender || "")}`,
        `pronouns,${JSON.stringify(user.pronouns || "")}`,
        `birthDate,${JSON.stringify(user.birthDate || "")}`,
        `occupation,${JSON.stringify(user.occupation || "")}`,
        `timezone,${JSON.stringify(user.timezone || "")}`,
        `website,${JSON.stringify(user.website || "")}`,
        `socialLinks,${user.links.length}`,
        `theme,${appearance.theme}`,
        `accentColor,${appearance.accentColor}`,
      ].join("\n")
      : JSON.stringify(payload, null, 2);

    const mimeType = dataSettings.exportFormat === "csv"
      ? "text/csv"
      : "application/json";
    const ext = dataSettings.exportFormat === "csv" ? "csv" : "json";

    const blob = new Blob([serialized], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `muse-settings-${
      new Date().toISOString().split("T")[0]
    }.${ext}`;
    anchor.click();
    URL.revokeObjectURL(url);

    setDataSettings((current) => ({
      ...current,
      lastExport: new Date().toISOString(),
    }));
  };

  const getApproxDataSize = () => {
    const snapshot = JSON.stringify({
      profile: user,
      appearance,
      notifications,
      privacy: user.privacySecurity,
      data: dataSettings,
    });
    const bytes = new TextEncoder().encode(snapshot).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearAllData = () => {
    const shouldDelete = globalThis.confirm?.(
      "Delete all local Muse data? This removes profile preferences, rooms, threads, items, and journal entries from this browser.",
    ) ?? false;
    if (!shouldDelete) return;

    safeLocalRemove(STORAGE_KEY);

    resetRooms();
    resetItems();
    resetThreads();
    resetJournalEntries();
    logout();
    soloModeSignal.value = false;

    setAppearance(DEFAULT_APPEARANCE);
    setNotifications(DEFAULT_NOTIFICATIONS);
    setDataSettings({ ...DEFAULT_DATA_SETTINGS, lastExport: null });

    // Re-enable login flow after wipe.
    globalThis.location.href = "/auth";
  };

  const resetLocalPreferences = () => {
    const shouldReset = globalThis.confirm?.(
      "Reset appearance, notifications, and privacy preferences?",
    ) ?? false;
    if (!shouldReset) return;

    setAppearance(DEFAULT_APPEARANCE);
    setNotifications(DEFAULT_NOTIFICATIONS);
    setDataSettings(DEFAULT_DATA_SETTINGS);
    updatePrivacySecurity({
      accountVisibility: "public",
      showEmailInProfile: false,
      allowSearchIndexing: true,
      twoFactorEnabled: false,
    });
  };

  const handleAddSocialLink = (event: unknown) => {
    (event as { preventDefault: () => void }).preventDefault();
    const title = newLinkTitle.trim();
    const urlInput = newLinkUrl.trim();
    if (!title || !urlInput) return;

    const normalizedUrl = /^https?:\/\//i.test(urlInput)
      ? urlInput
      : `https://${urlInput}`;
    addLink({ title, url: normalizedUrl });
    setNewLinkTitle("");
    setNewLinkUrl("");
  };

  return (
    <div className="min-h-screen bg-canvas-bg-dark px-6 md:px-10 py-8 max-w-6xl mx-auto pb-48">
      <button
        type="button"
        onClick={() => globalThis.location.href = "/"}
        className="flex items-center gap-2 text-[var(--muse-muted)] hover:text-[var(--muse-text)] transition mb-6"
      >
        <LucideIcon icon={SafeIcons.ArrowLeft} size={16} />
        <span className="text-sm font-bold uppercase tracking-widest">
          Back
        </span>
      </button>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Settings
          </h1>
          <p className="text-gray-400 mt-1 font-serif italic">
            Manage your account and platform preferences.
          </p>
        </div>

        {saveStatus === "saving" && (
          <div className="flex items-center gap-2 text-gray-400">
            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Saving...</span>
          </div>
        )}
        {saveStatus === "saved" && (
          <div className="flex items-center gap-2 text-emerald-400">
            <LucideIcon icon={SafeIcons.CheckCircle} size={16} />
            <span className="text-sm">Saved</span>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-white/10 mb-7 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <LucideIcon icon={Icon} size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {activeTab === "profile" && (
          <section className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                Profile Information
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center overflow-hidden border border-white/10">
                    {user.avatarUrl
                      ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      )
                      : (
                        <span className="text-2xl text-white">
                          {user.name.charAt(0)}
                        </span>
                      )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-1 bg-white rounded-full text-black opacity-0 group-hover:opacity-100 transition"
                  >
                    <LucideIcon icon={SafeIcons.Camera} size={10} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleAvatarUpload(event)}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Profile Picture</p>
                  <p className="text-[10px] text-gray-500">
                    Click camera to upload
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Full Name(s)
                  </label>
                  <input
                    value={user.name}
                    onInput={(event) =>
                      handleProfileUpdate({
                        name: (event.target as HTMLInputElement).value,
                      })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Username
                  </label>
                  <EmojiInput
                    value={user.username || ""}
                    onInput={(val: string) =>
                      handleProfileUpdate({ username: val })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <LucideIcon icon={SafeIcons.Mail} size={12} /> Email
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    onInput={(event) =>
                      handleProfileUpdate({
                        email: (event.target as HTMLInputElement).value,
                      })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <LucideIcon icon={SafeIcons.MapPin} size={12} /> Location
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={user.location || ""}
                      onInput={(event) =>
                        handleProfileUpdate({
                          location: (event.target as HTMLInputElement).value,
                        })}
                      placeholder="e.g. Nairobi, Kenya"
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setIsDetectingLocation(true);
                        const detected = await detectLocation();
                        if (detected) {
                          handleProfileUpdate({ location: detected });
                        } else {
                          globalThis.alert?.(
                            "Unable to detect location. Please check:\n1. Browser geolocation permission is enabled\n2. Internet connection is active\n3. Or enter location manually",
                          );
                        }
                        setIsDetectingLocation(false);
                      }}
                      disabled={isDetectingLocation}
                      className="px-3 py-2 bg-canvas-primary/20 border border-canvas-primary/45 hover:bg-canvas-primary/30 rounded-xl text-canvas-primary text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                      title="Auto-detect location using device location (requires permission)"
                    >
                      <LucideIcon icon={SafeIcons.Compass} size={14} />
                      {isDetectingLocation ? "Detecting..." : "Detect"}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Requires location permission. Allow when prompted by your
                    browser.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">
                    Bio
                  </label>
                  <EmojiInput
                    value={user.bio || ""}
                    onInput={(val: string) => handleProfileUpdate({ bio: val })}
                    multiline
                    rows={3}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Gender
                  </label>
                  <select
                    value={[
                        "Woman",
                        "Man",
                        "Non-binary",
                        "Genderqueer",
                        "Genderfluid",
                        "Agender",
                        "Bigender",
                        "Two-Spirit",
                        "Transgender Man",
                        "Transgender Woman",
                        "Cisgender Woman",
                        "Cisgender Man",
                        "Prefer not to answer",
                      ].includes(user.gender || "")
                      ? user.gender
                      : "other"}
                    onChange={(event) => {
                      const value = (event.target as HTMLSelectElement).value;
                      if (value === "other") {
                        setCustomGender("");
                        handleProfileUpdate({ gender: "" });
                      } else {
                        setCustomGender("");
                        handleProfileUpdate({ gender: value });
                      }
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 cursor-pointer appearance-none pr-10"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a5a5a5' d='M3 5l3 3 3-3'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 0.7rem center",
                      paddingRight: "2rem",
                    }}
                  >
                    <option value="">Select a gender identity...</option>
                    <option value="Woman">Woman</option>
                    <option value="Man">Man</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Genderqueer">Genderqueer</option>
                    <option value="Genderfluid">Genderfluid</option>
                    <option value="Agender">Agender</option>
                    <option value="Bigender">Bigender</option>
                    <option value="Two-Spirit">Two-Spirit</option>
                    <option value="Transgender Man">Transgender Man</option>
                    <option value="Transgender Woman">Transgender Woman</option>
                    <option value="Cisgender Woman">Cisgender Woman</option>
                    <option value="Cisgender Man">Cisgender Man</option>
                    <option value="Prefer not to answer">
                      Prefer not to answer
                    </option>
                    <option value="other">Other (specify below)</option>
                  </select>
                  {([
                          "Woman",
                          "Man",
                          "Non-binary",
                          "Genderqueer",
                          "Genderfluid",
                          "Agender",
                          "Bigender",
                          "Two-Spirit",
                          "Transgender Man",
                          "Transgender Woman",
                          "Cisgender Woman",
                          "Cisgender Man",
                          "Prefer not to answer",
                        ].includes(user.gender || "") === false &&
                      user.gender) ||
                      customGender ||
                      ([
                            "Woman",
                            "Man",
                            "Non-binary",
                            "Genderqueer",
                            "Genderfluid",
                            "Agender",
                            "Bigender",
                            "Two-Spirit",
                            "Transgender Man",
                            "Transgender Woman",
                            "Cisgender Woman",
                            "Cisgender Man",
                            "Prefer not to answer",
                          ].includes(user.gender || "") === false &&
                        !user.gender && customGender === "")
                    ? (
                      <input
                        type="text"
                        value={customGender || user.gender || ""}
                        onInput={(event) => {
                          const value =
                            (event.target as HTMLInputElement).value;
                          setCustomGender(value);
                          handleProfileUpdate({ gender: value });
                        }}
                        placeholder="Enter your gender identity..."
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 mt-2"
                      />
                    )
                    : null}
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Pronouns
                  </label>
                  <select
                    value={[
                        "she/her",
                        "he/him",
                        "they/them",
                        "xe/xem",
                        "ze/zir",
                        "per/per",
                        "sie/hir",
                        "em/emself",
                        "ey/em",
                        "hu/hum",
                        "she/they",
                        "he/they",
                        "any pronouns",
                        "ask me",
                        "prefer not to answer",
                      ].includes(user.pronouns || "")
                      ? user.pronouns
                      : "other"}
                    onChange={(event) => {
                      const value = (event.target as HTMLSelectElement).value;
                      if (value === "other") {
                        setCustomPronouns("");
                        handleProfileUpdate({ pronouns: "" });
                      } else {
                        setCustomPronouns("");
                        handleProfileUpdate({ pronouns: value });
                      }
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 cursor-pointer appearance-none pr-10"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a5a5a5' d='M3 5l3 3 3-3'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 0.7rem center",
                      paddingRight: "2rem",
                    }}
                  >
                    <option value="">Select pronouns...</option>
                    <option value="she/her">she/her</option>
                    <option value="he/him">he/him</option>
                    <option value="they/them">they/them</option>
                    <option value="xe/xem">xe/xem</option>
                    <option value="ze/zir">ze/zir</option>
                    <option value="per/per">per/per</option>
                    <option value="sie/hir">sie/hir</option>
                    <option value="em/emself">em/emself</option>
                    <option value="ey/em">ey/em</option>
                    <option value="hu/hum">hu/hum</option>
                    <option value="she/they">she/they</option>
                    <option value="he/they">he/they</option>
                    <option value="any pronouns">any pronouns</option>
                    <option value="ask me">ask me</option>
                    <option value="prefer not to answer">
                      prefer not to answer
                    </option>
                    <option value="other">Other (specify below)</option>
                  </select>
                  {([
                          "she/her",
                          "he/him",
                          "they/them",
                          "xe/xem",
                          "ze/zir",
                          "per/per",
                          "sie/hir",
                          "em/emself",
                          "ey/em",
                          "hu/hum",
                          "she/they",
                          "he/they",
                          "any pronouns",
                          "ask me",
                          "prefer not to answer",
                        ].includes(user.pronouns || "") === false &&
                      user.pronouns) ||
                      customPronouns ||
                      ([
                            "she/her",
                            "he/him",
                            "they/them",
                            "xe/xem",
                            "ze/zir",
                            "per/per",
                            "sie/hir",
                            "em/emself",
                            "ey/em",
                            "hu/hum",
                            "she/they",
                            "he/they",
                            "any pronouns",
                            "ask me",
                            "prefer not to answer",
                          ].includes(user.pronouns || "") === false &&
                        !user.pronouns && customPronouns === "")
                    ? (
                      <input
                        type="text"
                        value={customPronouns || user.pronouns || ""}
                        onInput={(event) => {
                          const value =
                            (event.target as HTMLInputElement).value;
                          setCustomPronouns(value);
                          handleProfileUpdate({ pronouns: value });
                        }}
                        placeholder="Enter your pronouns (e.g. fae/faem, ve/ver)..."
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 mt-2"
                      />
                    )
                    : null}
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <LucideIcon icon={SafeIcons.Calendar} size={12} />{" "}
                    Birth Date
                  </label>
                  <input
                    type="date"
                    value={user.birthDate || ""}
                    onInput={(event) =>
                      handleProfileUpdate({
                        birthDate: (event.target as HTMLInputElement).value,
                      })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                    style={{ colorScheme: "dark" }}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={user.occupation || ""}
                    onInput={(event) =>
                      handleProfileUpdate({
                        occupation: (event.target as HTMLInputElement).value,
                      })}
                    placeholder="e.g. Product Designer"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <LucideIcon icon={SafeIcons.Clock} size={12} /> Timezone
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <select
                        value={user.timezone || ""}
                        onChange={(event) => {
                          handleProfileUpdate({
                            timezone: (event.target as HTMLSelectElement).value,
                          });
                          setShowTimezoneDropdown(false);
                          setTimezoneSearch("");
                        }}
                        onFocus={() => setShowTimezoneDropdown(true)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 cursor-pointer appearance-none pr-10"
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a5a5a5' d='M3 5l3 3 3-3'/%3E%3C/svg%3E\")",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 0.7rem center",
                          paddingRight: "2rem",
                        }}
                      >
                        <option value="">Select timezone...</option>
                        {IANA_TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const detected = getDetectedTimezone();
                        if (detected) {
                          handleProfileUpdate({ timezone: detected });
                        }
                      }}
                      className="px-3 py-2 bg-canvas-primary/20 border border-canvas-primary/45 hover:bg-canvas-primary/30 rounded-xl text-canvas-primary text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 whitespace-nowrap"
                      title="Auto-detect timezone from your device"
                    >
                      <LucideIcon icon={SafeIcons.Zap} size={14} />
                      Auto-detect
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <LucideIcon icon={SafeIcons.Globe} size={12} /> Website
                  </label>
                  <input
                    type="url"
                    value={user.website || ""}
                    onInput={(event) =>
                      handleProfileUpdate({
                        website: (event.target as HTMLInputElement).value,
                      })}
                    placeholder="https://your-site.com"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-white">
                    Social Handles & Links
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Add Instagram, X, LinkedIn, GitHub, portfolio, or any public
                    profile.
                  </p>
                </div>

                {user.links.length > 0 && (
                  <div className="space-y-2">
                    {user.links.map((
                      link: UserModel["links"][number],
                      index: number,
                    ) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-2 p-3 rounded-xl bg-black/30 border border-white/10"
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 hover:opacity-90 transition"
                        >
                          <p className="text-sm text-white truncate">
                            {link.title}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {link.url}
                          </p>
                        </a>
                        <button
                          type="button"
                          onClick={() => removeLink(index)}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-rose-300 hover:border-rose-300/40 transition"
                        >
                          <LucideIcon icon={SafeIcons.Trash2} size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(event) => handleAddSocialLink(event)}
                  className="grid md:grid-cols-[1fr_1.4fr_auto] gap-2"
                >
                  <input
                    type="text"
                    value={newLinkTitle}
                    onInput={(event) =>
                      setNewLinkTitle((event.target as HTMLInputElement).value)}
                    placeholder="Platform"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                  />
                  <div className="relative">
                    <LucideIcon
                      icon={SafeIcons.Link2}
                      size={12}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type="text"
                      value={newLinkUrl}
                      onInput={(event) =>
                        setNewLinkUrl((event.target as HTMLInputElement).value)}
                      placeholder="profile URL"
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LucideIcon icon={SafeIcons.Plus} size={12} /> Add
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}

        {activeTab === "appearance" && (
          <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
              Appearance
            </h3>

            {/* Theme Selection – 4 themes */}
            <div>
              <label className="text-xs text-gray-400 block mb-2">Theme</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {THEME_OPTIONS.map((theme) => {
                  const Icon = theme.icon;
                  return (
                    <button
                      type="button"
                      key={theme.value}
                      onClick={() =>
                        setAppearance((current) => ({
                          ...current,
                          theme: theme.value,
                        }))}
                      className={`px-3 py-2.5 text-xs rounded-xl transition-all duration-200 ${
                        appearance.theme === theme.value
                          ? "bg-white text-black shadow-lg scale-[1.02]"
                          : "bg-white/10 text-white hover:bg-white/15"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <LucideIcon icon={Icon} size={14} /> {theme.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent Color – Presets + Custom */}
            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Accent Color
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {ACCENT_OPTIONS.map((accent) => (
                  <button
                    type="button"
                    key={accent.value}
                    onClick={() => {
                      setAppearance((current) => ({
                        ...current,
                        accentColor: accent.value,
                        customAccentHex: "",
                      }));
                      setAccentColor(accent.value);
                      setShowCustomAccentPicker(false);
                    }}
                    className={`w-8 h-8 rounded-full ${accent.className} transition-all hover:scale-110 active:scale-95 cursor-pointer ${
                      appearance.accentColor === accent.value &&
                        !customAccentHexSignal.value
                        ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                        : ""
                    }`}
                  >
                    <span className="sr-only">{accent.value}</span>
                  </button>
                ))}

                {/* Custom color toggle */}
                <button
                  type="button"
                  onClick={() =>
                    setShowCustomAccentPicker(!showCustomAccentPicker)}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center ${
                    showCustomAccentPicker || customAccentHexSignal.value
                      ? "border-white scale-110 shadow-lg"
                      : "border-white/30"
                  }`}
                  style={{
                    background:
                      "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                  }}
                  title="Custom accent color"
                >
                  <LucideIcon
                    icon={SafeIcons.Plus}
                    size={12}
                    className="text-white drop-shadow-md"
                  />
                </button>
              </div>

              {/* Custom HSL Color Picker */}
              {showCustomAccentPicker && (
                <div className="space-y-4 bg-white/5 rounded-2xl p-5 border border-white/10">
                  {/* Hue Selector Strip */}
                  <div>
                    <div
                      className="w-full h-7 rounded-lg overflow-hidden mb-2 border border-white/10 shadow-lg"
                      style={{
                        background:
                          `linear-gradient(to right, hsl(0,100%,60%), hsl(30,100%,60%), hsl(60,100%,60%), hsl(90,100%,60%), hsl(120,100%,60%), hsl(150,100%,60%), hsl(180,100%,60%), hsl(210,100%,60%), hsl(240,100%,60%), hsl(270,100%,60%), hsl(300,100%,60%), hsl(330,100%,60%), hsl(360,100%,60%))`,
                      }}
                    >
                      <div
                        className="w-1 h-full bg-white border-l border-r border-white shadow pointer-events-none"
                        style={{
                          marginLeft: `${(customHue / 360) * 100}%`,
                        }}
                      />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={customHue}
                      onInput={(e) => {
                        const v = Number(
                          (e.target as HTMLInputElement).value,
                        );
                        setCustomHueState(v);
                        const hex = hslToHex(v, customSat, customLight);
                        setCustomAccentHex(hex);
                        setAppearance((c) => ({
                          ...c,
                          customAccentHex: hex,
                        }));
                      }}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-canvas-primary"
                    />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                      Slide to choose hue
                    </p>
                  </div>

                  {/* Saturation */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Saturation
                      </label>
                      <span className="text-[10px] font-bold text-canvas-primary">
                        {customSat}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={customSat}
                      onInput={(e) => {
                        const v = Number(
                          (e.target as HTMLInputElement).value,
                        );
                        setCustomSatState(v);
                        const hex = hslToHex(customHue, v, customLight);
                        setCustomAccentHex(hex);
                        setAppearance((c) => ({
                          ...c,
                          customAccentHex: hex,
                        }));
                      }}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-canvas-primary"
                    />
                  </div>

                  {/* Lightness */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Lightness
                      </label>
                      <span className="text-[10px] font-bold text-canvas-primary">
                        {customLight}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      value={customLight}
                      onInput={(e) => {
                        const v = Number(
                          (e.target as HTMLInputElement).value,
                        );
                        setCustomLightState(v);
                        const hex = hslToHex(customHue, customSat, v);
                        setCustomAccentHex(hex);
                        setAppearance((c) => ({
                          ...c,
                          customAccentHex: hex,
                        }));
                      }}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-canvas-primary"
                    />
                  </div>

                  {/* Color Preview */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 rounded-xl border border-white/20 shadow-lg"
                      style={{
                        backgroundColor: hslToHex(
                          customHue,
                          customSat,
                          customLight,
                        ),
                      }}
                    />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Preview
                      </p>
                      <p className="text-sm font-mono text-gray-300 mt-1">
                        {hslToHex(customHue, customSat, customLight)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Font Size */}
            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Font Size
              </label>
              <div className="flex gap-2">
                {FONT_SIZE_OPTIONS.map((fontOption) => (
                  <button
                    key={fontOption.value}
                    type="button"
                    onClick={() =>
                      setAppearance((current) => ({
                        ...current,
                        fontSize: fontOption.value,
                      }))}
                    className={`flex-1 p-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-all ${
                      appearance.fontSize === fontOption.value
                        ? "bg-white text-black"
                        : "bg-white/10 text-white hover:bg-white/15"
                    }`}
                  >
                    <LucideIcon icon={SafeIcons.Type} size={fontOption.size} />
                    {" "}
                    {fontOption.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Display Toggles – wired to data-attributes */}
            <div className="grid md:grid-cols-2 gap-3">
              {[
                {
                  key: "compactMode",
                  label: "Compact Mode",
                  desc: "Tighten spacing across the interface",
                },
                {
                  key: "animations",
                  label: "Animations",
                  desc: "Enable smooth transitions and effects",
                },
                {
                  key: "reduceMotion",
                  label: "Reduce Motion",
                  desc: "Minimize movement for accessibility",
                },
              ].map((toggle) => {
                const key = toggle.key as keyof Pick<
                  AppearanceSettings,
                  "compactMode" | "animations" | "reduceMotion"
                >;
                const enabled = appearance[key];
                return (
                  <div
                    key={toggle.key}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
                  >
                    <div>
                      <span className="text-sm text-gray-300">
                        {toggle.label}
                      </span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {toggle.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !enabled;
                        setAppearance((current) => ({
                          ...current,
                          [key]: next,
                        }));
                        setAppearanceAttribute(key, next);
                      }}
                      className={`w-10 h-5 rounded-full transition flex-shrink-0 ${
                        enabled ? "bg-white" : "bg-white/20"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-black transition-transform ${
                          enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "notifications" && (
          <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
              Notifications
            </h3>
            <div className="space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  {
                    key: "emailNotifications",
                    label: "Email Notifications",
                    icon: SafeIcons.Mail,
                    comingSoon: true,
                  },
                  {
                    key: "pushNotifications",
                    label: "Push Notifications",
                    icon: SafeIcons.Smartphone,
                    comingSoon: true,
                  },
                  {
                    key: "inAppNotifications",
                    label: "In-App Notifications",
                    icon: SafeIcons.Bell,
                    comingSoon: false,
                  },
                ].map((toggle) => {
                  const key = toggle.key as keyof Pick<
                    NotificationSettings,
                    | "emailNotifications"
                    | "pushNotifications"
                    | "inAppNotifications"
                  >;
                  const Icon = toggle.icon;
                  const enabled = notifications[key];
                  return (
                    <div
                      key={toggle.key}
                      className={`flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 ${
                        toggle.comingSoon ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <LucideIcon
                          icon={Icon}
                          size={14}
                          className="text-gray-400"
                        />
                        <span className="text-sm text-gray-300">
                          {toggle.label}
                        </span>
                        {toggle.comingSoon && (
                          <span className="text-[8px] font-bold uppercase tracking-widest bg-white/10 text-gray-400 px-1.5 py-0.5 rounded-md">
                            Soon
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setNotifications((current) => ({
                            ...current,
                            [key]: !current[key],
                          }))}
                        className={`w-10 h-5 rounded-full transition ${
                          enabled ? "bg-white" : "bg-white/20"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-black transition-transform ${
                            enabled ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-white/10 pt-4 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-widest">
                  Notify me about
                </p>
                {NOTIFICATION_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const enabled = notifications[option.key];
                  return (
                    <div
                      key={option.key}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 opacity-60"
                    >
                      <div className="pr-4">
                        <div className="flex items-center gap-2">
                          <LucideIcon
                            icon={Icon}
                            size={14}
                            className="text-gray-400"
                          />
                          <span className="text-sm text-gray-300">
                            {option.label}
                          </span>
                          <span className="text-[8px] font-bold uppercase tracking-widest bg-white/10 text-gray-400 px-1.5 py-0.5 rounded-md">
                            Soon
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {option.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setNotifications((current) => ({
                            ...current,
                            [option.key]: !current[option.key],
                          }))}
                        className={`w-10 h-5 rounded-full transition ${
                          enabled ? "bg-white" : "bg-white/20"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-black transition-transform ${
                            enabled ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {activeTab === "privacy" && (
          <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
              Privacy & Security
            </h3>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <div>
                <p className="text-sm text-gray-300 flex items-center gap-2">
                  <LucideIcon
                    icon={SafeIcons.Globe}
                    size={14}
                    className="text-gray-400"
                  />{" "}
                  Account Visibility
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  {user.privacySecurity.accountVisibility === "public"
                    ? "Anyone can see your profile and content"
                    : "Only approved followers can see your content"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updatePrivacySecurity({
                    accountVisibility:
                      user.privacySecurity.accountVisibility === "public"
                        ? "private"
                        : "public",
                  })}
                className={`px-3 py-1 text-xs rounded-lg transition ${
                  user.privacySecurity.accountVisibility === "public"
                    ? "bg-white text-black"
                    : "bg-white/10 text-white"
                }`}
              >
                {user.privacySecurity.accountVisibility === "public"
                  ? "Public"
                  : "Private"}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-sm text-gray-300 flex items-center gap-2">
                <LucideIcon
                  icon={SafeIcons.Mail}
                  size={14}
                  className="text-gray-400"
                />{" "}
                Show email on profile
              </span>
              <button
                type="button"
                onClick={() =>
                  updatePrivacySecurity({
                    showEmailInProfile: !user.privacySecurity
                      .showEmailInProfile,
                  })}
                className={`w-10 h-5 rounded-full transition ${
                  user.privacySecurity.showEmailInProfile
                    ? "bg-white"
                    : "bg-white/20"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform ${
                    user.privacySecurity.showEmailInProfile
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-sm text-gray-300 flex items-center gap-2">
                <LucideIcon
                  icon={SafeIcons.Eye}
                  size={14}
                  className="text-gray-400"
                />{" "}
                Allow search indexing
              </span>
              <button
                type="button"
                onClick={() =>
                  updatePrivacySecurity({
                    allowSearchIndexing: !user.privacySecurity
                      .allowSearchIndexing,
                  })}
                className={`w-10 h-5 rounded-full transition ${
                  user.privacySecurity.allowSearchIndexing
                    ? "bg-white"
                    : "bg-white/20"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform ${
                    user.privacySecurity.allowSearchIndexing
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <div>
                <p className="text-sm text-gray-300 flex items-center gap-2">
                  <LucideIcon
                    icon={SafeIcons.Key}
                    size={14}
                    className="text-gray-400"
                  />{" "}
                  Two-Factor Authentication
                </p>
                <p className="text-[10px] text-gray-500">
                  Add an extra layer of security
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (user.privacySecurity.twoFactorEnabled) {
                    // Turn it off directly
                    updatePrivacySecurity({ twoFactorEnabled: false });
                  } else {
                    // Open setup modal
                    setIsTwoFactorModalOpen(true);
                  }
                }}
                className={`px-3 py-1 text-xs rounded-lg transition ${
                  user.privacySecurity.twoFactorEnabled
                    ? "bg-emerald-600 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {user.privacySecurity.twoFactorEnabled ? "Enabled" : "Enable"}
              </button>
            </div>

            <div className="pt-1 border-t border-white/10 space-y-3">
              {([
                { key: "showProfile", label: "Show profile" },
                { key: "showLocation", label: "Show location" },
                { key: "showRooms", label: "Show rooms" },
                { key: "showThreads", label: "Show threads" },
                { key: "showInsights", label: "Show insights" },
              ] as const).map((setting) => {
                const enabled = user.publicSettings[setting.key];
                return (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
                  >
                    <span className="text-sm text-gray-300">
                      {setting.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePublicSetting(setting.key)}
                      className={`w-10 h-5 rounded-full transition ${
                        enabled ? "bg-white" : "bg-white/20"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-black transition-transform ${
                          enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                <span className="text-sm text-gray-300">Solo Mode</span>
                <button
                  type="button"
                  onClick={toggleSoloMode}
                  className={`w-10 h-5 rounded-full transition ${
                    soloMode ? "bg-white" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-black transition-transform ${
                      soloMode ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === "data" && (
          <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
              Data Management
            </h3>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-sm text-gray-300">Total data stored</span>
              <span className="text-sm text-white font-medium">
                {getApproxDataSize()}
              </span>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Export Format
              </label>
              <div className="flex gap-2">
                {(["json", "csv"] as const).map((format) => (
                  <button
                    type="button"
                    key={format}
                    onClick={() =>
                      setDataSettings((current) => ({
                        ...current,
                        exportFormat: format,
                      }))}
                    className={`px-3 py-1.5 text-xs rounded-lg transition uppercase ${
                      dataSettings.exportFormat === format
                        ? "bg-white text-black"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={exportData}
                className="flex items-center justify-center gap-2 py-3 text-sm bg-white/10 border border-white/10 rounded-xl text-white hover:bg-white/20 transition"
              >
                <LucideIcon icon={SafeIcons.Download} size={14} /> Export Data
              </button>

              <button
                type="button"
                onClick={resetLocalPreferences}
                className="flex items-center justify-center gap-2 py-3 text-sm bg-white/10 border border-white/10 rounded-xl text-white hover:bg-white/20 transition"
              >
                <LucideIcon icon={SafeIcons.RotateCcw} size={14} />{" "}
                Reset Preferences
              </button>
            </div>

            <div className="border-t border-red-500/20 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <LucideIcon
                  icon={SafeIcons.Trash2}
                  size={14}
                  className="text-red-400"
                />
                <span className="text-xs text-red-400 font-medium uppercase tracking-widest">
                  Danger Zone
                </span>
              </div>
              <button
                type="button"
                onClick={clearAllData}
                className="w-full py-3 border border-red-500/40 rounded-xl text-red-300 hover:bg-red-500/10 transition"
              >
                Delete All Data
              </button>
              <p className="text-[10px] text-gray-500 text-center">
                This removes local settings and sends you back to sign in. It
                does not affect server-side backups.
              </p>
            </div>

            <p className="text-[11px] text-gray-500">
              Last export: {dataSettings.lastExport
                ? new Date(dataSettings.lastExport).toLocaleString()
                : "Never"}
            </p>
          </section>
        )}
      </div>

      <TwoFactorModal
        isOpen={isTwoFactorModalOpen}
        onClose={() => setIsTwoFactorModalOpen(false)}
        onSuccess={() => {
          setIsTwoFactorModalOpen(false);
          updatePrivacySecurity({ twoFactorEnabled: true });
        }}
        themeColor={appearance.customAccentHex}
      />
    </div>
  );
}
