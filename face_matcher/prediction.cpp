// prediction.cpp

#include "prediction.h"
#include <stdexcept>
#include <cmath>

cv::Mat getPrediction(const cv::Mat& image, cv::dnn::Net& opencv_model) {
    // Validate the input image dimensions and channels.
    if (image.size() != cv::Size(224, 224) || image.channels() != 3) {
        throw std::invalid_argument("Image must be 224x224 with 3 channels.");
    }

    int onnx_model_shape[] = {1, 224, 224, 3}; // Define the shape expected by the ONNX model
    cv::Mat blob = image.reshape(1, 4, onnx_model_shape); // Reshape the image to a 4-dimensional blob
    opencv_model.setInput(blob); // Set the blob as input to the DNN model
    cv::Mat opencv_pred = opencv_model.forward(); // Perform a forward pass to get the prediction
    return opencv_pred; // Return the prediction
}

double findCosineDistance(const cv::Mat& source_representation, const cv::Mat& test_representation) {
    // Reshape the source representation into a single row vector.
    cv::Mat source_vec = source_representation.reshape(1, 1);

    // Reshape the test representation into a single row vector.
    cv::Mat test_vec = test_representation.reshape(1, 1);

    // Compute the dot product of the source and test vectors.
    double a = source_vec.dot(test_vec);

    // Compute the dot product of the source vector with itself.
    double b = source_vec.dot(source_vec);

    // Compute the dot product of the test vector with itself.
    double c = test_vec.dot(test_vec);

    // Calculate and return the cosine distance using the formula:
    // 1.0 - (dot product of vectors / (magnitude of source vector * magnitude of test vector))
    return 1.0 - (a / (sqrt(b) * sqrt(c)));
}

double findEuclideanDistance(const cv::Mat& source_representation, const cv::Mat& test_representation) {
    // Reshape the source representation into a single row vector.
    cv::Mat source_vec = source_representation.reshape(1, 1);

    // Reshape the test representation into a single row vector.
    cv::Mat test_vec = test_representation.reshape(1, 1);

    // Compute the difference between the source and test vectors.
    cv::Mat diff = source_vec - test_vec;

    // Calculate the squared distance (dot product of the difference with itself).
    double squared_distance = diff.dot(diff);

    // Return the Euclidean distance by taking the square root of the squared distance.
    return std::sqrt(squared_distance);
}