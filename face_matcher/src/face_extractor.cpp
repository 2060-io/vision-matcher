// face_extractor.cpp

#include "face_extractor.h"
#include <iostream>

std::vector<std::tuple<cv::Mat, cv::Rect>> extractFaces(
    const cv::Mat& img,
    cv::CascadeClassifier& detector,
    bool allow_multi_faces,
    const cv::Size& target_size) {

    // This vector will store the detected and processed face images and their bounding rectangles.
    std::vector<std::tuple<cv::Mat, cv::Rect>> extracted_faces;

    // Check if the input image is valid and not empty.
    if (img.empty()) {
        std::cerr << "Could not read the image." << std::endl; // Inform the user of the error.
        return extracted_faces; // Return an empty result in case of an error.
    }

    // Check if the face detector is properly loaded and valid.
    if (detector.empty()) {
        std::cerr << "Error loading cascade file for face detection." << std::endl; // Inform the user of the detection issue.
        return extracted_faces; // Return an empty result in case of an error.
    }

    // Vector to hold the bounding rectangles of detected faces.
    std::vector<cv::Rect> faces;
    // Detect faces in the image using the provided cascade classifier.
    detector.detectMultiScale(img, faces, 1.1, 10);

    // Check if allow_multi_faces is false and more than one face is detected.
    if (!allow_multi_faces && faces.size() != 1) {
        return std::vector<std::tuple<cv::Mat, cv::Rect>>(); // Return an empty vector.
    }

    // Iterate over each detected face.
    for (const auto &face : faces) {
        // Extract the sub-image of the detected face using the bounding rectangle.
        cv::Mat detected_face = img(face);

        // Ensure the extracted region is not empty.
        if (detected_face.rows > 0 && detected_face.cols > 0) {
            // Calculate the scaling factors for resizing the face to the target size.
            double factor_0 = double(target_size.height) / detected_face.rows;
            double factor_1 = double(target_size.width) / detected_face.cols;
            double factor = std::min(factor_0, factor_1); // Use the smaller factor to maintain aspect ratio.

            // Resize the face to fit within the target size, maintaining aspect ratio.
            cv::resize(detected_face, detected_face, cv::Size(), factor, factor);

            // Calculate the padding needed to reach the exact target size.
            int diff_0 = target_size.height - detected_face.rows;
            int diff_1 = target_size.width - detected_face.cols;

            // Add padding to the resized face image to match the target size, centering the face.
            cv::copyMakeBorder(detected_face, detected_face,
                diff_0 / 2, diff_0 - diff_0 / 2, // Top and bottom padding.
                diff_1 / 2, diff_1 - diff_1 / 2, // Left and right padding.
                cv::BORDER_CONSTANT, cv::Scalar(0, 0, 0)); // Use black color for padding.

            // Final check and resize to ensure the face image is exactly the target size.
            if (detected_face.size() != target_size) {
                cv::resize(detected_face, detected_face, target_size);
            }

            // Normalize the pixel intensities to the range [0, 1] by converting to CV_32F.
            detected_face.convertTo(detected_face, CV_32F, 1.0 / 255);

            // Push the processed face image and its bounding rectangle into the output vector.
            extracted_faces.push_back(std::make_tuple(detected_face, face));
        }
    }

    // Return the vector of tuples, each containing a face image and its bounding box.
    return extracted_faces;
}