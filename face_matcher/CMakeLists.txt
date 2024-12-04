# Minimum CMake version required
cmake_minimum_required(VERSION 3.10)

# Project name
project(FaceMatcher)

# Set C++ version
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Find required packages
find_package(OpenCV REQUIRED)

# Include directories
include_directories(${OpenCV_INCLUDE_DIRS} include)

# Source files
set(SOURCES
    main.cpp
    src/argument_parser.cpp
    src/detector.cpp
    src/face_extractor.cpp
    src/prediction.cpp
    src/utils.cpp
)

# Add executable target
add_executable(face_matcher ${SOURCES})

# Link libraries
target_link_libraries(face_matcher ${OpenCV_LIBS})

# Set output directory for the executable
set_target_properties(face_matcher PROPERTIES RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)