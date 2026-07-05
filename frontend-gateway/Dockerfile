FROM denoland/deno:alpine-1.40.3

WORKDIR /app

# Cache dependencies
COPY deno.json .
RUN deno cache deno.json || true

COPY . .

# Build Fresh assets (compiles Tailwind CSS)
RUN deno run -A --unstable-kv dev.ts build

EXPOSE 8000

# Run in production mode (not dev mode)
CMD ["deno", "run", "-A", "--unstable-kv", "main.ts"]
