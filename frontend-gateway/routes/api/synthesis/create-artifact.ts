import { executeDB } from "../../../utils/db.ts";
import {
  isDemoUser,
  requireDemoOrSession,
} from "../../../utils/auth.ts";

interface LinkMetadata {
  title: string;
  description: string;
  image?: string;
  url: string;
  source: string;
}

interface ArtifactCreateRequest {
  metadata: LinkMetadata;
  roomId?: string;
}

interface Artifact {
  id: string;
  title: string;
  url: string;
  type: "link";
  metadata: LinkMetadata;
  roomId?: string;
  createdAt: string;
}

const ARTIFACTS_SCHEMA_MIGRATION = `
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'artifacts' AND column_name = 'room_id' AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE artifacts ALTER COLUMN room_id DROP NOT NULL;
    END IF;
  END $$;
`;

const ARTIFACTS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    source_url TEXT,
    unstructured_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )
`;

async function ensureArtifactsTable() {
  await executeDB(ARTIFACTS_SCHEMA);
  await executeDB(ARTIFACTS_SCHEMA_MIGRATION);
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const handler = async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let currentUserId: string;
  try {
    currentUserId = await requireDemoOrSession(req);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  try {
    await ensureArtifactsTable();

    const { metadata, roomId }: ArtifactCreateRequest = await req.json();

    if (!metadata || !metadata.url) {
      return jsonResponse(
        { error: "Metadata with URL required" },
        400,
      );
    }

    if (isDemoUser(currentUserId)) {
      const artifact: Artifact = {
        id: `demo-${crypto.randomUUID()}`,
        title: metadata.title,
        url: metadata.url,
        type: "link",
        metadata,
        roomId,
        createdAt: new Date().toISOString(),
      };
      return jsonResponse(
        { ...artifact, demo: true },
        201,
      );
    }

    const result = await executeDB(
      `INSERT INTO artifacts (room_id, type, source_url, unstructured_data)
       VALUES ($1, 'link', $2, $3::jsonb)
       RETURNING id, created_at`,
      roomId ?? null,
      metadata.url,
      JSON.stringify(metadata),
    );

    const row = result.rows[0] as { id: string; created_at: string };

    const artifact: Artifact = {
      id: row.id,
      title: metadata.title,
      url: metadata.url,
      type: "link",
      metadata,
      roomId,
      createdAt: typeof row.created_at === "string"
        ? row.created_at
        : new Date(row.created_at).toISOString(),
    };

    return jsonResponse(artifact as unknown as Record<string, unknown>, 201);
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : "Failed to create artifact";
    return jsonResponse({ error: message }, 400);
  }
};