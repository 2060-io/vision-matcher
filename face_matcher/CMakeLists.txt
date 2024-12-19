# Minimum CMake version required
cmake_minimum_required(VERSION 3.10)

# Project name
project(FaceMatcher)

# Set C++ version
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Optionally specify an OpenCV directory
set(OpenCV_DIR "" CACHE PATH "Path to OpenCV installation")

# Optionally choose to link against static libraries
option(USE_OPENCV_STATIC "Link against OpenCV static libraries" OFF)

# Find OpenCV package using either a provided path or default system paths
if(OpenCV_DIR)
    # Explicitly provide the OpenCV directory to CMake's search path
    list(APPEND CMAKE_PREFIX_PATH ${OpenCV_DIR})
endif()

# Find OpenCV package with consideration for static or dynamic linking
if(USE_OPENCV_STATIC)
    # If using static libraries, ensure this flag is set
    set(OpenCV_STATIC ON)
    find_package(OpenCV REQUIRED)
else()
    find_package(OpenCV REQUIRED)
endif()

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
if(USE_OPENCV_STATIC)
    # This is just for clarification (maybe I will add some other libraries)
    # This may include linking against system libraries manually, e.g., pthread, dl, etc.
    target_link_libraries(face_matcher ${OpenCV_LIBS})
else()
    target_link_libraries(face_matcher ${OpenCV_LIBS})
endif()

# Set output directory for the executable
set_target_properties(face_matcher PROPERTIES RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)