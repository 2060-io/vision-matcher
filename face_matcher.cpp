#include <opencv2/opencv.hpp>
#include <opencv2/objdetect.hpp>
#include <iostream>
#include <tuple>
#include <vector>
#include <cmath>
#include <map>

/**
 * @brief Parses command-line arguments into a map of key-value pairs.
 *
 * Each odd indexed argument is considered a key and the subsequent
 * even indexed argument is its value.
 *
 * @param argc The count of command-line arguments including the program name.
 * @param argv An array of char pointers where each element is a command-line argument.
 * @return A std::map where each key-value pair corresponds to command-line arguments.
 */
std::map<std::string, std::string> parseArguments(int argc, char* argv[]) {
    std::map<std::string, std::string> args; // Map to store parsed key-value pairs

    // Start from the first argument after the program name, i.e., argv[1]
    // Increment by 2 each time to process pairs of arguments (key and value)
    for (int i = 1; i < argc; i += 2) {
        // Ensure that there is a subsequent argument available for a value
        if (i + 1 < argc) {
            // argv[i] is the key, argv[i + 1] is the value
            args[argv[i]] = argv[i + 1];
        }
    }
    return args; // Return the populated map of arguments
}

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
cv::CascadeClassifier getDetector(const std::string& face_detector_path) {
    // Initialize a CascadeClassifier object with the provided file path.
    // This attempts to load the classifier data from the file.
    cv::CascadeClassifier detector(face_detector_path);

    // Return the initialized CascadeClassifier object.
    return detector;
}

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
    const cv::Size& target_size = cv::Size(224, 224)) {

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


/**
 * @brief Prints information about extracted faces, including their sizes, bounding boxes, and first 10 pixel values.
 *
 * This function iterates over a vector of tuples where each tuple consists of a detected face in the form of a 
 * `cv::Mat` object and its corresponding bounding rectangle (`cv::Rect`). It prints the detected face's dimensions, 
 * the coordinates and dimensions of its bounding box, and the first 10 pixel values of the face.
 *
 * @param extracted_faces A vector of tuples, where each tuple contains a face image (`cv::Mat`) and its bounding box (`cv::Rect`).
 * @param name The name associated with the extracted faces to be printed in the output.
 */
void printExtractedFaces(const std::vector<std::tuple<cv::Mat, cv::Rect>>& extracted_faces, std::string name) {
    // Print the title with the name associated with the faces.
    std::cout << "Extracted faces for " << name << std::endl;

    // Iterate over each tuple in the vector of extracted faces.
    for (const auto& extracted_face_tuple : extracted_faces) {
        // Extract the face image (cv::Mat) and its bounding box (cv::Rect) from the tuple.
        const cv::Mat& detected_face = std::get<0>(extracted_face_tuple);
        const cv::Rect& face_rect = std::get<1>(extracted_face_tuple);

        // Print the size of the detected face image.
        std::cout << "Detected face size: ["
                  << detected_face.rows << " x "
                  << detected_face.cols << "]" << std::endl;

        // Print the details of the face bounding box.
        std::cout << "Face bounding box: ["
                  << face_rect.x << ", "
                  << face_rect.y << ", "
                  << face_rect.width << ", "
                  << face_rect.height << "]" << std::endl;

        // Print the first 10 pixel values of the detected face image.
        std::cout << "First 10 pixel values:" << std::endl;
        int count = 0; // Counter to track the number of printed pixels.

        // Iterate over each pixel in the face image.
        for (int r = 0; r < detected_face.rows; ++r) {
            for (int c = 0; c < detected_face.cols; ++c) {
                // Print only the first 10 pixel values.
                if (count < 10) {
                    // Get the pixel value (assuming 3 channels: e.g., BGR).
                    cv::Vec3f pixel = detected_face.at<cv::Vec3f>(r, c);
                    std::cout << "("
                              << pixel[0] << ", "
                              << pixel[1] << ", "
                              << pixel[2] << ") ";
                    ++count; // Increment the pixel count.
                }
            }
            // Stop printing when 10 pixels have been printed.
            if (count >= 10) break;
        }
        std::cout << std::endl; // New line after printing the pixel values.
    }
}

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

#include <iostream>
#include <opencv2/opencv.hpp>

/**
 * @brief Prints the top 5 prediction scores for a given image.
 * 
 * This function takes a matrix of prediction scores and outputs
 * the scores for the first 5 classes to the standard output, preceded
 * by the image name. The prediction matrix is reshaped to a single
 * row before accessing the scores.
 *
 * @param prediction A cv::Mat object representing the prediction scores.
 *                   It is expected that the matrix can be reshaped to a 
 *                   single row with at least 5 elements.
 * @param imageName A string representing the name of the image for which 
 *                  the predictions are made. This name is used in the output.
 */
void printPrediction(const cv::Mat& prediction, const std::string& imageName) {
    // Print the image name followed by the colon.
    std::cout << "Prediction for image " << imageName << ":" << std::endl;

    // Reshape the prediction matrix to have a single row, 
    // keeping the number of columns unchanged.
    cv::Mat reshapedPred = prediction.reshape(0, 1);

    // Loop over the first 5 prediction scores
    for (int i = 0; i < 5; i++) {
        // Print each score, preceded by a space.
        std::cout << " " << reshapedPred.at<float>(0, i);
    }

    // Move to a new line after printing all scores.
    std::cout << std::endl;
}

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
        std::vector<std::tuple<cv::Mat, cv::Rect>> extracted_faces_1 = extractFaces(img1, detector);
        std::vector<std::tuple<cv::Mat, cv::Rect>> extracted_faces_2 = extractFaces(img2, detector);

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