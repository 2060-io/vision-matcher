#!/bin/bash

# Create the bin directory if it does not exist
mkdir -p bin

# Compile face_matcher with g++
g++ -I./include main.cpp ./src/argument_parser.cpp ./src/detector.cpp ./src/face_extractor.cpp ./src/prediction.cpp ./src/utils.cpp -std=c++11 -o ./bin/face_matcher `pkg-config --cflags --libs opencv4`