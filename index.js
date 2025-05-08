// const express = require('express');
// const cors = require('cors');
// const ytdl = require('ytdl-core');
// const app = express();
// const PORT = process.env.SERVER_PORT || 8000
// const { testSpeedHandler } = require( './api-handlers' )

// require('dotenv').config();
// const corsOptions = {
//     origin: '*',
//     optionsSuccessStatus: 200,
// }
// app.use(cors(corsOptions));
// app.use(express.json());


// app.post('/api/video-info', async (req, res) => {
//     try {
//       const { url } = req.body;

//       // Validate URL
//       if (!ytdl.validateURL(url)) {
//         return res.status(400).json({ error: 'Invalid YouTube URL' });
//       }

//       // Get video info
//       const info = await ytdl.getInfo(url);

//       // Format the response
//       const videoDetails = {
//         title: info.videoDetails.title,
//         thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
//         duration: formatDuration(parseInt(info.videoDetails.lengthSeconds)),
//         formats: []
//       };

//       // Get available formats
//       const formats = info.formats.filter(format => {
//         return format.hasVideo && format.hasAudio && format.container === 'mp4';
//       });

//       // Add video formats
//       const qualitySet = new Set(); // To avoid duplicate qualities
//       formats.forEach(format => {
//         if (format.qualityLabel && !qualitySet.has(format.qualityLabel)) {
//           qualitySet.add(format.qualityLabel);
//           videoDetails.formats.push({
//             quality: format.qualityLabel,
//             format: 'mp4',
//             size: formatSize(format.contentLength),
//             id: format.itag
//           });
//         }
//       });

//       // Sort by quality (highest first)
//       videoDetails.formats.sort((a, b) => {
//         const aRes = parseInt(a.quality.replace('p', ''));
//         const bRes = parseInt(b.quality.replace('p', ''));
//         return bRes - aRes;
//       });

//       // Add audio option
//       const audioFormat = info.formats.find(f => f.mimeType?.includes('audio/mp4') && !f.hasVideo);
//       if (audioFormat) {
//         videoDetails.formats.push({
//           quality: 'Audio',
//           format: 'mp3',
//           size: formatSize(audioFormat.contentLength),
//           id: 'audio'
//         });
//       }

//       return res.status(200).json(videoDetails);
//     } catch (error) {
//       console.error(error);
//       return res.status(500).json({ error: 'Failed to get video information' });
//     }
//   });

//   // API endpoint to handle downloads
//   app.get('/api/download', async (req, res) => {
//     try {
//       const { url, format } = req.query;

//       if (!ytdl.validateURL(url)) {
//         return res.status(400).send('Invalid YouTube URL');
//       }

//       const info = await ytdl.getInfo(url);

//       if (format === 'audio') {
//         // Set headers for audio download
//         res.header('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp3"`);
//         res.header('Content-Type', 'audio/mpeg');

//         // Download audio only
//         ytdl(url, { 
//           quality: 'highestaudio',
//           filter: 'audioonly' 
//         }).pipe(res);
//       } else {
//         // Set headers for video download
//         res.header('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp4"`);
//         res.header('Content-Type', 'video/mp4');

//         // Download video with specific format (itag)
//         ytdl(url, { 
//           quality: format,
//           filter: format => format.itag == parseInt(format)
//         }).pipe(res);
//       }
//     } catch (error) {
//       console.error(error);
//       res.status(500).send('Download failed');
//     }
//   });

//   // Helper functions
//   function formatDuration(seconds) {
//     const minutes = Math.floor(seconds / 60);
//     const remainingSeconds = seconds % 60;
//     return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
//   }

//   function formatSize(bytes) {
//     if (!bytes) return 'Unknown';
//     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(1024));
//     return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
//   }




// app.get("/", async ( req, res ) => { 

//     const speedTestData = await testSpeedHandler()
//     res.status( speedTestData.status )
//     res.send( speedTestData.data )    
// });

// app.listen( PORT, () => {

//     console.log( `Listening on port ${ PORT }` );
// });



const express = require('express');
const cors = require('cors');
const youtubeDl = require('youtube-dl-exec');
const app = express();
const PORT = process.env.SERVER_PORT || 8000;
const { testSpeedHandler } = require('./api-handlers');
const path = require('path');
const fs = require('fs');


const cookiesPath = path.resolve(__dirname, 'cookies.txt');
console.log(cookiesPath)
require('dotenv').config();
const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());

// Create temp directory for downloads if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Helper to clean filename
function sanitizeFilename(filename) {
  return filename.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
}

app.post('/api/video-info', async (req, res) => {
  try {
    const { url } = req.body;

    console.log("Received request for URL:", url);

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Get video info using youtube-dl
    const videoInfo = await youtubeDl(url, {
      // cookiesPath: cookiesPath,
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    console.log("Video info retrieved successfully");

    // Format the response
    const videoDetails = {
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      duration: formatDuration(videoInfo.duration),
      formats: []
    };

    // Process video formats
    const videoFormats = videoInfo.formats.filter(format =>
      format.ext === 'mp4' && format.vcodec !== 'none' && format.acodec !== 'none'
    );

    // Process unique resolutions
    const qualitySet = new Set();
    videoFormats.forEach(format => {
      const quality = format.height ? `${format.height}p` : 'Unknown';
      if (!qualitySet.has(quality) && format.height) {
        qualitySet.add(quality);
        videoDetails.formats.push({
          quality: quality,
          format: 'mp4',
          size: formatSize(format.filesize || format.filesize_approx),
          id: format.format_id
        });
      }
    });

    // Sort formats by quality (highest first)
    videoDetails.formats.sort((a, b) => {
      const aRes = parseInt(a.quality.replace('p', ''));
      const bRes = parseInt(b.quality.replace('p', ''));
      return bRes - aRes;
    });

    // Add audio option
    const audioFormat = videoInfo.formats.find(f =>
      f.ext === 'm4a' && f.vcodec === 'none'
    );

    if (audioFormat) {
      videoDetails.formats.push({
        quality: 'Audio',
        format: 'mp3',
        size: formatSize(audioFormat.filesize || audioFormat.filesize_approx),
        id: 'audio'
      });
    }

    return res.status(200).json(videoDetails);
  } catch (error) {
    console.error("Error processing video info request:", error);
    return res.status(500).json({
      error: 'Failed to get video information',
      message: error.message
    });
  }
});

app.get('/api/download', async (req, res) => {
  try {
    const { url, format } = req.query;

    if (!url) {
      return res.status(400).send('URL is required');
    }

    // Set appropriate headers to force download rather than opening in browser
    res.setHeader('Content-Disposition', 'attachment');

    // Get video info - This is needed to get the title
    const videoInfo = await youtubeDl(url, {
      // cookiesPath: cookiesPath,
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true
    });

    const fileName = sanitizeFilename(videoInfo.title || 'video');

    if (format === 'audio') {
      // Download as audio
      const outputFile = path.join(tempDir, `${fileName}.mp3`);

      // Set specific headers for audio download
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.mp3"`);
      res.setHeader('Content-Type', 'audio/mpeg');

      // Start the download process
      await youtubeDl(url, {
        // cookiesPath: cookiesPath,
        extractAudio: true,
        audioFormat: 'mp3',
        output: outputFile,
        noWarnings: true,
        noCallHome: true
      });

      // Stream the file to the client and delete after
      const fileStream = fs.createReadStream(outputFile);
      fileStream.pipe(res);

      fileStream.on('end', () => {
        // Delete the file after sending
        fs.unlink(outputFile, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      });
    } else {
      // Download specific video format
      const outputFile = path.join(tempDir, `${fileName}.mp4`);

      // Set specific headers for video download
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.mp4"`);
      res.setHeader('Content-Type', 'video/mp4');

      // Start the download process
      await youtubeDl(url, {
        // cookiesPath: cookiesPath,
        format: format,
        output: outputFile,
        noWarnings: true,
        noCallHome: true
      });

      // Stream the file to the client and delete after
      const fileStream = fs.createReadStream(outputFile);
      fileStream.pipe(res);

      fileStream.on('end', () => {
        // Delete the file after sending
        fs.unlink(outputFile, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      });
    }
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).send('Download failed: ' + error.message);
  }
});

// Helper functions
function formatDuration(seconds) {
  if (!seconds) return "Unknown";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function formatSize(bytes) {
  if (!bytes) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// Root endpoint for testing
app.get("/", async (req, res) => {
  res.status(200);
  res.send({ statu: 'ok' });
});

app.get("/speedtest", async (req, res) => {
  const speedTestData = await testSpeedHandler();
  res.status(speedTestData.status);
  res.send(speedTestData.data);
});

app.listen(PORT, () => {
  console.log(`YouTube Downloader API listening on port ${PORT}`);
});