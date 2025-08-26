#include "argument_parser.h"
#include "detector.h"
#include "face_extractor.h"
#include "prediction.h"
#include "utils.h"

#include "ipc/unix_socket_transport.h"
#include "ipc/protocol_handler.h"
#include "ipc/nlohmann/json.hpp"

#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>
#include <iostream>
#include <algorithm>

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
    // Defaults
    std::string face_detector_path = "haarcascade_frontalface_default.xml";
    std::string face_matcher_model_path = "./face_matcher_model.onnx";
    std::string distance_algorithm = "cosine";
    double      distance_threshold = 0.4;
    bool        allow_multi_faces = false;
    std::string socket_path = "/tmp/face_matcher.sock";

    // Parse CLI
    auto args = parseArguments(argc, argv);
    if (args.count("-face_detector_path"))      face_detector_path      = args["-face_detector_path"];
    if (args.count("-face_matcher_model_path")) face_matcher_model_path = args["-face_matcher_model_path"];
    if (args.count("-distance_algorithm"))      distance_algorithm      = args["-distance_algorithm"];
    if (args.count("-distance_threshold"))      distance_threshold      = std::stod(args["-distance_threshold"]);
    if (args.count("-allow_multi_faces")) {
        std::string value = args["-allow_multi_faces"];
        // Convert string to boolean
        std::transform(value.begin(), value.end(), value.begin(), ::tolower);
        allow_multi_faces = (value == "true" || value == "1");
    }
    if (args.count("-socket_path"))
        socket_path = args["-socket_path"];

    std::cout << "Loading Models...." << std::endl;

    // Load detector
    cv::CascadeClassifier detector = getDetector(face_detector_path);
    if (detector.empty()) {
        std::cerr << "Error: Error loading cascade file for face detection." << std::endl;
        return -1;
    }

    // Load matcher model
    cv::dnn::Net opencv_model = cv::dnn::readNetFromONNX(face_matcher_model_path);
    std::cout << "Models Loaded" << std::endl;

    // Prepare callbacks
    auto img_cb = [](const cv::Mat&) -> std::pair<cv::Mat, std::string> {
        return {}; // not used
    };

    auto data_cb = [&](const std::string& json_str) -> std::string {
        using nlohmann::json;
        try {
            json j = json::parse(json_str);
            // Expected: { requestId, image1_path, image2_path }
            const auto requestId = j.value("requestId", 0);
            const auto image1_path = j.value("image1_path", std::string());
            const auto image2_path = j.value("image2_path", std::string());

            if (image1_path.empty() || image2_path.empty()) {
                json err = { {"match", false}, {"distance", 1.0}, {"requestId", requestId}, {"error", "Missing image paths"} };
                return err.dump();
            }

            cv::Mat img1 = cv::imread(image1_path);
            cv::Mat img2 = cv::imread(image2_path);
            if (img1.empty() || img2.empty()) {
                json err = { {"match", false}, {"distance", 1.0}, {"requestId", requestId}, {"error", "Error reading images."} };
                return err.dump();
            }

            auto faces1 = extractFaces(img1, detector, allow_multi_faces);
            auto faces2 = extractFaces(img2, detector, allow_multi_faces);
            if (faces1.empty() || faces2.empty()) {
                json err = { {"match", false}, {"distance", 1.0}, {"requestId", requestId}, {"error", "No faces detected in one or both images."} };
                return err.dump();
            }

            cv::Mat pred1 = getPrediction(std::get<0>(faces1[0]), opencv_model).clone();
            cv::Mat pred2 = getPrediction(std::get<0>(faces2[0]), opencv_model).clone();

            double distance = 1.0;
            if (distance_algorithm == "cosine") {
                distance = findCosineDistance(pred1, pred2);
            } else if (distance_algorithm == "euclidean") {
                distance = findEuclideanDistance(pred1, pred2);
            } else {
                nlohmann::json err = { {"match", false}, {"distance", 1.0}, {"requestId", requestId},
                                       {"error", std::string("Unknown distance algorithm: ") + distance_algorithm} };
                return err.dump();
            }

            bool match = (distance < distance_threshold);
            nlohmann::json out = { {"match", match}, {"distance", distance}, {"requestId", requestId} };
            return out.dump();
        } catch (const std::exception& e) {
            nlohmann::json err = { {"match", false}, {"distance", 1.0}, {"requestId", 0}, {"error", e.what()} };
            return err.dump();
        }
    };

    CombinedProcessingCallback comb_cb = nullptr; // not used now

    // Open Unix socket server
    UnixSocketTransport listener(socket_path);
    if (!listener.open_server()) {
        std::cerr << "Failed to open Unix socket at " << socket_path << "\n";
        return -1;
    }
    std::cout << "Server listening at socket: " << socket_path << std::endl;

    while (true) {
        auto client = listener.accept_client();
        if (!client) {
            std::cerr << "Accept failed, continuing..." << std::endl;
            continue;
        }
        std::cout << "Client connected." << std::endl;

        ProtocolHandler handler(client.get(), img_cb, data_cb, comb_cb);

        // Notify readiness to the client
        handler.send_json(std::string("{\"ready\":true}"));

        std::string why_exit;
        while (handler.handle_one_message(why_exit)) {}
        std::cerr << "Session ended: " << why_exit << std::endl;
    }

    return 0;
}