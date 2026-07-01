import { useEffect, useState } from "preact/hooks";
import * as Icons from "lucide-preact";

const GLOBAL_STYLES_ID = "muse-spectral-hero-keyframes";

export default function SpectralHero(
  {
    onOpenAuth,
    onWatchDemo,
    onGuestEntry,
  }: {
    onOpenAuth: (mode: "login" | "signup") => void;
    onWatchDemo: () => void;
    onGuestEntry: () => void;
  },
) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(GLOBAL_STYLES_ID)) return;

    const style = document.createElement("style");
    style.id = GLOBAL_STYLES_ID;
    style.textContent = `
      @keyframes spin-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes spin-reverse {
        from { transform: rotate(360deg); }
        to { transform: rotate(0deg); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / globalThis.innerWidth) * 2 - 1;
      const y = (e.clientY / globalThis.innerHeight) * 2 - 1;
      setMousePos({ x: x * 50, y: y * 50 });
    };
    globalThis.addEventListener("mousemove", handleMouseMove);
    requestAnimationFrame(() => setMounted(true));
    return () => globalThis.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const stagger = (i: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(30px)",
    transition: `all 1s cubic-bezier(0.16, 1, 0.3, 1) ${300 + i * 150}ms`,
  });

  return (
    <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* INTERACTIVE BUBBLES */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {[...Array(16)].map((_, i) => (
          <div
            key={`bubble-${i}`}
            className="absolute rounded-full border border-[var(--muse-text)]/10 backdrop-blur-md transition-transform duration-1000 ease-out"
            style={{
              width: `${(i % 5) * 12 + 16}px`,
              height: `${(i % 5) * 12 + 16}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              transform: `translate(${mousePos.x * (i % 3 + 1)}px, ${
                mousePos.y * (i % 4 + 1)
              }px)`,
              background:
                `radial-gradient(circle at top left, var(--muse-text) 0%, transparent 80%)`,
              opacity: 0.04 + (i % 3) * 0.03,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center gap-10">
        {/* THE 3D ORBITAL LOGO / GYROSCOPE */}
        <div
          className="relative w-48 h-48 flex items-center justify-center [perspective:1200px]"
          style={stagger(0)}
        >
          <div
            className="absolute inset-0 flex items-center justify-center [transform-style:preserve-3d] transition-transform duration-200 ease-out"
            style={{
              transform: `rotateX(${-mousePos.y * 0.6}deg) rotateY(${
                mousePos.x * 0.6
              }deg)`,
            }}
          >
            {/* Inner Glow */}
            <div className="absolute w-32 h-32 rounded-full shadow-[0_0_60px_var(--muse-text)] opacity-20 animate-[pulse_4s_ease-in-out_infinite]">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-[var(--muse-text)] to-pink-500 blur-2xl rounded-full" />
            </div>

            {/* 3D Rings */}
            <div className="absolute inset-0 [transform-style:preserve-3d] animate-[spin-slow_20s_linear_infinite]">
              <div className="absolute inset-0 border-2 border-dashed border-[var(--muse-text)]/10 rounded-full [transform:rotateX(75deg)_rotateY(10deg)_scale(1.2)] animate-[spin-reverse_15s_linear_infinite]" />
              <div className="absolute inset-2 border-[1.5px] border-cyan-500/40 rounded-full [transform:rotateX(65deg)_rotateY(45deg)] animate-[spin-slow_12s_linear_infinite]" />
              <div className="absolute inset-4 border border-purple-500/50 rounded-full [transform:rotateX(55deg)_rotateY(135deg)] animate-[spin-reverse_18s_linear_infinite]" />
              <div className="absolute inset-6 border border-[var(--muse-text)]/20 rounded-full [transform:rotateX(80deg)_rotateY(90deg)] animate-[spin-slow_25s_linear_infinite]" />
            </div>

            {/* Central Hub */}
            <div className="absolute w-16 h-16 rounded-full border border-[var(--muse-border)] bg-[var(--muse-surface)]/90 backdrop-blur-2xl flex items-center justify-center shadow-2xl z-20 [transform:translateZ(20px)]">
              <Icons.Infinity
                size={28}
                className="text-[var(--muse-text)] drop-shadow-[0_0_15px_currentColor]"
                strokeWidth={2}
              />
            </div>
          </div>
        </div>

        {/* HEADLINE */}
        <div className="space-y-5 max-w-2xl" style={stagger(1)}>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] text-[var(--muse-text)]">
            Turn Raw Consumption{" "}
            <span className="bg-gradient-to-r from-[var(--muse-text)] via-[var(--muse-muted)] to-canvas-primary bg-clip-text text-transparent">
              into Immutable Insight.
            </span>
          </h1>
          <p className="text-sm md:text-base text-[var(--muse-muted)] font-serif italic max-w-lg mx-auto leading-relaxed">
            A sovereign cognitive loop where scattered signals are captured,
            contemplated, and synthesized into a cryptographic ledger of
            collective wisdom.
          </p>
        </div>

        {/* CTA BUTTONS */}
        <div
          className="flex flex-col sm:flex-row items-center gap-4"
          style={stagger(2)}
        >
          <button
            type="button"
            onClick={() => onOpenAuth("signup")}
            className="group relative px-8 py-4 rounded-full bg-[var(--muse-text)] text-[var(--muse-bg)] text-[11px] font-bold uppercase tracking-widest shadow-2xl hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-95 transition-all cursor-pointer overflow-hidden"
          >
            <div className="absolute inset-0 bg-canvas-primary/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <span className="relative z-10 flex items-center gap-2">
              Begin Your Loop
              <Icons.ArrowRight
                size={14}
                className="group-hover:translate-x-1 transition-transform"
              />
            </span>
          </button>

          <button
            type="button"
            onClick={onWatchDemo}
            className="group px-6 py-4 rounded-full border border-[var(--muse-border)] bg-transparent text-[11px] font-bold uppercase tracking-widest text-[var(--muse-text)] hover:bg-[var(--muse-surface-soft)] hover:border-[var(--muse-text)]/20 transition-all cursor-pointer flex items-center gap-2"
          >
            <Icons.Play size={14} className="text-canvas-primary" />
            Watch Demo
          </button>

          <button
            type="button"
            onClick={onGuestEntry}
            className="group px-6 py-4 rounded-full border border-[var(--muse-border)]/50 bg-transparent text-[11px] font-bold uppercase tracking-widest text-[var(--muse-muted)] hover:text-[var(--muse-text)] hover:border-[var(--muse-border)] transition-all cursor-pointer flex items-center gap-2"
          >
            <Icons.Zap size={14} className="text-amber-400" />
            Guest Access
          </button>
        </div>

        {/* SOCIAL PROOF / STATS */}
        <div className="flex items-center gap-8 mt-4" style={stagger(3)}>
          {[
            { value: "2.4K+", label: "Synthesized" },
            { value: "148", label: "Active Minds" },
            { value: "∞", label: "Potential" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-lg md:text-xl font-bold font-mono text-[var(--muse-text)]">
                {stat.value}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--muse-muted)]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
