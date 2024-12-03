   #!/bin/bash
   
   # Create the bin directory if it does not exist
   mkdir -p bin
   
   # Compile face_matcher.cpp with g++
   g++ face_matcher.cpp -std=c++11 -o ./bin/face_matcher `pkg-config --cflags --libs opencv4`