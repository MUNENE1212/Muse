# Muse Collective 3.0: The Industrial-Grade Intelligence Loop

[![CI](https://github.com/kagz-01/Muse/actions/workflows/ci.yml/badge.svg)](https://github.com/kagz-01/Muse/actions/workflows/ci.yml)

**Muse** is a sovereign knowledge environment designed to transform raw consumption into collective intelligence. It replaces passive data storage with a proactive **Synthesis Engine**, allowing users to capture signals, contemplate patterns, and broadcast immutable thoughts to a global collective.

## 🌀 The Loop: Your Cognitive Workflow (Day 1 Journey)

Muse follows a strictly enforced four-phase cognitive cycle. As a user, your journey flows seamlessly through these states:

1. **Collect (The "Inlet" Phase)**: Capture raw signals from the social web (YouTube, Medium, GitHub, Twitter). When you paste a link, the **Synthesis Engine** extracts its semantic meaning and prompts you to store it as an Artifact in a specific **Sovereign Knowledge Room**.
2. **Contemplate (The "Internal" Phase)**: Dive into your private rooms or the **Journal Terminal**. Here, the **Real-time AI Feedback System** acts as a silent co-pilot. As you type and connect artifacts, it detects patterns, calculates a "Blueprint Score," and asks Socratic questions to deepen your thought process. 
3. **Synthesize (The "Integration" Phase)**: Use the **Synthesis Engine** (accessed via the cinematic Radial Menu) to weave diverse artifacts and journals into **Woven Threads**—living documents of complex thought.
4. **Create (The "Outlet" Phase)**: When you are ready, transform your private syntheses into **Immutable Thoughts**, broadcasting them to the **Collective Thought Stream**. Every published thought carries a unique **Ledger ID**, providing cryptographic proof of provenance (blockchain integration). Your thoughts remain yours forever.

## 🏗️ Core Infrastructure & Architecture

### The Synthesis Engine & Radial Menu
A cinematic, globally accessible navigation layer that allows frictionless movement between the four phases of the loop.

### Sovereign Knowledge Rooms (The Vaults)
Personal data vaults where raw signals are stored. Features include:
- **Resonance Clusters**: Automated grouping of related artifacts.
- **Privacy Shrouds**: Granular control over visibility (100% private until explicitly published).

### The Collective Soul Profile & Wisdom Map
A high-fidelity visualization of your intellectual character (e.g., "The Synthesizer"). The **Wisdom Map** displays pulsing node clusters showing how your patterns connect with others across the network.

### The Mirror Dashboard
Your personal analytics center. It reflects your real-time interactions with the app, showing engagement stats, activity timelines, follower growth, and your overall **Resonance Score**.

## ✨ MVP Features (The 5 Phases Completed)

The MVP is 100% complete (49/49 features built) across 5 core development phases:

1. **Phase 1: Followers System** - Follow creators, filter feeds by following status, build your community.
2. **Phase 2: Mirror Dashboard** - Real-time engagement analytics with activity timeline and growth metrics.
3. **Phase 3: Synthesis Feature** - Intelligent link parsing, multi-source artifact creation, paste-to-synthesize workflow.
4. **Phase 4: Circle Join Action** - Interactive circle membership, activity feeds, resonance-based connections.
5. **Phase 5: Real-time AI Feedback** - Multi-stage analysis pipeline, pattern detection, blueprint matching with confidence scores.

## 🛠️ Technology Stack & State Management

The frontend is an industrial-grade application built for maximum reactivity and performance:
- **Frontend Framework**: [Deno Fresh](https://fresh.deno.dev/)
- **UI & State**: Preact + Preact Signals
- **Aesthetics**: Vanilla CSS + Tailwind-compatible utility layers for brutalist, bento styling.
- **Icons**: [Lucide-Preact](https://lucide.dev/)

### Signal-Based State Management
To prevent prop-drilling, the platform utilizes **17 global Signal modules** located in `frontend-gateway/signals/`:
- `ai-feedback.ts`, `circle-membership.ts`, `followers.ts`, `synthesis.ts`, `mirror.ts`, `notifications.ts`, etc.

### Component Organization
**50+ robust components** organized by domain in `frontend-gateway/components/`:
- Followers, Circles, Threads, AI Feedback, Notifications, Community, Synthesis.

## 🔗 API Contracts (Ready for Backend)

All `/routes/api/` endpoints are currently mock implementations defined by strict JSON contracts. They are ready for a 1:1 replacement with real backend databases and Python AI engines:

### Followers & Circles
- `POST /api/followers/follow` & `/unfollow`
- `GET /api/followers/status/:userId`
- `POST /api/circles/:circleId/join` & `/leave`

### Synthesis & AI
- `POST /api/synthesis/parse` - Extracts link metadata
- `POST /api/synthesis/create-artifact`
- `GET /api/ai/analyze/:artifactId` - Starts 4-stage pipeline

### Analytics
- `GET /api/mirror` - Fetches engagement stats and timeline

## 🚀 Getting Started

### Development Mode
To run the Deno Frontend locally:
```bash
cd frontend-gateway
deno task start
```
The app will be available at `http://localhost:8000`

### Test the 4 Core Flows
1. **Community (`/connections`)**: View the Thought Stream, filter by followers, and join Circles.
2. **Synthesis (`/rooms`)**: Copy a URL and paste it to watch the Synthesis Engine parse and store it.
3. **AI Analysis (`/ai-analysis`)**: Start an analysis and watch the 4-stage pattern detection pipeline.
4. **Analytics (`/mirror`)**: View your engagement stats and follower growth timeline.

## ⚡ Performance Optimization
- **Lazy Loading**: Components load on-demand via Intersection Observers.
- **API Response Caching**: Intelligent TTL-based caching reduces network calls (`utils/cache.ts`).
- **Animation Optimization**: RequestAnimationFrame (RAF) throttling for smooth 60fps performance on cubic-bezier animations.

## 🧪 Contributing

We welcome pull requests. The Muse project is built in the spirit of
**ubuntu** — *"I am because we are."* Every contribution, from a typo fix
to a new synthesis engine, strengthens the collective.

Before opening a PR, please read **[CONTRIBUTING.md](./CONTRIBUTING.md)**.
It covers the dev environment, the test suite, the PR process, and links
to the per-area agent skills in `.agent/skills/`.

A few quick entry points:

| What you want to do | Where to look |
| --- | --- |
| Touch a Fresh island or component | `frontend-gateway/islands/`, `frontend-gateway/components/` |
| Add a new API route | `frontend-gateway/routes/api/` |
| Tweak the AI scrapers / synthesizer | `ai-engine/scrapers/`, `ai-engine/synthesizer.py` |
| Work on the Solana / crypto node | `blockchain-security/src/`, `blockchain-security/contracts/` |
| Update CI, dependabot, or templates | `.github/` |
| Update docs | `docs/` |

## 🚢 Deployment

The full production stack — `frontend-gateway`, `ai-engine`, and
`blockchain-security` — is currently shaped for **Render** (see
`render.yaml`) with a managed **PostgreSQL** instance for persistent
data. Local reproduction is one command:

```bash
docker-compose up --build
```

The `ai-engine` Dockerfile installs Playwright + Chromium, Tesseract OCR,
and Poppler, so the first build pulls a few hundred MB of system
packages — budget for it.

> **Heads up:** production deploy needs two more pieces before it is
> non-trivial: a managed Postgres URL injected via `DATABASE_URL` and a
> long-lived secret for the `OPENAI_API_KEY` used by the synthesizer.
> Both should be added to the Render service's environment, **never**
> to the repository.

## 🔐 Security Roadmap (Moving to Production)

**Current State**: In-memory data, mock authentication (user-123).
**Next Steps**:
- [ ] HTTPS/TLS Enforcement & OAuth2 Authentication
- [ ] Encrypted Database Backend (PostgreSQL/MongoDB)
- [ ] WebSocket integration for real-time collaborative features
- [ ] Real AI Pipeline implementation

---

*“Where diverse signals from your rooms converge into living documents of collective intelligence.”*

**Platform Status**: ✅ MVP Ready | **Version**: 2.0 (Phase Alpha) | **Last Updated**: 2026-05-22
