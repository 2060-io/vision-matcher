// utils.cpp

#include "utils.h"
#include <cmath>

cv::Mat l2_normalize(const cv::Mat& x) {
    // Reshape the input matrix into a single row vector.
    cv::Mat x_vec = x.reshape(1, 1);

    // Calculate the L2 norm of the vector (square root of the dot product of the vector with itself).
    double norm = std::sqrt(x_vec.dot(x_vec));

    // Declare a matrix to hold the normalized vector.
    cv::Mat normalized_x;

    // Normalize the vector by dividing each component by its L2 norm.
    cv::divide(x_vec, norm, normalized_x);

    // Return the normalized vector.
    return normalized_x;
}
