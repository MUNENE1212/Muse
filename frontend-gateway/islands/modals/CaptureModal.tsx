import { useEffect, useState } from "preact/hooks";
import * as Icons from "lucide-preact";
import {
  isCaptureOpenSignal,
  toggleCapture,
} from "../../signals/ui.ts";
import { addNotification } from "../../signals/notifications.ts";
import { addRoom, roomsSignal } from "../../signals/rooms.ts";
import { addItem } from "../../signals/items.ts";

type CaptureStep = "input" | "context" | "contemplation";

export default function CaptureModal() {
  const [step, setStep] = useState<CaptureStep>("input");
  const [url, setUrl] = useState("");
  const [roomId, setRoomId] = useState("");
  const [note, setNote] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  // Inline Room Creation State
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomIsPublic, setNewRoomIsPublic] = useState(false);

  const isOpen = isCaptureOpenSignal.value;
  const rooms = roomsSignal.value;

  // Initialize roomId if not set
  useEffect(() => {
    if (rooms.length > 0 && !roomId) {
      setRoomId(rooms[0].id);
    }
  }, [rooms, roomId]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === "input" && url) {
      setIsScanning(true);
      // Mock scanning effect
      setTimeout(() => {
        setIsScanning(false);
        setStep("context");
      }, 1200);
    } else if (step === "context") {
      setStep("contemplation");
    }
  };

  const handleBack = () => {
    if (step === "context") setStep("input");
    if (step === "contemplation") setStep("context");
  };

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;
    const newRoomId = addRoom({
      name: newRoomName.trim(),
      description: "",
      themeColor: "indigo",
      coverImage: "",
      isPublic: newRoomIsPublic,
      tags: [],
      notificationsEnabled: true,
    });
    setRoomId(newRoomId);
    setIsAddingRoom(false);
    setNewRoomName("");
    setNewRoomIsPublic(false);
    setStep("contemplation");
  };

  const handleCapture = (e: Event) => {
    e.preventDefault();
    if (!url || !roomId) return;

    let title = "Captured Artifact";
    try {
      title = url.startsWith("http")
        ? new URL(url).hostname
        : "Personal Thought";
    } catch (_e) {
      // Keep fallback title when URL parsing fails.
    }

    addItem({
      roomId,
      title,
      sourceUrl: url.startsWith("http")
        ? url
        : `https://google.com/search?q=${encodeURIComponent(url)}`,
      note,
      isPublic: false,
    });
    addNotification(
      "achievement",
      "Synthesis Captured",
      `"${title}" was committed to the vault.`,
    );

    // Reset and close
    setStep("input");
    setUrl("");
    setNote("");
    toggleCapture();
  };

  const steps: CaptureStep[] = ["input", "context", "contemplation"];
  const currentStepIdx = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div
        onClick={toggleCapture}
        className="absolute inset-0 bg-[var(--muse-bg)]/95 backdrop-blur-3xl"
      />

      <div className="relative w-full max-w-2xl bg-[var(--muse-surface)] border border-[var(--muse-border)] rounded-[3rem] p-12 md:p-16 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
        {/* Scanline Effect during scanning */}
        {isScanning && (
          <div className="absolute inset-x-0 h-1 bg-canvas-primary blur-md z-20 pointer-events-none animate-[slide-down_1.2s_linear_infinite]" />
        )}

        <button
          type="button"
          onClick={toggleCapture}
          className="absolute top-8 right-8 p-3 text-[var(--muse-muted)] hover:text-[var(--muse-text)] transition-all rounded-2xl hover:bg-[var(--muse-surface-soft)] active:scale-95 cursor-pointer z-50"
        >
          <Icons.X size={24} />
        </button>

        {step !== "input" && (
          <button
            type="button"
            onClick={handleBack}
            className="absolute top-8 left-8 p-3 text-[var(--muse-muted)] hover:text-[var(--muse-text)] transition-all rounded-2xl hover:bg-[var(--muse-surface-soft)] active:scale-95 flex items-center gap-2 group cursor-pointer z-50"
          >
            <Icons.ArrowLeft
              size={20}
              className="group-hover:-translate-x-1 transition-transform"
            />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">
              Back
            </span>
          </button>
        )}

        {/* Local Progress Indicator */}
        <div className="flex justify-center gap-3 mb-10">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 w-12 rounded-full transition-all duration-700 ${
                i <= currentStepIdx
                  ? "bg-canvas-primary"
                  : "bg-[var(--muse-border)]"
              }`}
            />
          ))}
        </div>

        <div className="min-h-[300px] flex flex-col justify-center">
          {/* STEP 1: INPUT */}
          {step === "input" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold text-[var(--muse-text)] tracking-tight leading-tight">
                  Capture the{" "}
                  <span className="text-canvas-primary">Essence.</span>
                </h2>
                <p className="text-[var(--muse-muted)] font-serif italic text-lg leading-relaxed">
                  What artifact has entered your field of vision?
                </p>
              </div>

              <div className="relative group max-w-lg mx-auto">
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--muse-border)] group-focus-within:bg-canvas-primary transition-colors duration-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]" />
                <input
                  type="text"
                  required
                  placeholder="Paste a URL or a deep thought..."
                  autoFocus
                  value={url}
                  onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNext();
                    if (e.key === "Escape") toggleCapture();
                  }}
                  className="w-full bg-transparent text-2xl p-6 text-center outline-none transition-colors placeholder-[var(--muse-border)] font-sans text-[var(--muse-text)] border-0"
                />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-4">
                  <Icons.Link2 size={18} className="text-[var(--muse-muted)]" />
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!url || isScanning}
                  className="group px-10 py-5 bg-[var(--muse-text)] text-[var(--muse-bg)] font-bold uppercase tracking-widest text-[11px] rounded-3xl flex items-center gap-3 shadow-[0_20px_40px_rgba(0,0,0,0.15)] hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-30 disabled:translate-y-0 cursor-pointer"
                >
                  {isScanning ? "Scanning Artifact..." : "Analyze Resonance"}
                  {!isScanning && (
                    <Icons.Aperture
                      size={16}
                      className="text-canvas-primary group-hover:rotate-12 transition-transform"
                    />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CONTEXT */}
          {step === "context" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center space-y-4">
                <div className="flex justify-center mb-6">
                  <div className="px-5 py-2 rounded-full bg-canvas-primary/10 border border-canvas-primary/20 flex items-center gap-3">
                    <Icons.Check size={14} className="text-canvas-primary" />
                    <span className="text-[10px] font-bold text-canvas-primary uppercase tracking-widest">
                      Resonance Verified
                    </span>
                  </div>
                </div>
                <h2 className="text-4xl font-bold text-[var(--muse-text)] tracking-tight leading-tight">
                  Where does this{" "}
                  <span className="text-[var(--muse-muted)] italic font-serif">
                    belong?
                  </span>
                </h2>
                <p className="text-[var(--muse-muted)] font-serif italic text-lg leading-relaxed">
                  Choose a Room or create a new thematic anchor.
                </p>
              </div>

              <div className="min-h-[220px]">
                {!isAddingRoom
                  ? (
                    <div className="flex gap-4 max-w-lg mx-auto h-[220px] overflow-x-auto px-4 scrollbar-hide py-2">
                      {rooms.map((room) => (
                        <button
                          type="button"
                          key={room.id}
                          onClick={() => setRoomId(room.id)}
                          className={`flex-shrink-0 w-44 p-6 rounded-4xl border transition-all flex flex-col items-center gap-4 group cursor-pointer ${
                            roomId === room.id
                              ? "bg-canvas-primary/10 border-canvas-primary shadow-[0_0_30px_rgba(99,102,241,0.2)]"
                              : "bg-[var(--muse-surface-soft)] border-[var(--muse-border)] hover:border-[var(--muse-text)]/20"
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                              roomId === room.id
                                ? "text-white"
                                : "text-[var(--muse-muted)] group-hover:text-[var(--muse-text)]"
                            }`}
                            style={{
                              backgroundColor: room.customThemeHex || undefined,
                            }}
                          >
                            <Icons.Layout size={18} />
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-widest text-center leading-tight ${
                              roomId === room.id
                                ? "text-[var(--muse-text)]"
                                : "text-[var(--muse-muted)]"
                            }`}
                          >
                            {room.name}
                          </span>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setIsAddingRoom(true)}
                        className="flex-shrink-0 w-44 p-6 rounded-4xl border border-dashed border-[var(--muse-border)] hover:border-canvas-primary/40 hover:bg-canvas-primary/5 transition-all flex flex-col items-center justify-center gap-4 group cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full border border-dashed border-[var(--muse-border)] flex items-center justify-center group-hover:border-canvas-primary transition-colors">
                          <Icons.Plus
                            size={18}
                            className="text-[var(--muse-muted)] group-hover:text-canvas-primary"
                          />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muse-muted)] group-hover:text-[var(--muse-text)] transition-colors">
                          New Room
                        </span>
                      </button>
                    </div>
                  )
                  : (
                    <div className="max-w-md mx-auto space-y-6 bg-[var(--muse-surface-soft)] border border-[var(--muse-border)] p-8 rounded-[2.5rem] relative overflow-hidden animate-in zoom-in-95 duration-300">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muse-muted)] ml-4">
                          Room Identity
                        </label>
                        <input
                          autoFocus
                          placeholder="e.g. Digital Ephemera"
                          value={newRoomName}
                          onInput={(e) =>
                            setNewRoomName(
                              (e.target as HTMLInputElement).value,
                            )}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateRoom();
                            if (e.key === "Escape") setIsAddingRoom(false);
                          }}
                          className="w-full bg-[var(--muse-surface)] border border-[var(--muse-border)] rounded-3xl p-5 text-lg outline-none focus:border-canvas-primary transition-all text-[var(--muse-text)] placeholder-[var(--muse-muted)]"
                        />
                      </div>

                      <div className="flex gap-2 p-1 bg-[var(--muse-surface)] rounded-3xl">
                        <button
                          type="button"
                          onClick={() => setNewRoomIsPublic(false)}
                          className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all ${
                            !newRoomIsPublic
                              ? "bg-[var(--muse-surface-soft)] text-[var(--muse-text)] shadow-lg"
                              : "text-[var(--muse-muted)]"
                          } cursor-pointer`}
                        >
                          <Icons.Lock size={14} />
                          <span className="text-[9px] font-bold uppercase tracking-widest">
                            Solo Vault
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRoomIsPublic(true)}
                          className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all ${
                            newRoomIsPublic
                              ? "bg-canvas-accent/20 text-canvas-accent shadow-lg"
                              : "text-[var(--muse-muted)]"
                          } cursor-pointer`}
                        >
                          <Icons.Globe size={14} />
                          <span className="text-[9px] font-bold uppercase tracking-widest">
                            Public Hub
                          </span>
                        </button>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setIsAddingRoom(false)}
                          className="flex-1 py-4 rounded-2xl border border-[var(--muse-border)] text-[10px] font-bold uppercase tracking-widest text-[var(--muse-muted)] hover:text-[var(--muse-text)] transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateRoom}
                          disabled={!newRoomName.trim()}
                          className="flex-[2] py-4 rounded-2xl bg-canvas-primary text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-canvas-primary/20 disabled:opacity-30 transition-all hover:-translate-y-0.5 cursor-pointer"
                        >
                          Establish Room
                        </button>
                      </div>
                    </div>
                  )}
              </div>

              <div className="flex justify-center pt-8">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!roomId}
                  className="group px-10 py-5 bg-[var(--muse-text)] text-[var(--muse-bg)] font-bold uppercase tracking-widest text-[11px] rounded-3xl flex items-center gap-3 shadow-[0_20px_40px_rgba(0,0,0,0.15)] hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-30 cursor-pointer"
                >
                  Anchor Context{" "}
                  <Icons.ChevronRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONTEMPLATION */}
          {step === "contemplation" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-[var(--muse-text)] tracking-tight leading-tight">
                  A Breath for{" "}
                  <span className="text-canvas-accent">Contemplation.</span>
                </h2>
                <p className="text-[var(--muse-muted)] font-serif italic text-lg leading-relaxed">
                  Why did this resonance matter to you?
                </p>
              </div>

              <div className="relative group max-w-lg mx-auto">
                <textarea
                  placeholder="Your silent thoughts go here..."
                  autoFocus
                  value={note}
                  onInput={(e) =>
                    setNote((e.target as HTMLTextAreaElement).value)}
                  className="w-full bg-[var(--muse-surface-soft)] border border-[var(--muse-border)] rounded-[2rem] p-8 text-lg outline-none transition-all placeholder-[var(--muse-muted)] min-h-[140px] font-serif italic text-[var(--muse-text)] focus:border-canvas-accent/40"
                />
              </div>

              <div className="flex justify-center pt-8">
                <button
                  type="button"
                  onClick={handleCapture}
                  className="group px-12 py-6 bg-canvas-primary text-white font-bold uppercase tracking-widest text-[11px] rounded-[2rem] flex items-center gap-4 shadow-[0_25px_50px_rgba(99,102,241,0.3)] hover:-translate-y-1 active:scale-95 transition-all cursor-pointer"
                >
                  <Icons.Zap size={18} className="fill-white" /> Commit to Muse
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-canvas-primary/10 blur-[60px] rounded-full pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-canvas-accent/10 blur-[60px] rounded-full pointer-events-none" />
      </div>
    </div>
  );
}
