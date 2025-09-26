# Vision Matcher

Vision Matcher provides a face-matching utility. It consists of a **C++ binary** that performs the comparison and a **Node.js** server that wraps the binary and exposes an HTTP API.

---

## Index

- [Vision Matcher](#vision-matcher)
  - [Index](#index)
  - [Project Structure](#project-structure)
  - [Building the Face Matcher Binary](#building-the-face-matcher-binary)
    - [Using CMake](#using-cmake)
    - [Using G++](#using-g)
  - [Node.js Server](#nodejs-server)
    - [Setting up the Server](#setting-up-the-server)
  - [Environment Variables](#environment-variables)
  - [Docker](#docker)
    - [Building the Docker Image](#building-the-docker-image)
    - [Running the Docker Container](#running-the-docker-container)
    - [Using Docker Compose](#using-docker-compose)
  - [Usage](#usage)
  - [License](#license)
  - [Additional Information](#additional-information)

---

## Project Structure

- `face_matcher/` – C++ sources for the face-matching binary.
  - `bin/` – Target directory for the compiled `face_matcher` binary.
  - `include/` – C++ headers.
  - `src/` – C++ sources.
  - `CMakeLists.txt` – CMake configuration.
  - `cmake_build_face_matcher.sh`, `gpp_build_face_matcher.sh` – Helper scripts to compile the binary.

- `face_matcher_model.onnx` – Pre-trained model used by the C++ matcher (downloaded via a script, see below).

- `haarcascade_frontalface_default.xml` – Cascade used for face detection.

- **Server code** – The HTTP server that calls the binary.
  - If the repository exposes TypeScript, the entry point is commonly `src/index.ts` (built to `dist/index.js`).

- `test/` – tests for the API.

- `Dockerfile` – Container build definition.

> **Tip:** Make sure your system has a C++ toolchain and OpenCV dev packages installed before compiling the binary.

---

## Building the Face Matcher Binary

The face matcher depends on **OpenCV**. Install development packages before building:

- **Debian/Ubuntu:** `sudo apt-get update && sudo apt-get install -y libopencv-dev build-essential cmake`
- **Arch Linux:** `sudo pacman -S opencv hdf5 vtk base-devel cmake`

Then build the `face_matcher` binary from the `face_matcher` directory using one of the scripts below.

### Using CMake

```bash
cd face_matcher
./cmake_build_face_matcher.sh
```

### Using G++

```bash
cd face_matcher
./gpp_build_face_matcher.sh
```

After a successful build, verify the binary exists at `face_matcher/bin/face_matcher`.

---

## Node.js Server

The Node server exposes an HTTP endpoint (`/face_match`) and shells out to the C++ matcher.

### Setting up the Server

1. **Install dependencies** at the repository root:

   ```bash
   pnpm install
   ```

2. **Download the model** (required for matching):

   ```bash
   ./download_model.sh
   # In some versions this script may be named:
   # ./download_face_match_model.sh
   ```

3. **Run the server**
   - **Development (TypeScript projects):**

     ```bash
     pnpm run dev
     ```

   - **Production build (TypeScript projects):**

     ```bash
     pnpm run build
     pnpm run start
     ```

> **Troubleshooting:** Ensure the C++ binary is compiled and accessible at `face_matcher/bin/face_matcher`. The server expects to find and execute it.

---

## Environment Variables

| Variable | Default | Description               |
| -------- | ------- | ------------------------- |
| `PORT`   | `5123`  | HTTP port for the server. |

> Define variables in a local `.env` (not committed) or export them in your shell before starting the server.

---

## Docker

Containerization is the fastest way to run the service without installing system dependencies.

### Building the Docker Image

```bash
docker build -t vision-matcher .
```

### Running the Docker Container

```bash
docker run --rm -p 5123:5123 vision-matcher
```

The server will be available on `http://localhost:5123`.

### Using Docker Compose

Create a `docker-compose.yml` and then run:

```bash
docker compose up --build
```

This will build the image, start the container, and expose port `5123`.

---

## Usage

Send a `POST` request to `/face_match` with two image inputs. The service accepts:

- Web URLs: `http(s)://...`
- Local files: `file://...`
- Base64 data URLs: `data:image/<type>;base64,...`

- **Example:**

```bash
curl -X POST http://localhost:5123/face_match \
     -H "Content-Type: application/json" \
     -d '{
           "image1_url": "file:/path/to/angelina1.jpeg",
           "image2_url": "file:/path/to/angelina2.jpeg"
         }'
```

- **Example response**

```json
{
  "match": true,
  "distance": 0.432,
  "requestId": 1712490001234
}
```

- `match` – Whether the faces are considered the same person.
- `distance` – Similarity score (lower usually means more similar).
- `requestId` – Server-side request identifier.

---

## License

This project is licensed under the terms specified in the [`LICENSE`](./LICENSE) file.

---

## Additional Information

- The face-matching model is downloaded by the helper script in the repo root (see **Setting up the Server**, step 2). Ensure `curl` or `wget` is available.
