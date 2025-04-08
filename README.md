# Vision Matcher

Vision Matcher is a project that provides a face matching utility. It includes a C++ binary application that performs face matching, as well as a Node.js server that interfaces with this application to provide an HTTP endpoint for matching faces.

## Index

- [Vision Matcher](#vision-matcher)
  - [Index](#index)
  - [Project Structure](#project-structure)
  - [Building the Face Matcher Binary](#building-the-face-matcher-binary)
    - [Using CMake](#using-cmake)
    - [Using G++](#using-g)
  - [Node.js Server](#nodejs-server)
    - [Setting up the Server](#setting-up-the-server)
  - [Docker](#docker)
    - [Building the Docker Image](#building-the-docker-image)
    - [Running the Docker Container](#running-the-docker-container)
  - [Usage](#usage)
  - [Testing the Application](#testing-the-application)
  - [License](#license)
  - [Additional Information](#additional-information)

## Project Structure

- `face_matcher/`: Contains the C++ source code for the face matching binary application.

  - `bin/`: Directory where the compiled `face_matcher` binary will be placed.
  - `include/`: Header files for the face matcher source code.
  - `src/`: C++ source files implementing the face matcher functionality.
  - `CMakeLists.txt`: Configuration file for building the project using CMake.
  - `cmake_build_face_matcher.sh`, `gpp_build_face_matcher.sh`: Bash scripts for building the `face_matcher` binary using different methods.

- `face_matcher_model.onnx`: Pre-trained machine learning model used for face matching (This file should be downloaded using the `download_model.sh` script).

- `haarcascade_frontalface_default.xml`: XML file used for facial detection.

- `server.js`: Node.js server file that uses the `face_matcher` application and exposes a REST endpoint.

- `test/`: Contains unit tests for the face match endpoint.

- `Dockerfile`: Used to containerize the application, allowing it to run in any environment that supports Docker.

## Building the Face Matcher Binary

Face Matcher requires OpenCV. Therefore, before trying to build it, you'll need to install it:

- Debian: install package libopencv
- Arch: install packages opencv, hdf5 and vtk

To build the `face_matcher` binary, navigate to the `face_matcher` directory and run one of the provided shell scripts:

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

After a successful build, the binary will be located in the `face_matcher/bin/` directory.

## Node.js Server

The Node.js server uses the `face_matcher` binary to handle HTTP requests for face matching. It exposes an endpoint at `/face_match`.

### Setting up the Server

1. Ensure you have Node.js (<18) and npm installed.
2. Install the necessary dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   node server.js
   ```

## Environment Variables

| Variable          | Default | Description                             |
| ----------------- | ------- | --------------------------------------- |
| `MAX_IMAGE_BYTES` | `500`   | Max allowed image size per file (in KB) |
| `PORT`            | `5123`  | Port os service                         |

## Docker

You can use Docker to containerize and run the entire application, simplifying deployment.

### Building the Docker Image

Run the following command in the root of the project to build the Docker image:

```bash
docker build -t vision-matcher .
```

### Running the Docker Container

Once the image is built, you can run a container with the following command:

```bash
docker run -p 5123:5123 vision-matcher
```

This will start the Node.js server within a Docker container and expose it on port 5123.

### Using Docker Compose

To run the service along with all its dependencies using Docker Compose, create a file named `docker-compose.yml` run the service with following:
Then run:

```bash
docker compose up --build
```

This will:

- Build the Docker image
- Start the container
- Expose port `5123` for HTTP requests

You can then send requests to:

```bash
http://localhost:5123/face_match
```

## Usage

Send a POST request to `/face_match` with two image URLs (supports `http(s)://`, `file://`, and base64 `data:image/...`):

```bash
curl -X POST http://localhost:5123/face_match \
     -H "Content-Type: application/json" \
     -d '{
           "image1_url": "file:/path/to/angelina1.jpeg",
           "image2_url": "file:/path/to/angelina2.jpeg"
         }'
```

### Example response

```json
{
  "match": true,
  "distance": 0.432,
  "requestId": 1712490001234
}
```

If an image exceeds the size limit (`MAX_IMAGE_KB`), the server responds with:

```json
{
  "error": "Image exceeds size limit"
}
```

## License

This project is licensed under terms specified in the `LICENSE` file.

## Additional Information

The model used for face matching can be downloaded by running `download_model.sh` available in the root of the project. Make sure to have either `curl` or `wget` installed:

```bash
./download_model.sh
```
