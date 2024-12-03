// utils.h

#ifndef UTILS_H
#define UTILS_H

#include <opencv2/opencv.hpp>

/**
 * @brief Performs L2 normalization on a vector represented by an OpenCV Matrix.
 *
 * This function normalizes the input vector such that its L2 norm (Euclidean norm)
 * is equal to 1. L2 normalization is commonly used to scale the components of a vector
 * so that the vector's magnitude is 1, maintaining the direction of the vector.
 *
 * @param x The vector as a `cv::Mat` to be normalized.
 * @return A `cv::Mat` representing the L2-normalized vector.
 */
cv::Mat l2_normalize(const cv::Mat& x);

#endif // UTILS_H