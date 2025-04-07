FROM node:22-bookworm-slim AS builder

# Install necessary build tools and OpenCV
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libopencv-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only package metadata for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Download face matcher model
RUN chmod +x download_face_match_model.sh && ./download_face_match_model.sh

# Build face_matcher binary (C++)
RUN cd face_matcher && chmod +x gpp_build_face_matcher.sh && ./gpp_build_face_matcher.sh

# Build TypeScript
RUN npm run build

# -----------------------
# STAGE 2: RUNTIME STAGE
# -----------------------
FROM node:20-bookworm-slim AS runtime

# Install runtime dependencies for C++ binary
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only production dependencies
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Copy compiled JS files
COPY --from=builder /app/dist ./dist

# Copy config, model files, and face matcher binary
COPY --from=builder /app/haarcascade_frontalface_default.xml .
COPY --from=builder /app/face_matcher_model.onnx .
COPY --from=builder /app/face_matcher/bin ./face_matcher/bin

# Expose the app port
EXPOSE 5123

# Run the server
CMD ["node", "dist/index.js"]
