// detector.h

#ifndef DETECTOR_H
#define DETECTOR_H

#include <string>
#include <opencv2/opencv.hpp>

/**
 * Function to initialize a face detector using the OpenCV CascadeClassifier.
 * 
 * @param face_detector_path - A string representing the file path to the 
 *                             pre-trained cascade classifier XML file.
 *                             This file contains the data needed to detect faces.
 * 
 * @return A cv::CascadeClassifier object that is initialized with the
 *         specified face detection data. This object can be used to perform
 *         face detection on images or video frames.
 */
cv::CascadeClassifier getDetector(const std::string& face_detector_path);

#endif // DETECTOR_H