// detector.cpp

#include "detector.h"

cv::CascadeClassifier getDetector(const std::string& face_detector_path) {
    // Initialize a CascadeClassifier object with the provided file path.
    // This attempts to load the classifier data from the file.
    cv::CascadeClassifier detector(face_detector_path);

    // Return the initialized CascadeClassifier object.
    return detector;
}