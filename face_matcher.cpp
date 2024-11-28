#include <opencv2/opencv.hpp>
#include <opencv2/objdetect.hpp>
#include <iostream>
#include <tuple>
#include <vector>
#include <cmath>

cv::CascadeClassifier getDetector() {
    std::string opencv_path = "./";
    std::string face_detector_path = opencv_path + "haarcascade_frontalface_default.xml";
    cv::CascadeClassifier detector(face_detector_path);
    return detector;
}


std::vector<std::tuple<cv::Mat, cv::Rect>> extractFaces(
    const cv::Mat& img,
    cv::CascadeClassifier& detector,
    const cv::Size& target_size = cv::Size(224, 224)) {

    std::vector<std::tuple<cv::Mat, cv::Rect>> extracted_faces;

    if (img.empty()) {
        std::cerr << "Could not read the image." << std::endl;
        return extracted_faces;
    }

    if(detector.empty()) {
        std::cerr << "Error loading cascade file for face detection." << std::endl;
        return extracted_faces;
    }

    std::vector<cv::Rect> faces;
    detector.detectMultiScale(img, faces, 1.1, 10);

    //std::cout << "Faces detected:" << std::endl;
    //for (const auto& face : faces) {
    //    std::cout << "Face at ["
    //              << face.x << ", "
    //              << face.y << ", "
    //              << face.width << ", "
    //              << face.height << "]" << std::endl;
    //}

    // Create the 224x224 face images
    for (const auto &face : faces) {
        cv::Mat detected_face = img(face);

        if (detected_face.rows > 0 && detected_face.cols > 0) {
            double factor_0 = double(target_size.height) / detected_face.rows;
            double factor_1 = double(target_size.width) / detected_face.cols;
            double factor = std::min(factor_0, factor_1);

            cv::resize(detected_face, detected_face, cv::Size(), factor, factor);

            int diff_0 = target_size.height - detected_face.rows;
            int diff_1 = target_size.width - detected_face.cols;

            cv::copyMakeBorder(detected_face, detected_face,
                diff_0 / 2, diff_0 - diff_0 / 2,
                diff_1 / 2, diff_1 - diff_1 / 2,
                cv::BORDER_CONSTANT, cv::Scalar(0, 0, 0));

            if (detected_face.size() != target_size) {
                cv::resize(detected_face, detected_face, target_size);
            }

            detected_face.convertTo(detected_face, CV_32F, 1.0 / 255);

            extracted_faces.push_back(std::make_tuple(detected_face, face));
        }
    }

    return extracted_faces;
}


void printExtractedFaces(const std::vector<std::tuple<cv::Mat, cv::Rect>>& extracted_faces, std::string name) {
    std::cout << "Extracted faces for " << name << std::endl;

    for (const auto& extracted_face_tuple : extracted_faces) {
        const cv::Mat& detected_face = std::get<0>(extracted_face_tuple);
        const cv::Rect& face_rect = std::get<1>(extracted_face_tuple);

        std::cout << "Detected face size: ["
                  << detected_face.rows << " x "
                  << detected_face.cols << "]" << std::endl;

        std::cout << "Face bounding box: ["
                  << face_rect.x << ", "
                  << face_rect.y << ", "
                  << face_rect.width << ", "
                  << face_rect.height << "]" << std::endl;

        // Print the first 10 elements
        std::cout << "First 10 pixel values:" << std::endl;
        int count = 0;
        for (int r = 0; r < detected_face.rows; ++r) {
            for (int c = 0; c < detected_face.cols; ++c) {
                if (count < 10) {
                    cv::Vec3f pixel = detected_face.at<cv::Vec3f>(r, c);
                    std::cout << "("
                              << pixel[0] << ", "
                              << pixel[1] << ", "
                              << pixel[2] << ") ";
                    ++count;
                }
            }
            if (count >= 10) break;
        }
        std::cout << std::endl;
    }
}

cv::Mat getPrediction(const cv::Mat& image, cv::dnn::Net& opencv_model) {
    // Ensure the image has the correct size and number of channels
    if (image.size() != cv::Size(224, 224) || image.channels() != 3) {
        throw std::invalid_argument("Image must be 224x224 with 3 channels.");
    }

    // Define the model shape
    int onnx_model_shape[] = {1, 224, 224, 3};
    // Reshape to the required input shape for the model (NCHW)
    cv::Mat blob = image.reshape(1, 4, onnx_model_shape);

    // Set the input tensor to the model
    opencv_model.setInput(blob);

    // Forward pass to get the predictions
    cv::Mat opencv_pred = opencv_model.forward();

    return opencv_pred;
}


void printPrediction(const cv::Mat& prediction, const std::string& imageName) {
    std::cout << "Prediction for image " << imageName << ":" << std::endl;

    // Reshape prediction to a single row vector if it's not already
    cv::Mat reshapedPred = prediction.reshape(0, 1);

    // Print each element in the prediction
    //for (int i = 0; i < reshapedPred.cols; i++) {
    for (int i = 0; i < 5; i++) {
        std::cout << " " << reshapedPred.at<float>(0, i);
    }
    std::cout << std::endl;
}


double findCosineDistance(const cv::Mat& source_representation, const cv::Mat& test_representation) {
    // Ensure the input vectors are row vectors
    cv::Mat source_vec = source_representation.reshape(1, 1); // Make sure it is a single row
    cv::Mat test_vec = test_representation.reshape(1, 1);     // Make sure it is a single row

    // Compute a = source_vec • test_vec
    double a = source_vec.dot(test_vec);

    // Compute b = Σ(source_vec²)
    double b = source_vec.dot(source_vec);

    // Compute c = Σ(test_vec²)
    double c = test_vec.dot(test_vec);

    // Return cosine distance
    return 1.0 - (a / (sqrt(b) * sqrt(c)));
}

double findEuclideanDistance(const cv::Mat& source_representation, const cv::Mat& test_representation) {
    // Ensure the input vectors are row vectors
    cv::Mat source_vec = source_representation.reshape(1, 1); // 1 row vector
    cv::Mat test_vec = test_representation.reshape(1, 1);     // 1 row vector

    // Compute the Euclidean distance
    cv::Mat diff = source_vec - test_vec; // Subtract the two vectors

    // Element-wise multiplication then sum the elements to get the squared distance
    double squared_distance = diff.dot(diff);

    // Return the Euclidean distance by taking the square root of the squared distance
    return std::sqrt(squared_distance);
}

cv::Mat l2_normalize(const cv::Mat& x) {
    // Reshape the input to ensure it's a row vector for consistency
    cv::Mat x_vec = x.reshape(1, 1); // 1 row vector

    // Compute the L2 norm of the vector
    double norm = std::sqrt(x_vec.dot(x_vec));

    // Normalize by dividing each element by the L2 norm
    cv::Mat normalized_x;
    cv::divide(x_vec, norm, normalized_x);

    return normalized_x;
}

int main() {
    std::cout << "Loading Models...." << std::endl;
    // Pre-load the face detector and model
    cv::CascadeClassifier detector = getDetector();
    if (detector.empty()) {
        std::cerr << "Error: Error loading cascade file for face detection." << std::endl;
        return -1;
    }

    cv::dnn::Net opencv_model = cv::dnn::readNetFromONNX("./face_matcher_model.onnx");
    std::cout << "Models Loaded" << std::endl;
    std::cout << "--READY--" << std::endl;

    std::string line;
    while (std::getline(std::cin, line)) { // Read from stdin
        size_t firstCommaPos = line.find(',');
        if (firstCommaPos == std::string::npos) {
            std::cerr << "Error: Invalid input format: " << line << std::endl;
            continue;
        }

        std::string requestId = line.substr(0, firstCommaPos);
        std::string remaining = line.substr(firstCommaPos + 1);
        size_t secondCommaPos = remaining.find(',');
        if (secondCommaPos == std::string::npos) {
            std::cerr << "Error: Invalid input format: " << line << std::endl;
            continue;
        }

        std::string image1_path = remaining.substr(0, secondCommaPos);
        std::string image2_path = remaining.substr(secondCommaPos + 1);

        cv::Mat img1 = cv::imread(image1_path);
        cv::Mat img2 = cv::imread(image2_path);

        if (img1.empty() || img2.empty()) {
            std::cerr << "Error: Error reading images." << std::endl;
            continue;
        }

        // Perform face extraction and cosine distance calculation
        std::vector<std::tuple<cv::Mat, cv::Rect>> extracted_faces_1 = extractFaces(img1, detector);
        std::vector<std::tuple<cv::Mat, cv::Rect>> extracted_faces_2 = extractFaces(img2, detector);

        if (extracted_faces_1.empty() || extracted_faces_2.empty()) {
            std::cerr << "Error: No faces detected in one or both images." << std::endl;
            continue;
        }

        cv::Mat pred1 = getPrediction(std::get<0>(extracted_faces_1[0]), opencv_model).clone();
        cv::Mat pred2 = getPrediction(std::get<0>(extracted_faces_2[0]), opencv_model).clone();

        double dist_img1_img2 = findCosineDistance(pred1, pred2);

        std::cout << "Response: {cosineDistance:" << dist_img1_img2 << ", requestId:" << requestId << "}" << std::endl; // Output to stdout
    }

    return 0;
}