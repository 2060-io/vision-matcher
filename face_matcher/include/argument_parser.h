// argument_parser.h

#ifndef ARGUMENT_PARSER_H
#define ARGUMENT_PARSER_H

#include <map>
#include <string>

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
std::map<std::string, std::string> parseArguments(int argc, char* argv[]);

#endif // ARGUMENT_PARSER_H