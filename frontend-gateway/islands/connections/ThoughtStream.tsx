import { useState } from "preact/hooks";
import * as Icons from "lucide-preact";
import {
  alignWithPerspective,
  challengePerspective,
  perspectivesSignal as persSig,
} from "../../signals/connections.ts";
import SynthesisModal from "../../components/connections/SynthesisModal.tsx";
import LineageMapModal from "../../components/connections/LineageMapModal.tsx";
import ResonanceModal from "../../components/connections/ResonanceModal.tsx";
import {
  feedFilterSignal,
  filterPerspectivesByFollowing,
  setFeedFilter,
} from "../../signals/feed-filter.ts";
import { followersSignal } from "../../signals/followers.ts";
import { type Perspective } from "../../signals/connections.ts";

export default function ThoughtStream(
  { streamData = [] }: { streamData?: Perspective[] },
) {
  const [activeSynthesisNode, setActiveSynthesisNode] = useState<string | null>(
    null,
  );
  const [activeLineageNode, setActiveLineageNode] = useState<string | null>(
    null,
  );
  const [activeResonanceNode, setActiveResonanceNode] = useState<string | null>(
    null,
  );
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  const allPerspectives = streamData.length > 0 ? streamData : persSig.value;
  const feedFilter = feedFilterSignal.value;
  const followers = followersSignal.value;

  // Apply filter based on selection
  const perspectives = filterPerspectivesByFollowing(
    allPerspectives,
    followers.following.map((f) => f.name),
    feedFilter.type,
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* No generic input box here. Journal is used for input. */}

      {/* FEED FILTER CONTROLS */}
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500 flex items-center gap-3">
          <Icons.GitBranch size={14} className="text-canvas-primary" />
          Community Thought Stream
        </h3>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFeedFilter("all")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${
              feedFilter.type === "all"
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                : "bg-white/5 border border-white/10 text-gray-500 hover:text-white"
            }`}
          >
            <Icons.Globe size={12} /> All Posts
          </button>

          <button
            type="button"
            onClick={() => setFeedFilter("following")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${
              feedFilter.type === "following"
                ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-400"
                : "bg-white/5 border border-white/10 text-gray-500 hover:text-white"
            }`}
          >
            <Icons.Users size={12} /> From Following
          </button>
        </div>
      </div>

      {/* FOCUS VIEW OR MAIN FEED */}
      {focusNodeId
        ? (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <button
              type="button"
              onClick={() => setFocusNodeId(null)}
              className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors cursor-pointer group"
            >
              <Icons.ArrowLeft
                size={16}
                className="group-hover:-translate-x-1 transition-transform"
              />
              Return to Ledger
            </button>

            {/* Render the focused perspective without click handlers */}
            {perspectives.filter((p) => p.id === focusNodeId).map((pers) => (
              <div key={pers.id} className="mb-12">
                {/* We just duplicate the card UI here without hover effects, full width */}
                <div className="relative bg-white/[0.03] border border-white/5 rounded-[3rem] p-10">
                  {/* ... Content ... */}
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[12px] font-bold border border-white/10`}
                          style={{
                            backgroundColor: `${pers.author.aura}15`,
                            color: pers.author.aura,
                          }}
                        >
                          {pers.author.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-white">
                              {pers.author.name}
                            </span>
                            <Icons.CheckCircle
                              size={12}
                              className="text-emerald-400"
                            />
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                              {pers.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-3xl font-serif italic text-white leading-relaxed max-w-none">
                    {pers.content}
                  </p>

                  <div className="mt-8 pt-6 border-t border-white/[0.03] flex flex-wrap items-center gap-8">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSynthesisNode(pers.id)}
                      className="group/btn flex flex-col items-start gap-1 p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        <Icons.GitBranch
                          size={14}
                          className="group-hover/btn:rotate-90 transition-transform text-canvas-primary"
                        />{" "}
                        Synthesize
                      </div>
                      <span className="text-[9px] text-gray-500 font-serif italic pl-6">
                        Branch into Journal
                      </span>
                    </button>

                    {/* Align / Challenge Buttons */}
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          alignWithPerspective(pers.id);
                        }}
                        className="group/btn flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Icons.ArrowUp
                          size={14}
                          className="text-gray-500 group-hover/btn:text-emerald-400 transition-colors"
                        />
                        <span className="text-[10px] font-bold text-gray-400 group-hover/btn:text-emerald-400">
                          {pers.alignCount}
                        </span>
                      </button>
                      <div className="w-px h-4 bg-white/10" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          challengePerspective(pers.id);
                        }}
                        className="group/btn flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Icons.ArrowDown
                          size={14}
                          className="text-gray-500 group-hover/btn:text-amber-400 transition-colors"
                        />
                        <span className="text-[10px] font-bold text-gray-400 group-hover/btn:text-amber-400">
                          {pers.challengeCount}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveResonanceNode(pers.id);
                      }}
                      className="group/btn flex flex-col items-start gap-1 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        <Icons.Waves
                          size={14}
                          className="text-emerald-500 group-hover/btn:scale-110 transition-transform"
                        />{" "}
                        Resonate
                      </div>
                      <span className="text-[9px] text-gray-500 font-serif italic pl-6">
                        Inject thought to cluster
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveLineageNode(pers.id)}
                      className="group/btn flex flex-col items-start gap-1 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        <Icons.Network
                          size={14}
                          className="text-indigo-500 group-hover/btn:scale-110 transition-transform"
                        />{" "}
                        Trace Chain
                      </div>
                      <span className="text-[9px] text-gray-500 font-serif italic pl-6">
                        View lineage map
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* RESONANCE CLUSTERS */}
            <div className="space-y-6">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500 flex items-center gap-3 mb-8">
                <Icons.Waves size={14} className="text-emerald-500" />
                Resonance Clusters
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Cluster 1 */}
                <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                        Theme: Digital Silence
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-1 rounded-md">
                      12 Nodes
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="pl-4 border-l-2 border-cyan-500/30">
                      <p className="text-sm font-serif italic text-gray-400">
                        "The absence of notifications is the ultimate luxury."
                      </p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mt-2">
                        — Elena V.
                      </p>
                    </div>
                    <div className="pl-4 border-l-2 border-cyan-500/30">
                      <p className="text-sm font-serif italic text-gray-400">
                        "We must architect quiet spaces deliberately."
                      </p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mt-2">
                        — Marcus T.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cluster 2 */}
                <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                        Theme: Deep Work
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-1 rounded-md">
                      8 Nodes
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="pl-4 border-l-2 border-purple-500/30">
                      <p className="text-sm font-serif italic text-gray-400">
                        "Focus is fractured by default. Brutalism restores it."
                      </p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mt-2">
                        — Sarah K.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
        : (
          <div className="space-y-8">
            {perspectives.map((pers, i) => (
              <div
                key={pers.id}
                className={`relative animate-in fade-in slide-in-from-bottom-4 duration-500`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Network Timeline Connector */}
                <div className="absolute left-[-24px] md:left-[-32px] top-1/2 w-8 md:w-12 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent -z-10" />
                <div className="absolute left-[-26px] md:left-[-34px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#0d0d0d] border border-indigo-500/50 z-10 shadow-[0_0_10px_rgba(99,102,241,0.3)] animate-pulse" />

                <div
                  onClick={() => setFocusNodeId(pers.id)}
                  className={`group cursor-pointer relative bg-white/[0.03] border border-white/5 rounded-[3rem] p-8 md:p-10 transition-all duration-500 hover:bg-white/[0.05] hover:border-indigo-500/40 hover:shadow-[0_0_50px_rgba(99,102,241,0.15)] hover:-translate-y-1 ${
                    pers.relationship === "Challenging"
                      ? "border-amber-500/20"
                      : ""
                  }`}
                >
                  {/* ANALYZING OVERLAY */}
                  {pers.isAnalyzing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[3rem] z-20 flex items-center justify-center gap-4 animate-in fade-in duration-300">
                      <div className="flex items-center gap-3 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl">
                        <Icons.Cpu
                          size={16}
                          className="text-canvas-primary animate-pulse"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                          Parallel Analysis Node #4 Active
                        </span>
                        <Icons.RefreshCcw
                          size={14}
                          className="text-gray-500 animate-spin"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[12px] font-bold border border-white/10`}
                          style={{
                            backgroundColor: `${pers.author.aura}15`,
                            color: pers.author.aura,
                          }}
                        >
                          {pers.author.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-white group-hover:text-canvas-primary transition-colors">
                              {pers.author.name}
                            </span>
                            <Icons.CheckCircle
                              size={12}
                              className="text-emerald-400"
                            />
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                              {pers.timestamp}
                            </span>
                            {pers.source && (
                              <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-canvas-primary/60">
                                {pers.source === "Journal"
                                  ? <Icons.BookOpen size={10} />
                                  : <Icons.Layout size={10} />}
                                {pers.source}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        {/* Visibility Badge */}
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                          <Icons.Globe size={11} className="text-amber-400" />
                          <span className="text-[8px] font-bold uppercase tracking-widest text-amber-400">
                            Public
                          </span>
                        </div>

                        {/* Immutability Badge */}
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <Icons.Lock size={11} className="text-emerald-400" />
                          <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-400">
                            Immutable
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      {pers.txId && (
                        <div className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[8px] font-mono text-gray-600 group-hover:text-emerald-500/60 transition-colors">
                          TX: {pers.txId}
                        </div>
                      )}
                      {pers.relationship !== "Initial" && (
                        <div
                          className={`px-4 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border ${
                            pers.relationship === "Challenging"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                              : pers.relationship === "Resonating"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                              : "bg-canvas-primary/10 border-canvas-primary/30 text-canvas-primary"
                          }`}
                        >
                          {pers.relationship}
                        </div>
                      )}
                    </div>

                    {/* Hide old resonance score badge since we have up/down arrows now */}
                  </div>

                  <p className="text-xl md:text-2xl font-serif italic text-gray-200 leading-relaxed max-w-none group-hover:text-white transition-colors">
                    {pers.content}
                  </p>

                  <div className="mt-8 pt-6 border-t border-white/[0.03] flex flex-wrap items-center gap-6">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSynthesisNode(pers.id);
                      }}
                      className="group/btn flex flex-col items-start gap-1 p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        <Icons.GitBranch
                          size={14}
                          className="group-hover/btn:rotate-90 transition-transform text-canvas-primary"
                        />{" "}
                        Synthesize
                      </div>
                      <span className="text-[9px] text-gray-500 font-serif italic pl-6">
                        Branch into Journal
                      </span>
                    </button>

                    {/* Align / Challenge Buttons */}
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          alignWithPerspective(pers.id);
                        }}
                        className="group/btn flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Icons.ArrowUp
                          size={14}
                          className="text-gray-500 group-hover/btn:text-emerald-400 transition-colors"
                        />
                        <span className="text-[10px] font-bold text-gray-400 group-hover/btn:text-emerald-400">
                          {pers.alignCount}
                        </span>
                      </button>
                      <div className="w-px h-4 bg-white/10" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          challengePerspective(pers.id);
                        }}
                        className="group/btn flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Icons.ArrowDown
                          size={14}
                          className="text-gray-500 group-hover/btn:text-amber-400 transition-colors"
                        />
                        <span className="text-[10px] font-bold text-gray-400 group-hover/btn:text-amber-400">
                          {pers.challengeCount}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveResonanceNode(pers.id);
                      }}
                      className="group/btn flex flex-col items-start gap-1 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        <Icons.Waves
                          size={14}
                          className="text-emerald-500 group-hover/btn:scale-110 transition-transform"
                        />{" "}
                        Resonate
                      </div>
                      <span className="text-[9px] text-gray-500 font-serif italic pl-6">
                        Inject thought to cluster
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLineageNode(pers.id);
                      }}
                      className="group/btn flex flex-col items-start gap-1 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        <Icons.Network
                          size={14}
                          className="text-indigo-500 group-hover/btn:scale-110 transition-transform"
                        />{" "}
                        Trace Chain
                      </div>
                      <span className="text-[9px] text-gray-500 font-serif italic pl-6">
                        View lineage map
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {activeSynthesisNode && (
        <SynthesisModal
          perspectiveId={activeSynthesisNode}
          authorName={perspectives.find((p) => p.id === activeSynthesisNode)
            ?.author.name || ""}
          content={perspectives.find((p) =>
            p.id === activeSynthesisNode
          )
            ?.content || ""}
          onClose={() => setActiveSynthesisNode(null)}
        />
      )}

      {activeLineageNode && (
        <LineageMapModal
          perspective={perspectives.find((p) => p.id === activeLineageNode)!}
          onClose={() => setActiveLineageNode(null)}
        />
      )}
      {activeResonanceNode && (
        <ResonanceModal
          perspectiveId={activeResonanceNode}
          onClose={() => setActiveResonanceNode(null)}
        />
      )}
    </div>
  );
}
