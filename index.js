const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Set environment variable to disable ytdl update check
process.env.YTDL_NO_UPDATE = '1';

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'YouTube Downloader API',
    usage: {
      audio: '/videoId/type=audio',
      video: '/videoId/type=video'
    },
    example: '/dQw4w9WgXcQ/type=audio',
    status: 'Using yt-dlp for better reliability'
  });
});

// Function to validate YouTube video ID
function isValidYouTubeId(id) {
  const regex = /^[a-zA-Z0-9_-]{11}$/;
  return regex.test(id);
}

// Function to sanitize filename
function sanitizeFilename(filename) {
  return filename.replace(/[^\w\s.-]/gi, '').replace(/\s+/g, '_');
}

// Main download route
app.get('/:videoId/type=:type', async (req, res) => {
  try {
    const { videoId, type } = req.params;
    
    // Validate video ID
    if (!isValidYouTubeId(videoId)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID' });
    }

    // Validate type
    if (!['audio', 'video'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "audio" or "video"' });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Configure yt-dlp command based on type
    let command;
    let outputTemplate = path.join(tempDir, `${videoId}.%(ext)s`);
    
    if (type === 'audio') {
      command = `yt-dlp -f "bestaudio" --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" "${videoUrl}"`;
    } else {
      command = `yt-dlp -f "best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${videoUrl}"`;
    }

    console.log('Executing command:', command);

    // Execute yt-dlp command
    exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp error:', error);
        console.error('stderr:', stderr);
        
        // Clean up any partial files
        const files = fs.readdirSync(tempDir).filter(file => file.startsWith(videoId));
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {
            console.error('Error deleting file:', e);
          }
        });
        
        return res.status(500).json({ 
          error: 'Failed to download video',
          message: 'Video may be private, age-restricted, or unavailable'
        });
      }

      try {
        // Find the downloaded file
        const files = fs.readdirSync(tempDir).filter(file => file.startsWith(videoId));
        
        if (files.length === 0) {
          return res.status(500).json({ error: 'Downloaded file not found' });
        }

        const downloadedFile = files[0];
        const filePath = path.join(tempDir, downloadedFile);
        
        // Get file stats
        const stats = fs.statSync(filePath);
        const extension = path.extname(downloadedFile);
        const baseName = path.basename(downloadedFile, extension);
        
        // Set response headers
        const contentType = type === 'audio' ? 'audio/mpeg' : 'video/mp4';
        const fileName = `${sanitizeFilename(baseName)}${extension}`;
        
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        
        fileStream.on('error', (streamError) => {
          console.error('Stream error:', streamError);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error streaming file' });
          }
        });

        fileStream.on('end', () => {
          // Clean up the file after streaming
          try {
            fs.unlinkSync(filePath);
          } catch (cleanupError) {
            console.error('Error cleaning up file:', cleanupError);
          }
        });

        fileStream.pipe(res);

      } catch (fileError) {
        console.error('File handling error:', fileError);
        res.status(500).json({ error: 'Error processing downloaded file' });
      }
    });

  } catch (error) {
    console.error('Request error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    engine: 'yt-dlp'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} for usage instructions`);
  console.log('Using yt-dlp for downloads');
});
