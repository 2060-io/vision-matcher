# Use the official Node.js 18 image as the base
FROM node:18

# Install necessary build tools and OpenCV
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libopencv-dev

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Run your build script to compile the C++ application
RUN cd face_matcher && ls -l && chmod +x gpp_build_face_matcher.sh && ./gpp_build_face_matcher.sh

# Expose the port your application listens on
EXPOSE 5123

# Start the Node.js application
CMD ["node", "server.js"]