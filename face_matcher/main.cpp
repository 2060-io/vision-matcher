#include "argument_parser.h"
#include "detector.h"
#include "face_extractor.h"
#include "prediction.h"
#include "utils.h"
#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>
#include <iostream>

/**
 * @brief Main function for face matching application.
 * 
 * This function loads face detection and matching models, parses command-line arguments,
 * and processes input requests from standard input to detect faces and determine if they match.
 * 
 * @param argc Number of command-line arguments.
 * @param argv Array of command-line argument strings.
 * @return int Returns 0 on success, and -1 on error in loading models.
 */
int main(int argc, char* argv[]) {
    // Default arguments for face detector and matcher models
    std::string face_detector_path = "haarcascade_frontalface_default.xml";
    std::string face_matcher_model_path = "./face_matcher_model.onnx";
    std::string distance_algorithm = "cosine";
    double distance_threshold = 0.4;
    bool allow_multi_faces = false;

    // Parse command-line arguments
    auto args = parseArguments(argc, argv);

    // Set arguments based on inputs
    if (args.count("-face_detector_path")) {
        face_detector_path = args["-face_detector_path"];
    }
    if (args.count("-face_matcher_model_path")) {
        face_matcher_model_path = args["-face_matcher_model_path"];
    }
    if (args.count("-distance_algorithm")) {
        distance_algorithm = args["-distance_algorithm"];
    }
    if (args.count("-distance_threshold")) {
        distance_threshold = std::stod(args["-distance_threshold"]);
    }
    if (args.count("-allow_multi_faces")) {
        std::string value = args["-allow_multi_faces"];
        // Convert string to boolean
        std::transform(value.begin(), value.end(), value.begin(), ::tolower);
        allow_multi_faces = (value == "true" || value == "1");
    }

    std::cout << "Loading Models...." << std::endl;

    // Load face detector
    cv::CascadeClassifier detector = getDetector(face_detector_path);
    if (detector.empty()) {
        std::cerr << "Error: Error loading cascade file for face detection." << std::endl;
        return -1;
    }

    // Load face matcher model
    cv::dnn::Net opencv_model = cv::dnn::readNetFromONNX(face_matcher_model_path);
    std::cout << "Models Loaded" << std::endl;
    std::cout << "--READY--" << std::endl;

    // Process input from standard input
    std::string line;
    while (std::getline(std::cin, line)) {
        // Split line into components based on first comma
        size_t firstCommaPos = line.find(',');
        if (firstCommaPos == std::string::npos) {
            std::cerr << "Error: Invalid input format: " << line << std::endl;
            continue;
        }

        // Extract requestId and remaining input
        std::string requestId = line.substr(0, firstCommaPos);
        std::string remaining = line.substr(firstCommaPos + 1);

        // Split remaining input into image paths
        size_t secondCommaPos = remaining.find(',');
        if (secondCommaPos == std::string::npos) {
            std::cerr << "Error: Invalid input format: " << line << std::endl;
            continue;
        }

        // Extract paths for image1 and image2
        std::string image1_path = remaining.substr(0, secondCommaPos);
        std::string image2_path = remaining.substr(secondCommaPos + 1);

        // Read images
        cv::Mat img1 = cv::imread(image1_path);
        cv::Mat img2 = cv::imread(image2_path);
        if (img1.empty() || img2.empty()) {
            std::cerr << "Error: Error reading images." << std::endl;
            continue;
        }

        // Extract faces using detector
        std::vector<std::tuple<cv::Mat, cv::Rect>> extracted_faces_1 = extractFaces(img1, detector, allow_multi_faces);
        std::vector<std::tuple<cv::Mat, cv::Rect>> extracted_faces_2 = extractFaces(img2, detector, allow_multi_faces);

        // Ensure faces are detected in both images
        if (extracted_faces_1.empty() || extracted_faces_2.empty()) {
            std::cerr << "Error: No faces detected in one or both images." << std::endl;
            continue;
        }

        // Get predictions from the model
        cv::Mat pred1 = getPrediction(std::get<0>(extracted_faces_1[0]), opencv_model).clone();
        cv::Mat pred2 = getPrediction(std::get<0>(extracted_faces_2[0]), opencv_model).clone();

        // Calculate the distance based on selected algorithm
        double distance;
        if (distance_algorithm == "cosine") {
            distance = findCosineDistance(pred1, pred2);
        } else if (distance_algorithm == "euclidean") {
            distance = findEuclideanDistance(pred1, pred2);
        } else {
            std::cerr << "Error: Unknown distance algorithm: " << distance_algorithm << std::endl;
            continue;
        }

        // Determine if the faces match based on the distance threshold
        bool match = (distance < distance_threshold);

        // Output the response
        std::cout << "Response: {distance:" << distance
                  << ", requestId:" << requestId
                  << ", match:" << (match ? "true" : "false") << "}" << std::endl;
    }

    return 0;
}