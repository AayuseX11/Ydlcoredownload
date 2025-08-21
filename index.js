const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'YouTube Downloader API',
    usage: {
      audio: '/videoId/type=audio',
      video: '/videoId/type=video'
    },
    example: '/dQw4w9WgXcQ/type=audio'
  });
});

// Main download route
app.get('/:videoId/type=:type', async (req, res) => {
  try {
    const { videoId, type } = req.params;
    
    // Validate video ID
    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID' });
    }

    // Validate type
    if (!['audio', 'video'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "audio" or "video"' });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Get video info
    const info = await ytdl.getInfo(videoUrl);
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    
    // Set response headers
    const extension = type === 'audio' ? 'mp3' : 'mp4';
    res.setHeader('Content-Disposition', `attachment; filename="${title}.${extension}"`);
    res.setHeader('Content-Type', type === 'audio' ? 'audio/mpeg' : 'video/mp4');

    // Configure ytdl options based on type
    let options = {};
    
    if (type === 'audio') {
      options = {
        filter: 'audioonly',
        quality: 'highestaudio',
        format: 'mp3'
      };
    } else {
      options = {
        filter: format => format.container === 'mp4' && format.hasVideo && format.hasAudio,
        quality: 'highest'
      };
    }

    // Stream the video/audio
    const stream = ytdl(videoUrl, options);
    
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming content' });
      }
    });

    stream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to download video',
        message: error.message 
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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
});
