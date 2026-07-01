import * as Icons from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import LogoModal from "./LogoModal.tsx";
import {
  soloModeSignal,
  toggleSoloMode,
  userSignal,
} from "../../signals/user.ts";
import { resonanceModeSignal } from "../../signals/resonance.ts";
import {
  appThemeSignal,
  closeNotifications,
  initializeTheme,
  isNotificationsOpenSignal,
  toggleMenu,
  toggleNotifications,
  toggleTheme,
} from "../../signals/ui.ts";
import {
  markAllAsRead,
  markAsRead,
  notificationSignal,
} from "../../signals/notifications.ts";

const { Moon, Circle, CloudSun, Sun, Bell, Menu } = Icons as unknown as Record<
  string,
  import("preact").ComponentType<unknown>
>;

export const prerender = false;
export default function AppHeader(
  { currentPath: _currentPath }: { currentPath?: string },
) {
  const isNotificationsOpen = isNotificationsOpenSignal.value;
  const currentTheme = appThemeSignal.value;
  const { notifications, unreadCount } = notificationSignal.value;
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const [showLogoModal, setShowLogoModal] = useState(false);

  useEffect(() => {
    initializeTheme();
  }, []);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!notificationPanelRef.current?.contains(target)) {
        closeNotifications();
      }
    };

    globalThis.document?.addEventListener("mousedown", handleClickOutside);
    return () => {
      globalThis.document?.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotificationsOpen]);

  const user = userSignal.value;
  const isSoloMode = soloModeSignal.value;
  const isDemo = user?.email === "demo@muse.app";
  const resonanceMode = resonanceModeSignal.value;
  const isHidden = resonanceMode === "deep" || resonanceMode === "cinematic";

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-50 bg-[var(--muse-overlay)] backdrop-blur-3xl border-b border-[var(--muse-border)] transition-all duration-700 ease-in-out ${
          isDemo ? "pt-8" : ""
        } ${
          isHidden
            ? "-translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        }`}
      >
        {isDemo && (
          <div className="absolute top-0 left-0 w-full h-8 bg-canvas-primary/10 border-b border-canvas-primary/20 flex items-center justify-center gap-4 px-6 overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-canvas-primary animate-pulse">
              Observer Mode: Limited Persistence
            </p>
            <div className="h-3 w-px bg-canvas-primary/20" />
            <button
              type="button"
              onClick={() => globalThis.location.href = "/"}
              className="text-[9px] font-bold uppercase tracking-widest text-[var(--muse-text)] hover:text-canvas-primary transition-colors cursor-pointer"
            >
              Register to Establish Soul Link
            </button>
          </div>
        )}
        <div className="flex items-center justify-between px-6 md:px-10 h-20">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setShowLogoModal(true)}
              className="cursor-pointer flex items-center gap-3 group text-left"
            >
              <div className="w-10 h-10 bg-[var(--muse-text)] rounded-2xl flex items-center justify-center text-[var(--muse-bg)] font-bold group-hover:rotate-12 transition-all duration-500 shadow-2xl">
                <Icons.Infinity size={22} strokeWidth={2.5} />
              </div>
              <span className="text-xl font-bold tracking-tight text-[var(--muse-text)] leading-none transition-colors duration-300">
                Muse
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            {/* Network Mode Toggle */}
            <button
              type="button"
              onClick={toggleSoloMode}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 border rounded-full transition-all duration-300 cursor-pointer ${
                isSoloMode
                  ? "bg-[var(--muse-surface-soft)] border-[var(--muse-border)] text-[var(--muse-muted)] hover:text-[var(--muse-text)]"
                  : "bg-canvas-primary/10 border-canvas-primary/30 text-[var(--muse-text)] drop-shadow-[0_0_8px_rgba(var(--muse-accent-rgb),0.5)] hover:bg-canvas-primary/20"
              }`}
            >
              {isSoloMode
                ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--muse-muted)]" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">
                      Solo Mode
                    </span>
                  </>
                )
                : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-canvas-primary animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-canvas-primary">
                      Community
                    </span>
                  </>
                )}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-[var(--muse-surface)] border border-[var(--muse-border)] hover:border-[var(--muse-text)]/20 flex items-center justify-center transition-all text-[var(--muse-muted)] hover:text-[var(--muse-text)] duration-300"
              title={`Switch to next theme (Current: ${currentTheme})`}
            >
              {currentTheme === "dark" && (Moon ? <Moon size={16} /> : null)}
              {currentTheme === "dim" &&
                (Circle ? <Circle size={16} fill="currentColor" /> : null)}
              {currentTheme === "tint" &&
                (CloudSun ? <CloudSun size={16} /> : null)}
              {currentTheme === "light" &&
                (Sun ? <Sun size={16} fill="currentColor" /> : null)}
            </button>

            <div className="relative" ref={notificationPanelRef}>
              <button
                type="button"
                onClick={toggleNotifications}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all relative ${
                  unreadCount > 0
                    ? "bg-canvas-primary/20 border border-canvas-primary/45"
                    : "bg-[var(--muse-surface)] border border-[var(--muse-border)] hover:border-[var(--muse-text)]/20 duration-300"
                }`}
              >
                {Bell
                  ? (
                    <Bell
                      size={16}
                      className={unreadCount > 0
                        ? "text-canvas-primary"
                        : "text-[var(--muse-muted)]"}
                    />
                  )
                  : null}
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-canvas-primary border-2 border-[var(--muse-bg)]" />
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-4 w-[340px] rounded-[2.5rem] border border-[var(--muse-border)] bg-[var(--muse-surface)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 transition-colors duration-300">
                  <div className="px-6 py-5 border-b border-[var(--muse-border)] flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-canvas-primary">
                      Signals
                    </h4>
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-[9px] font-bold uppercase text-[var(--muse-muted)] hover:text-[var(--muse-text)] transition-colors duration-300"
                    >
                      Dismiss All
                    </button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0
                      ? (
                        <div className="p-10 text-center text-[var(--muse-muted)] text-xs italic">
                          No active signals.
                        </div>
                      )
                      : notifications.map((n) => (
                        <button
                          type="button"
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className="w-full p-6 text-left border-b border-[var(--muse-border)] hover:bg-[var(--muse-surface-soft)] transition-colors duration-300"
                        >
                          <p className="text-sm font-bold text-[var(--muse-text)] mb-1">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-[var(--muse-muted)] leading-relaxed">
                            {n.message}
                          </p>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={toggleMenu}
              type="button"
              className="w-10 h-10 rounded-full bg-[var(--muse-surface)] border border-[var(--muse-border)] flex items-center justify-center text-[var(--muse-muted)] hover:text-[var(--muse-text)] hover:border-canvas-primary transition-all shadow-lg active:scale-95 duration-300"
            >
              {Menu ? <Menu size={18} /> : null}
            </button>
          </div>
        </div>
      </header>
      {showLogoModal && <LogoModal onClose={() => setShowLogoModal(false)} />}
    </>
  );
}
