# Use official Node.js runtime as base image
FROM node:18-slim

# Install system dependencies including Python and yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && pip3 install yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --only=production

# Copy application code
COPY . .

# Create temp directory for downloads
RUN mkdir -p temp

# Expose port
EXPOSE 10000

# Set environment variables
ENV YTDL_NO_UPDATE=1
ENV PORT=10000

# Start the application
CMD ["npm", "start"]
