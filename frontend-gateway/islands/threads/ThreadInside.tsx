import { useMemo, useState } from "preact/hooks";
import * as Icons from "lucide-preact";
import {
  removeItemFromThread,
  threadsSignal,
  toggleArchiveThread,
  toggleFavoriteThread,
  togglePinThread,
  toggleThreadPrivacy,
} from "../../signals/threads.ts";
import { MOOD_OPTIONS, roomsSignal } from "../../signals/rooms.ts";
import { itemsSignal } from "../../signals/items.ts";
import SynthesisWeb from "../../components/threads/SynthesisWeb.tsx";

const moodMapping: Record<string, {
  color: string;
  bg: string;
  text: string;
  aura: string;
}> = {
  focus: {
    color: "indigo",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    aura: "from-indigo-500/40 to-emerald-500/40",
  },
  zen: {
    color: "emerald",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    aura: "from-emerald-400 to-cyan-400",
  },
  chaos: {
    color: "rose",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    aura: "from-rose-500 to-amber-500",
  },
  energetic: {
    color: "amber",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    aura: "from-amber-400 to-rose-400",
  },
  melancholy: {
    color: "violet",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    aura: "from-violet-500/40 to-indigo-500/40",
  },
  dreamy: {
    color: "sky",
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    aura: "from-sky-400/40 to-indigo-400/40",
  },
  noir: {
    color: "slate",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    aura: "from-slate-800 to-black",
  },
  warm: {
    color: "orange",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    aura: "from-orange-500/40 to-amber-500/40",
  },
  electric: {
    color: "fuchsia",
    bg: "bg-fuchsia-500/10",
    text: "text-fuchsia-400",
    aura: "from-fuchsia-500/40 to-rose-500/40",
  },
  minimal: {
    color: "gray",
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    aura: "from-gray-500/20 to-transparent",
  },
  cosmic: {
    color: "purple",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    aura: "from-purple-900 to-indigo-900",
  },
  storm: {
    color: "slate",
    bg: "bg-slate-600/10",
    text: "text-slate-500",
    aura: "from-slate-600 to-slate-800",
  },
};

export default function ThreadInside({ threadId }: { threadId: string }) {
  const thread = threadsSignal.value.find((t) => t.id === threadId);
  const rooms = roomsSignal.value;
  const allItems = itemsSignal.value;
  const items = useMemo(
    () => allItems.filter((i) => thread?.itemIds.includes(i.id)),
    [allItems, thread?.itemIds],
  );

  const [activeTab, setActiveTab] = useState<"synthesis" | "artifacts">(
    "synthesis",
  );
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  if (!thread) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
        <p className="text-2xl font-bold text-white tracking-tight">
          Thread not found.
        </p>
        <a
          href="/threads"
          className="text-gray-400 hover:text-white text-sm underline"
        >
          Back to Threads
        </a>
      </div>
    );
  }

  const mood = moodMapping[thread.mood] || moodMapping["focus"];

  return (
    <div className="pb-24 md:pb-10 min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* MULTI-ROOM AURA */}
      <div
        className={`fixed inset-0 pointer-events-none bg-linear-to-br ${mood.aura} blur-[140px] opacity-20 transition-all duration-1000`}
      />

      <header className="relative w-full h-[45vh] min-h-[350px] overflow-hidden group">
        {thread.coverImage
          ? (
            <img
              src={thread.coverImage}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
              alt=""
            />
          )
          : <div className={`absolute inset-0 ${mood.bg}`} />}
        <div className="absolute inset-0 bg-linear-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-10 w-full z-10">
          <div className="flex justify-between items-center">
            <a
              href="/threads"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all shadow-lg"
            >
              <Icons.ArrowLeft size={18} />
            </a>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3">
                <span className="text-sm">
                  {MOOD_OPTIONS.find((m) => m.id === thread.mood)?.emoji ||
                    "🎯"}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest ${mood.text}`}
                >
                  {thread.mood}
                </span>
              </div>
              {thread.format && (
                <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-2">
                  <Icons.FileText size={12} className="text-gray-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                    {thread.format}
                  </span>
                </div>
              )}
              {thread.depth && (
                <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-2">
                  <Icons.Layers size={12} className="text-gray-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                    {thread.depth}
                  </span>
                </div>
              )}
              <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md hidden md:flex items-center gap-3">
                <Icons.Activity size={14} className={mood.text} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                  {thread.sourceRoomIds.length} Rooms
                </span>
              </div>

              <div className="flex items-center gap-2 border-l border-white/10 pl-3 ml-1">
                <button
                  onClick={() => toggleFavoriteThread(thread.id)}
                  type="button"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md border shadow-lg ${
                    thread.isFavorited
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                      : "bg-black/50 border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <Icons.Star
                    size={14}
                    fill={thread.isFavorited ? "currentColor" : "transparent"}
                  />
                </button>

                <button
                  onClick={() => togglePinThread(thread.id)}
                  type="button"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md border shadow-lg ${
                    thread.isPinned
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-500"
                      : "bg-black/50 border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <Icons.Pin
                    size={14}
                    fill={thread.isPinned ? "currentColor" : "transparent"}
                  />
                </button>

                <button
                  onClick={() => toggleArchiveThread(thread.id)}
                  type="button"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md border shadow-lg ${
                    thread.isArchived
                      ? "border-gray-500/40 bg-gray-500/10 text-gray-400"
                      : "bg-black/50 border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <Icons.Archive size={14} />
                </button>
              </div>

              <button
                onClick={() => toggleThreadPrivacy(thread.id)}
                type="button"
                className={`px-3.5 py-2 rounded-full backdrop-blur-md border shadow-lg flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  thread.isPublic
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-black/50 border-black/40 text-gray-400"
                }`}
              >
                {thread.isPublic
                  ? (
                    <>
                      <Icons.Globe size={12} className={mood.text} /> Public
                    </>
                  )
                  : (
                    <>
                      <Icons.Lock size={12} /> Private
                    </>
                  )}
              </button>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4 drop-shadow-2xl">
                {thread.title}
              </h1>
              <p className="text-gray-300 font-serif italic text-lg md:text-xl max-w-none leading-relaxed">
                {thread.description}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 md:p-10 w-full max-w-none relative z-10 -mt-8">
        <div className="flex items-center gap-6 mb-12">
          <button
            onClick={() => setActiveTab("synthesis")}
            type="button"
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
              activeTab === "synthesis"
                ? "bg-white text-black shadow-2xl scale-105"
                : "bg-white/5 border border-white/10 text-gray-500 hover:text-white"
            }`}
          >
            <Icons.GitCommit size={16} /> Synthesis Hub
          </button>
          <button
            onClick={() => setActiveTab("artifacts")}
            type="button"
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
              activeTab === "artifacts"
                ? "bg-white text-black shadow-2xl scale-105"
                : "bg-white/5 border border-white/10 text-gray-500 hover:text-white"
            }`}
          >
            <Icons.Layers size={16} /> Woven Artifacts ({items.length})
          </button>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setIsPaletteOpen(!isPaletteOpen)}
              type="button"
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all cursor-pointer"
            >
              <Icons.Palette size={20} />
            </button>
            <button
              type="button"
              className="px-8 py-4 bg-white text-black font-bold uppercase tracking-widest text-[11px] rounded-2xl shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
            >
              Export Pattern
            </button>
          </div>
        </div>

        {activeTab === "synthesis"
          ? (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <SynthesisWeb threadId={thread.id} />

              <div className="flex gap-8 overflow-x-auto pb-4 scrollbar-hide">
                <div className="p-12 bg-white/[0.02] border border-white/5 rounded-[3.5rem] relative overflow-hidden min-w-[760px] flex-[1.6] flex-shrink-0">
                  <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-canvas-primary/40 to-transparent" />
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500 mb-10 flex items-center gap-3">
                    <Icons.MessageSquare size={14} /> Contemplation Pulse
                  </h4>
                  <p className="text-3xl md:text-4xl font-serif italic text-white leading-relaxed mb-12">
                    "If we accept that{" "}
                    <span className={mood.text}>Raw Materials</span>{" "}
                    are the core of digital sovereignty, how does this redefine
                    our interaction with social signals?"
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {[
                      "Explore Contradictions",
                      "Find Parallel Patterns",
                      "Deepen Thesis",
                    ].map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-all"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-10 bg-black/40 border border-white/5 rounded-[3.5rem] flex flex-col justify-center text-center min-w-[320px] flex-[0.7] flex-shrink-0">
                  <Icons.Aperture
                    size={40}
                    className="text-canvas-primary mx-auto mb-6"
                  />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Synthesis Resonance
                  </p>
                  <div className="text-5xl font-bold text-white mb-8">
                    {thread.synthesisScore}%
                  </div>
                  <p className="text-sm text-gray-400 font-serif italic leading-relaxed">
                    This thread is highly cohesive. The signals from your rooms
                    are forming a unified cognitive pattern.
                  </p>
                </div>
              </div>
            </div>
          )
          : (
            <div className="relative py-12 animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-4xl mx-auto">
              {/* The glowing thread line running down the middle */}
              <div className="absolute left-[39px] md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-white/20 to-transparent -translate-x-1/2" />

              <div className="space-y-16">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`relative flex items-center gap-8 md:gap-16 group ${
                      index % 2 === 0 ? "md:flex-row-reverse" : "md:flex-row"
                    } flex-row`}
                  >
                    {/* The timeline node */}
                    <div className="absolute left-[39px] md:left-1/2 w-4 h-4 rounded-full bg-[#0a0a0a] border-2 border-white/20 -translate-x-1/2 z-10 group-hover:scale-150 group-hover:border-white transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]" />

                    {/* Connecting line to the card */}
                    <div
                      className={`hidden md:block absolute top-1/2 w-8 h-[1px] bg-white/20 z-0 ${
                        index % 2 === 0 ? "right-1/2 mr-2" : "left-1/2 ml-2"
                      }`}
                    />

                    <div className="flex-1" />

                    <div className="flex-1 w-full pl-24 md:pl-0 z-20">
                      <div className="bg-[#111] rounded-[2.5rem] border border-white/5 overflow-hidden hover:border-white/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl shadow-black/50">
                        <div className="h-40 bg-white/5 relative overflow-hidden flex items-center justify-center">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700">
                            Artifact Node
                          </p>
                          <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-[8px] font-bold uppercase tracking-widest text-white">
                            From {rooms.find((r) => r.id === item.roomId)?.name}
                          </div>
                        </div>
                        <div className="p-7">
                          <h4 className="font-bold text-lg text-white mb-4 line-clamp-2">
                            {item.title}
                          </h4>
                          <p className="text-sm text-gray-500 font-serif italic mb-6 line-clamp-3">
                            "{item.note}"
                          </p>
                          <div className="flex items-center justify-between pt-5 border-t border-white/5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-700">
                              Sovereign Data
                            </span>
                            <button
                              onClick={() =>
                                removeItemFromThread(thread.id, item.id)}
                              type="button"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-700 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                              <Icons.Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
