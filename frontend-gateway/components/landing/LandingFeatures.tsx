import * as Icons from "lucide-preact";

const PHASES = [
  {
    icon: Icons.Compass,
    color: "text-white/70",
    bg: "bg-white/10",
    title: "Consume",
    subtitle: "What you take in",
    description:
      "Connect your platforms — Spotify, TikTok, Pinterest, YouTube, Twitter. Muse sees everything you save, watch, and listen to.",
    stat: "7+ platforms",
  },
  {
    icon: Icons.Brain,
    color: "text-white/70",
    bg: "bg-white/10",
    title: "Contemplate",
    subtitle: "What it reveals",
    description:
      "Muse finds the patterns across platforms. Your aesthetic, your themes, your intellectual diet — the self no single algorithm sees.",
    stat: "156K patterns discovered",
  },
  {
    icon: Icons.PenTool,
    color: "text-white/70",
    bg: "bg-white/10",
    title: "Create",
    subtitle: "What you make",
    description:
      "Start with your own voice already primed. Your themes, your aesthetic, your language — creation becomes inevitable.",
    stat: "Create with yourself",
  },
];

const FEATURES = [
  {
    icon: Icons.Compass,
    color: "text-white/70",
    bg: "bg-white/10",
    title: "Aggregate Everything",
    description:
      "Connect Spotify, TikTok, Pinterest, YouTube, Twitter. Muse sees what you consume across all platforms.",
  },
  {
    icon: Icons.Network,
    color: "text-white/70",
    bg: "bg-white/10",
    title: "Find Your Patterns",
    description:
      "Discover the meta-themes, aesthetics, and tensions that run through everything you save and watch.",
  },
  {
    icon: Icons.Eye,
    color: "text-white/70",
    bg: "bg-white/10",
    title: "Know Yourself Honestly",
    description:
      "Your consumption fingerprint doesn't lie. Muse shows you who you actually are, not who you perform.",
  },
  {
    icon: Icons.PenTool,
    color: "text-white/70",
    bg: "bg-white/10",
    title: "Create From Yourself",
    description:
      "Start writing, making, or sharing with your own voice, aesthetic, and themes already primed.",
  },
  {
    icon: Icons.Share2,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    title: "Share Your Portrait",
    description:
      "Your Muse Card — one link that shows your sonic, visual, intellectual, and creative identity.",
  },
  {
    icon: Icons.Shield,
    color: "text-white/70",
    bg: "bg-white/10",
    title: "Privacy First",
    description:
      "Your data stays yours. You control exactly what becomes visible in your public portrait.",
  },
];

const FEATURED_INSIGHTS = [
  {
    title: "You return to melancholy themes",
    type: "Emotional",
    plays: "268K",
  },
  { title: "Brutalist visual aesthetic", type: "Visual", plays: "106K" },
  { title: "Consciousness & AI ethics", type: "Intellectual", plays: "110K" },
  { title: "Ambient soundscapes", type: "Sonic", plays: "264K" },
  { title: "Temporal fascination", type: "Theme", plays: "375K" },
  { title: "Analog nostalgia", type: "Aesthetic", plays: "129K" },
  { title: "Solitude as creative fuel", type: "Psychological", plays: "386K" },
  { title: "Systems thinking", type: "Cognitive", plays: "87K" },
];

const TESTIMONIALS = [
  {
    quote: "Muse showed me patterns I'd been living for years but never saw.",
    author: "Dr. Sarah Chen",
    role: "Cognitive Scientist",
    rating: 5,
  },
  {
    quote: "I thought I knew my taste. Muse proved me wrong.",
    author: "Marcus Thompson",
    role: "Creative Director",
    rating: 5,
  },
  {
    quote:
      "Finally, a tool that helps me understand myself instead of just feeding me more content.",
    author: "Elena Rodriguez",
    role: "Writer & Artist",
    rating: 5,
  },
];

interface FeatureCardProps {
  feature: typeof FEATURES[0];
}

function FeatureCard({ feature }: FeatureCardProps) {
  const Icon = feature.icon;

  return (
    <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all duration-500 cursor-default backdrop-blur-sm hover:shadow-lg">
      <div
        className={`absolute -top-20 -right-20 w-40 h-40 ${feature.bg} blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700`}
      />
      <div
        className={`w-10 h-10 ${feature.bg} rounded-xl flex items-center justify-center mb-4`}
      >
        <Icon size={20} className={feature.color} />
      </div>
      <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
        {feature.title}
      </h3>
      <p className="text-gray-400 text-sm leading-relaxed">
        {feature.description}
      </p>
    </div>
  );
}

interface PhaseCardProps {
  phase: typeof PHASES[0];
}

function PhaseCard({ phase }: PhaseCardProps) {
  const Icon = phase.icon;

  return (
    <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all duration-500 text-center backdrop-blur-sm hover:shadow-lg hover:translate-y-[-5px]">
      <div
        className={`w-14 h-14 ${phase.bg} rounded-2xl flex items-center justify-center mx-auto mb-4`}
      >
        <Icon size={26} className={phase.color} />
      </div>
      <h3 className={`text-xl font-bold mb-1 ${phase.color}`}>{phase.title}</h3>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">
        {phase.subtitle}
      </p>
      <p className="text-gray-400 text-sm leading-relaxed mb-4">
        {phase.description}
      </p>
      <p className="text-[10px] font-mono text-gray-600">{phase.stat}</p>
    </div>
  );
}

export default function LandingFeatures() {
  return (
    <>
      {/* Three Phases */}
      <section className="py-28 px-6 md:px-12 max-w-6xl mx-auto z-20 relative">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 mb-4">
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">
              The Creative Loop
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Consume → Contemplate → Create
          </h2>
          <p className="text-gray-500 text-base max-w-lg mx-auto font-serif italic">
            Muse sits in the middle. Where self-knowledge lives.
          </p>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {PHASES.map((phase) => <PhaseCard key={phase.title} phase={phase} />)}
        </div>
      </section>

      {/* Features */}
      <section
        id="demo-preview"
        className="py-20 px-6 md:px-12 max-w-6xl mx-auto z-20 relative"
      >
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Everything you need to know yourself
          </h2>
          <p className="text-gray-500 text-base max-w-lg mx-auto font-serif italic mt-2">
            Muse isn't another algorithm. It's your honest mirror.
          </p>
        </div>
        <div className="flex gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </section>

      {/* Featured Insights */}
      <section className="py-20 px-6 md:px-12 max-w-6xl mx-auto z-20 relative">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 mb-4">
            <Icons.Brain size={12} className="text-white/70" />
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">
              Real patterns from real users
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            What your consumption reveals
          </h2>
          <p className="text-gray-500 text-base max-w-lg mx-auto font-serif italic mt-2">
            Muse finds what no single algorithm can see
          </p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {FEATURED_INSIGHTS.map((insight) => (
            <div
              key={insight.title}
              className="min-w-[220px] md:min-w-[240px] snap-start p-4 rounded-xl bg-gradient-to-br from-white/[0.02] to-white/[0.01] border border-white/5 hover:border-white/30 transition-all cursor-pointer group backdrop-blur-sm hover:shadow-lg hover:translate-y-[-5px]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono text-gray-600">
                  {insight.plays}
                </span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">
                  {insight.type}
                </span>
              </div>
              <p className="text-sm font-semibold text-white mb-1 leading-tight">
                {insight.title}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Muse Card Preview */}
      <section className="py-20 px-6 md:px-12 max-w-6xl mx-auto z-20 relative">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/20 via-white/10 to-transparent border border-white/30 p-8 md:p-12 backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/20 blur-[100px] rounded-full opacity-30" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/20 blur-[100px] rounded-full opacity-20" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <Icons.Share2 size={24} className="text-white/70" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                Your Muse Card
              </span>
            </div>
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
                  One link that shows<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/70 to-white/70">
                    who you actually are.
                  </span>
                </h2>
                <p className="text-gray-400 font-serif italic text-sm leading-relaxed mb-6">
                  Not a highlight reel. Not a curated performance. Your Muse
                  Card shows your sonic fingerprint, visual aesthetic,
                  intellectual diet — the honest portrait.
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                    <Icons.Music size={10} className="text-white/70" />
                    <span className="text-[10px]">Ambient / Melancholy</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                    <Icons.Image size={10} className="text-white/70" />
                    <span className="text-[10px]">Brutalist / Analog</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                    <Icons.Brain size={10} className="text-white/70" />
                    <span className="text-[10px]">Consciousness / Systems</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-white flex items-center justify-center">
                      <span className="text-white font-bold text-[10px]">
                        M
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Your Muse Card</p>
                      <p className="text-[9px] text-gray-500">
                        muse.me/yourname
                      </p>
                    </div>
                  </div>
                  <Icons.Share2 size={12} className="text-gray-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icons.Music size={12} className="text-white/70" />
                    <span className="text-[10px] text-gray-400">
                      Sonic fingerprint:
                    </span>
                    <span className="text-[10px] text-white">
                      Ambient, Melancholy
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icons.Image size={12} className="text-white/70" />
                    <span className="text-[10px] text-gray-400">
                      Visual aesthetic:
                    </span>
                    <span className="text-[10px] text-white">
                      Brutalist, Analog
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icons.BookOpen size={12} className="text-white/70" />
                    <span className="text-[10px] text-gray-400">
                      Intellectual diet:
                    </span>
                    <span className="text-[10px] text-white">
                      Consciousness, Systems
                    </span>
                  </div>
                  <div className="h-px bg-white/10 my-2" />
                  <p className="text-[11px] text-gray-500 italic">
                    "You return to melancholy themes. Your visual taste favors
                    structure."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 md:px-12 max-w-6xl mx-auto z-20 relative">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Trusted by creators, thinkers, and the curious
          </h2>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="min-w-[260px] md:min-w-[300px] snap-start p-6 rounded-xl bg-gradient-to-br from-white/[0.02] to-white/[0.01] border border-white/5 hover:border-white/30 transition-all backdrop-blur-sm hover:shadow-lg hover:translate-y-[-5px]"
            >
              <div className="flex gap-1 mb-3">
                {[...Array(t.rating)].map((_, j) => (
                  <Icons.Star
                    key={j}
                    size={12}
                    className="text-white/70 fill-white/70"
                  />
                ))}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed mb-4 italic">
                "{t.quote}"
              </p>
              <p className="text-xs font-semibold text-white">{t.author}</p>
              <p className="text-[10px] text-gray-500">{t.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-20 z-20 relative">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 mb-6">
            <Icons.Zap size={10} className="text-white/70" />
            <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider">
              Limited early access
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto leading-tight mb-4">
            Stop performing.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/70 via-white/70 to-white/70">
              Start knowing.
            </span>
          </h2>
          <p className="text-gray-500 text-base max-w-lg mx-auto mb-8 font-serif italic">
            Join the waitlist. Be among the first to see your honest portrait.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <div className="flex items-center gap-1">
              <Icons.Lock size={12} className="text-gray-600" />
              <span className="text-[10px] text-gray-600">Privacy first</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1">
              <Icons.Fingerprint size={12} className="text-gray-600" />
              <span className="text-[10px] text-gray-600">
                Your data, your control
              </span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1">
              <Icons.Download size={12} className="text-gray-600" />
              <span className="text-[10px] text-gray-600">
                Export your portrait anytime
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-600 text-[10px] font-bold uppercase tracking-wider z-20 relative backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span>Muse — The Honest Portrait</span>
        </div>
        <span className="font-serif italic normal-case text-gray-700 text-[10px]">
          Consume → Contemplate → Create
        </span>
        <div className="flex gap-6">
          <button type="button" className="hover:text-white transition-colors">
            Privacy
          </button>
          <button type="button" className="hover:text-white transition-colors">
            Terms
          </button>
          <button type="button" className="hover:text-white transition-colors">
            @muse
          </button>
        </div>
      </footer>
    </>
  );
}
