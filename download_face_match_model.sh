#!/bin/bash

# Define the URL to download the ONNX model from
ONNX_MODEL_URL="https://github.com/2060-io/vision-face-matcher-model/releases/download/v1.0.0/face_matcher_model.onnx"

# Define the output file path
OUTPUT_FILE="face_matcher_model.onnx"

# Use curl or wget to download the file
if command -v curl &> /dev/null; then
    echo "Downloading ONNX model using curl..."
    curl -L -o "$OUTPUT_FILE" "$ONNX_MODEL_URL"
elif command -v wget &> /dev/null; then
    echo "Downloading ONNX model using wget..."
    wget -O "$OUTPUT_FILE" "$ONNX_MODEL_URL"
else
    echo "Error: neither curl nor wget is installed."
    exit 1
fi

echo "Download completed: $OUTPUT_FILE"