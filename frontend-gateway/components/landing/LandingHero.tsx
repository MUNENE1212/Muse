import * as Icons from "lucide-preact";

const TRUST_BADGES = [
  {
    name: "Product Hunt #1",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
  },
  {
    name: "4.9 ★ App Store",
    bg: "bg-white/10",
    text: "text-white/70",
    border: "border-white/20",
  },
  {
    name: "Featured in Wired",
    bg: "bg-white/10",
    text: "text-white/70",
    border: "border-white/20",
  },
  {
    name: "Privacy Certified",
    bg: "bg-white/10",
    text: "text-white/70",
    border: "border-white/20",
  },
];

const WAITLIST_COUNT = 8427;
const PATTERNS_DISCOVERED = 156234;

const PLATFORMS = [
  { name: "Spotify", icon: "🎵" },
  { name: "TikTok", icon: "🎬" },
  { name: "Pinterest", icon: "📌" },
  { name: "YouTube", icon: "▶️" },
  { name: "Twitter", icon: "𝕏" },
  { name: "Instagram", icon: "📷" },
];

interface LandingHeroProps {
  onOpenAuth: (mode: "login" | "signup") => void;
  onWatchDemo: () => void;
}

export default function LandingHero(
  { onOpenAuth, onWatchDemo }: LandingHeroProps,
) {
  return (
    <section className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center relative text-center px-6 py-20 z-20">
      <div className="max-w-4xl">
        {/* Trust Badges */}
        <div className="flex items-center gap-2 mb-8 flex-wrap justify-center">
          {TRUST_BADGES.map((badge) => (
            <span
              key={badge.name}
              className={`px-3 py-1 rounded-full ${badge.bg} ${badge.text} border ${badge.border} text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm`}
            >
              {badge.name}
            </span>
          ))}
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] mx-auto">
          We don't have a<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/70 via-white/70 to-white/70">
            content problem.
          </span>
          <br />
          We have a self-knowledge problem.
        </h1>

        {/* Subheading */}
        <p className="text-base md:text-lg text-gray-500 max-w-xl mx-auto mt-6 font-serif italic leading-relaxed">
          Muse turns your consumption fingerprint into a creative identity.
          Aggregate. Discover. Create from yourself.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10 justify-center">
          <button
            type="button"
            onClick={() => onOpenAuth("signup")}
            className="group px-8 py-4 bg-gradient-to-r from-white to-white text-white font-bold text-sm rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_50px_rgba(99,102,241,0.5)] transition-all cursor-pointer"
          >
            Get Started
            <Icons.ArrowRight
              size={16}
              className="group-hover:translate-x-1 transition-transform"
            />
          </button>
          <button
            type="button"
            onClick={onWatchDemo}
            className="px-8 py-4 bg-white/5 border border-white/10 text-gray-400 font-bold text-sm rounded-full hover:bg-white/10 hover:text-white transition-all cursor-pointer flex items-center gap-2 backdrop-blur-sm"
          >
            <Icons.Play size={14} />
            Watch Demo
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-12 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-white to-white border-2 border-[#050508] flex items-center justify-center"
                >
                  <Icons.Aperture size={10} className="text-white" />
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-500">
              <span className="text-white font-semibold">
                {WAITLIST_COUNT.toLocaleString()}
              </span>+ active users
            </span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1">
            <Icons.Brain size={14} className="text-white/70" />
            <span className="text-xs text-gray-500">
              {PATTERNS_DISCOVERED.toLocaleString()}+ patterns discovered
            </span>
          </div>
        </div>

        {/* Platform Pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
          {PLATFORMS.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm hover:scale-105 transition-transform"
            >
              <span className="text-xs">{p.icon}</span>
              <span className="text-[10px] font-medium text-gray-400">
                {p.name}
              </span>
            </div>
          ))}
          <span className="text-[10px] text-gray-600 ml-2">+ more coming</span>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-700 z-20 animate-bounce">
        <span className="text-[9px] font-bold uppercase tracking-widest">
          Scroll to explore
        </span>
        <Icons.ChevronDown size={14} />
      </div>
    </section>
  );
}
