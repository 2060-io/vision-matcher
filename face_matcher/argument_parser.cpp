// argument_parser.cpp

#include "argument_parser.h"

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