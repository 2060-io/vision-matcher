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

## Usage

Once the server is running (either natively or in a Docker container), you can send HTTP requests to the `/face_match` endpoint for face matching operations.

## Testing the Application

To test the face matching functionality, you can use a tool like `curl` to send a POST request to the `/face_match` endpoint. Here's an example:

```bash
curl -X POST http://localhost:5123/face_match \
        -H "Content-Type: application/json" \
        -d '{
            "image1_url": "file:/home/path/to/vision-matcher/test/assets/angelina1.jpeg",
            "image2_url": "file:/home/path/to/vision-matcher/test/assets/angelina2.jpeg"
            }'
```

This command sends a request with two image URLs to compare, and the server responds with the result of the face matching operation.

## License

This project is licensed under terms specified in the `LICENSE` file.

## Additional Information

The model used for face matching can be downloaded by running `download_model.sh` available in the root of the project. Make sure to have either `curl` or `wget` installed:

```bash
./download_model.sh
```
