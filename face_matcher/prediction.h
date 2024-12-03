// prediction.h

#ifndef PREDICTION_H
#define PREDICTION_H

#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>
#include <string>

/**
 * @brief Generates a prediction using a pre-trained OpenCV DNN model.
 *
 * This function takes an input image and a pre-trained OpenCV DNN model,
 * preprocesses the image, and then uses the model to generate a prediction.
 * 
 * The input image must be 224x224 pixels and have exactly 3 channels 
 * (typically RGB). The image is reshaped into a blob that matches the 
 * input format expected by ONNX models, and the model then performs 
 * a forward pass to compute the prediction.
 *
 * @param image The input cv::Mat image that must be of size 224x224 and have 3 channels.
 * @param opencv_model The OpenCV DNN network model to be used for prediction.
 * @return cv::Mat The prediction result as a cv::Mat.
 * @throws std::invalid_argument If the input image does not have the required size or channels.
 */
cv::Mat getPrediction(const cv::Mat& image, cv::dnn::Net& opencv_model);

/**
 * @brief Computes the cosine distance between two vectors represented by OpenCV Matrices.
 *
 * This function calculates the cosine distance between two input vectors
 * represented as `cv::Mat` objects. The cosine distance is a measure of
 * dissimilarity between two non-zero vectors. It ranges from 0 (indicating no
 * dissimilarity, meaning the vectors are identical) to 1 (indicating maximum
 * dissimilarity, meaning the vectors are orthogonal).
 *
 * @param source_representation The first vector as a `cv::Mat`.
 * @param test_representation The second vector as a `cv::Mat`.
 * @return A `double` representing the cosine distance between the two vectors.
 */
double findCosineDistance(const cv::Mat& source_representation, const cv::Mat& test_representation);

/**
 * @brief Computes the Euclidean distance between two vectors represented by OpenCV Matrices.
 *
 * This function calculates the Euclidean distance between two input vectors
 * represented as `cv::Mat` objects. The Euclidean distance is the "ordinary" straight-line
 * distance between two points in Euclidean space and is a widely used distance metric
 * for comparing the similarity between two vectors.
 *
 * @param source_representation The first vector as a `cv::Mat`.
 * @param test_representation The second vector as a `cv::Mat`.
 * @return A `double` representing the Euclidean distance between the two vectors.
 */
double findEuclideanDistance(const cv::Mat& source_representation, const cv::Mat& test_representation);

#endif // PREDICTION_H