#!/bin/bash

# Initialize variables for options
OPENCV_DIR=""
USE_STATIC=OFF

# Function to display usage information
usage() {
    echo "Usage: $0 [-d <opencv_dir>] [-s]"
    echo "Options:"
    echo "  -d <opencv_dir> : Path to the OpenCV installation directory."
    echo "  -s              : Use static OpenCV libraries (default is dynamic)."
    exit 1
}

# Parse command line options
while getopts "d:s" opt; do
    case ${opt} in
        d)
            OPENCV_DIR=$OPTARG
            ;;
        s)
            USE_STATIC=ON
            ;;
        *)
            usage
            ;;
    esac
done

# Prepare CMake options
if [ -n "$OPENCV_DIR" ]; then
    OPENCV_DIR_OPTION="-DOpenCV_DIR=$OPENCV_DIR"
    echo "Using specified OpenCV directory: $OPENCV_DIR"
else
    OPENCV_DIR_OPTION=""
    echo "No explicit OpenCV directory provided, using system default."
fi

if [ "$USE_STATIC" = "ON" ]; then
    STATIC_OPTION="-DUSE_OPENCV_STATIC=ON"
    echo "Configuring for static OpenCV libraries."
else
    STATIC_OPTION=""
    echo "Configuring for dynamic OpenCV libraries."
fi

# Clean up previous builds
rm -rf build
rm -rf bin

# Create necessary directories
mkdir build
mkdir bin

# Navigate into the build directory
cd build

# Configure the project with CMake using the specified options
cmake $OPENCV_DIR_OPTION $STATIC_OPTION ..

# Compile the project
make

# Copy the output binary to the specified bin directory
cp ./bin/face_matcher ../bin/