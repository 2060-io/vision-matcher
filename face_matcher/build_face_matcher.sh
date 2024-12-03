#!/bin/bash

# Create the bin directory if it does not exist
mkdir -p bin

# Compile face_matcher with g++
g++ face_matcher.cpp argument_parser.cpp detector.cpp face_extractor.cpp prediction.cpp utils.cpp -std=c++11 -o ./bin/face_matcher `pkg-config --cflags --libs opencv4`