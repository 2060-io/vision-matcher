#!/bin/bash

# Check if an OpenCV path is provided as the first argument
if [ "$1" ]; then
    OPENCV_DIR_OPTION="-DOpenCV_DIR=$1"
    echo "Using provided OpenCV directory: $1"
else
    OPENCV_DIR_OPTION=""
    echo "No OpenCV directory provided, using system default."
fi

# Clean up previous builds
rm -rf build
rm -rf bin

# Create necessary directories
mkdir build
mkdir bin

# Navigate into the build directory
cd build

# Configure the project with CMake (additional OpenCV option if provided)
cmake $OPENCV_DIR_OPTION ..

# Compile the project
make

# Copy the output binary to the specified bin directory
cp ./bin/face_matcher ../bin/