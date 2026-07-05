FROM denoland/deno:alpine-1.40.3

WORKDIR /app

# Cache dependencies
COPY deno.json .
RUN deno cache deno.json || true

COPY . .

# Build Fresh assets (compiles Tailwind CSS)
# Set a dummy DATABASE_URL for build time (Fresh build imports some files that check for DB)
ARG DATABASE_URL=dummy://build
ENV DATABASE_URL=${DATABASE_URL}
RUN deno run -A --unstable-kv dev.ts build

EXPOSE 8000

# Run in production mode (not dev mode)
CMD ["deno", "run", "-A", "--unstable-kv", "main.ts"]
