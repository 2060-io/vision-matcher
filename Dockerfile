FROM node:22-bookworm-slim AS base
WORKDIR /app
# Enable pnpm via Corepack
RUN corepack enable

# Stage 1: builder

FROM base AS builder

# Build essentials and OpenCV for the C++ matcher
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        libopencv-dev \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Copy package metadata first to leverage Docker cache
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the full source tree
COPY . .

# Download the ONNX model and compile the C++ binary
RUN chmod +x download_face_match_model.sh && ./download_face_match_model.sh
RUN cd face_matcher && chmod +x gpp_build_face_matcher.sh && ./gpp_build_face_matcher.sh

# Build app
RUN pnpm run build

# Keep only production dependencies
RUN pnpm prune --prod

# Stage 2: runtime

FROM base AS runtime

# Runtime libraries required by the C++ binary
RUN apt-get update && \
    apt-get install -y --no-install-recommends libopencv-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules and compiled JS
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copy resources needed by the matcher at runtime
COPY --from=builder /app/haarcascade_frontalface_default.xml .
COPY --from=builder /app/face_matcher_model.onnx .
COPY --from=builder /app/face_matcher/bin ./face_matcher/bin

ENV NODE_ENV=production
EXPOSE 5123

CMD ["node", "dist/index.js"]
