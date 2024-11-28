   #!/bin/bash

   # Compile face_matcher.cpp with g++
   g++ face_matcher.cpp -std=c++11 -o face_matcher `pkg-config --cflags --libs opencv4`