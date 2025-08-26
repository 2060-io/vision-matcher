#!/bin/bash

# Create the bin directory if it does not exist
mkdir -p bin

# Compile face_matcher with g++ (now includes IPC transport/protocol and uses C++17)
g++ \
  -I./include \
  -I./ipc \
  -std=c++17 \
  main.cpp \
  ./src/argument_parser.cpp \
  ./src/detector.cpp \
  ./src/face_extractor.cpp \
  ./src/prediction.cpp \
  ./src/utils.cpp \
  ./ipc/unix_socket_transport.cc \
  ./ipc/protocol_handler.cc \
  -o ./bin/face_matcher \
  `pkg-config --cflags --libs opencv4`