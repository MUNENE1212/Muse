import { useMemo, useState } from "preact/hooks";
import {
  addLinkedArtifact,
  deleteJournalEntry,
  getJournalTitle,
  getLinkedArtifacts,
  type JournalEntry,
  journalSignal,
  removeLinkedArtifact,
  toggleFavoriteJournal,
  updateJournalEntry,
  verifyVaultPassword,
} from "../../signals/journal.ts";
import { VaultModal } from "../../islands/journal/VaultModal.tsx";
import {
  ArtifactSelector,
  LinkedArtifacts,
} from "../../islands/journal/LinkedArtifacts.tsx";
import * as Icons from "lucide-preact";

interface EntryDetailProps {
  entry: JournalEntry;
  onBack: () => void;
  onEdit: (entry: JournalEntry) => void;
}

export function EntryDetail({ entry, onBack, onEdit }: EntryDetailProps) {
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(!entry.vault?.isVaulted);
  const [isArtifactSelectorOpen, setIsArtifactSelectorOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(entry.body);

  const linkedArtifacts = useMemo(() => getLinkedArtifacts(entry.id), [
    entry.id,
  ]);
  const title = getJournalTitle(entry);
  const wordCount = entry.wordCount || 0;
  const createdDate = new Date(entry.createdAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleVaultUnlock = async (password: string) => {
    const ok = await verifyVaultPassword(entry, password);
    if (ok) {
      setIsUnlocked(true);
      setVaultError(null);
      setIsVaultModalOpen(false);
    } else {
      setVaultError("Incorrect password");
    }
  };

  const handleSaveEdit = () => {
    updateJournalEntry(entry.id, { body: editBody });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this entry?")) {
      deleteJournalEntry(entry.id);
      onBack();
    }
  };

  const handleToggleFavorite = () => {
    toggleFavoriteJournal(entry.id);
  };

  const handleAddLink = (artifact: any) => {
    addLinkedArtifact(entry.id, artifact);
  };

  const handleRemoveLink = (artifactId: string) => {
    removeLinkedArtifact(entry.id, artifactId);
  };

  return (
    <div class="min-h-screen bg-gradient-to-b from-white/5 via-transparent to-white/5 pb-24">
      {/* Header */}
      <div class="px-6 md:px-10 py-8 border-b border-white/10">
        <div class="max-w-4xl mx-auto flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            class="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <Icons.ArrowLeft size={20} /> Back
          </button>
          <div class="flex items-center gap-2">
            {entry.vault?.isVaulted && !isUnlocked && (
              <button
                onClick={() => setIsVaultModalOpen(true)}
                class="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 flex items-center gap-2 transition-all"
              >
                <Icons.Lock size={16} /> Unlock
              </button>
            )}
            <button
              onClick={handleToggleFavorite}
              class={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                entry.isFavorited
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-white/10 hover:bg-white/20 text-white/60"
              }`}
            >
              <Icons.Star
                size={16}
                class={entry.isFavorited ? "fill-current" : ""}
              />
              {entry.isFavorited ? "Favorited" : "Favorite"}
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              class="px-4 py-2 rounded-lg bg-canvas-primary/20 hover:bg-canvas-primary/30 text-canvas-primary flex items-center gap-2 transition-all"
            >
              <Icons.Edit size={16} /> {isEditing ? "Cancel" : "Edit"}
            </button>
            <button
              onClick={handleDelete}
              class="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center gap-2 transition-all"
            >
              <Icons.Trash2 size={16} /> Delete
            </button>
          </div>
        </div>

        {/* Title & Meta */}
        <div class="max-w-4xl mx-auto">
          <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">
            {title}
          </h1>
          <div class="flex items-center gap-4 text-sm text-white/60">
            <span>{createdDate}</span>
            <span>•</span>
            <span>{wordCount} words</span>
            {entry.vault?.isVaulted && (
              <>
                <span>•</span>
                <span class="flex items-center gap-1">
                  <Icons.Lock size={14} /> Password protected
                </span>
              </>
            )}
            {entry.type === "synthesis" && (
              <>
                <span>•</span>
                <span class="flex items-center gap-1">
                  <Icons.Zap size={14} /> Synthesis
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="px-6 md:px-10 py-12">
        <div class="max-w-4xl mx-auto">
          {/* Vault Locked Message */}
          {entry.vault?.isVaulted && !isUnlocked && (
            <div class="p-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
              <Icons.Lock size={32} class="mx-auto mb-4 text-amber-400" />
              <p class="text-white mb-4">This entry is password protected</p>
              <button
                onClick={() => setIsVaultModalOpen(true)}
                class="px-6 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-all"
              >
                Unlock Entry
              </button>
            </div>
          )}

          {/* Editable Content */}
          {isUnlocked && (
            <>
              {isEditing
                ? (
                  <div class="space-y-4 mb-12">
                    <textarea
                      value={editBody}
                      onChange={(e) =>
                        setEditBody((e.target as HTMLTextAreaElement).value)}
                      class="w-full h-96 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-canvas-primary/50 focus:outline-none focus:ring-1 focus:ring-canvas-primary/30 font-serif"
                    />
                    <div class="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        class="px-6 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 flex items-center gap-2 transition-all"
                      >
                        <Icons.Check size={16} /> Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditBody(entry.body);
                        }}
                        class="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-2 transition-all"
                      >
                        <Icons.X size={16} /> Cancel
                      </button>
                    </div>
                  </div>
                )
                : (
                  <div class="prose prose-invert max-w-none mb-12">
                    <p class="text-white/80 font-serif leading-relaxed text-lg whitespace-pre-wrap">
                      {entry.body}
                    </p>
                  </div>
                )}

              {/* Metadata */}
              <div class="space-y-8 mb-12">
                {/* Mood & Tags */}
                {(entry.mood || entry.tags.length > 0) && (
                  <div>
                    <h3 class="text-sm font-bold text-white/60 mb-3 uppercase tracking-widest">
                      Metadata
                    </h3>
                    <div class="space-y-3">
                      {entry.mood && (
                        <div>
                          <p class="text-xs text-white/50 mb-1">Mood</p>
                          <span class="px-3 py-1 rounded-full bg-white/10 text-white text-sm">
                            {entry.customMood || entry.mood}
                          </span>
                        </div>
                      )}
                      {entry.tags.length > 0 && (
                        <div>
                          <p class="text-xs text-white/50 mb-2">Tags</p>
                          <div class="flex flex-wrap gap-2">
                            {entry.tags.map((tag) => (
                              <span
                                key={tag}
                                class="px-3 py-1 rounded-full bg-canvas-primary/20 text-canvas-primary text-sm"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Synthesis Details */}
                {entry.type === "synthesis" && entry.synthesis && (
                  <div>
                    <h3 class="text-sm font-bold text-white/60 mb-3 uppercase tracking-widest">
                      <Icons.Zap size={14} class="inline mr-2" /> Synthesis Data
                    </h3>
                    <div class="space-y-4">
                      {entry.synthesis.keyInsights.length > 0 && (
                        <div>
                          <p class="text-xs text-white/50 mb-2">Key Insights</p>
                          <ul class="space-y-1">
                            {entry.synthesis.keyInsights.map((insight, i) => (
                              <li key={i} class="text-sm text-white/70">
                                • {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {entry.synthesis.patterns.length > 0 && (
                        <div>
                          <p class="text-xs text-white/50 mb-2">Patterns</p>
                          <div class="flex flex-wrap gap-2">
                            {entry.synthesis.patterns.map((pattern, i) => (
                              <span
                                key={i}
                                class="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-300"
                              >
                                {pattern}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Linked Artifacts */}
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-bold text-white/60 uppercase tracking-widest">
                      <Icons.Link2 size={14} class="inline mr-2" /> Connections
                    </h3>
                    {!isEditing && (
                      <button
                        onClick={() => setIsArtifactSelectorOpen(true)}
                        class="text-xs px-2 py-1 rounded bg-canvas-primary/20 hover:bg-canvas-primary/30 text-canvas-primary transition-all"
                      >
                        Add Link
                      </button>
                    )}
                  </div>
                  <LinkedArtifacts
                    artifacts={linkedArtifacts}
                    onRemove={handleRemoveLink}
                    isEditing={false}
                  />
                  {linkedArtifacts.length === 0 && !isEditing && (
                    <p class="text-sm text-white/40 italic">
                      No connections yet
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <VaultModal
        isOpen={isVaultModalOpen}
        mode="unlock"
        onClose={() => {
          setIsVaultModalOpen(false);
          setVaultError(null);
        }}
        onSubmit={handleVaultUnlock}
        error={vaultError}
      />

      {isArtifactSelectorOpen && (
        <ArtifactSelector
          rooms={[]}
          threads={[]}
          onSelect={handleAddLink}
          onClose={() => setIsArtifactSelectorOpen(false)}
        />
      )}
    </div>
  );
}
