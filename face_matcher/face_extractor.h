// face_extractor.h

#ifndef FACE_EXTRACTOR_H
#define FACE_EXTRACTOR_H

#include <opencv2/opencv.hpp>
#include <vector>
#include <tuple>

/**
 * @brief Extracts and preprocesses faces from an input image using a specified face detector.
 *
 * This function takes an input image and a pre-trained face detector (CascadeClassifier), detects faces
 * within the image, and preprocesses each detected face to a specified target size. Each face is resized
 * to maintain its aspect ratio, padded to match the exact target dimensions, normalized to have pixel values
 * within [0, 1], and stored along with its bounding rectangle.
 *
 * @param img The input image from which faces are to be extracted.
 * @param detector A reference to a cv::CascadeClassifier object used for detecting faces in the image.
 * @param target_size The target size to which each detected face is resized and padded. Defaults to (224, 224).
 *
 * @return A vector of tuples. Each tuple contains a cv::Mat (the preprocessed face image, normalized) and a 
 * cv::Rect (the bounding rectangle of the detected face in the input image).
 * 
 * The function handles cases where the image or detector might not be properly set up, returning an empty vector 
 * and printing an error message in such cases.
 */
std::vector<std::tuple<cv::Mat, cv::Rect>> extractFaces(
    const cv::Mat& img,
    cv::CascadeClassifier& detector,
    const cv::Size& target_size = cv::Size(224, 224));

#endif // FACE_EXTRACTOR_H