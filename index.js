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
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Configuration
const TEST_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const TEST_FILE_PATH = path.join(__dirname, 'testfile.bin');
const UPLOAD_CHUNK_SIZE = 1024 * 1024; // 1MB chunks

// Generate test file if it doesn't exist
if (!fs.existsSync(TEST_FILE_PATH)) {
  console.log('Generating test file...');
  const buffer = Buffer.alloc(TEST_FILE_SIZE);
  fs.writeFileSync(TEST_FILE_PATH, buffer);
}

// Test results storage
const testResults = {};

// API Endpoints

// 1. Get server status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ready',
    endpoints: {
      ping: '/api/ping',
      download: '/api/download',
      upload: '/api/upload',
      test: '/api/test'
    },
    fileSize: TEST_FILE_SIZE
  });
});

// 2. Ping test (ICMP-based)
app.get('/api/ping', (req, res) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const pingMs = (diff[0] * 1000) + (diff[1] / 1000000);
    console.log(`Ping: ${pingMs.toFixed(2)}ms`);
  });
  res.send('pong');
});

// 3. Download test
app.get('/api/download', (req, res) => {
  const range = req.headers.range;
  if (range) {
    // Handle partial content for chunked downloads
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : TEST_FILE_SIZE - 1;
    const chunksize = (end - start) + 1;
    
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${TEST_FILE_SIZE}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'application/octet-stream'
    });
    
    fs.createReadStream(TEST_FILE_PATH, { start, end }).pipe(res);
  } else {
    res.sendFile(TEST_FILE_PATH);
  }
});

// 4. Upload test
app.post('/api/upload', (req, res) => {
  const start = Date.now();
  const contentLength = parseInt(req.headers['content-length'], 10);
  
  req.on('data', () => {}); // We just need to measure timing
  req.on('end', () => {
    const duration = (Date.now() - start) / 1000;
    const speedMbps = ((contentLength * 8) / duration) / 1000000;
    
    res.json({
      status: 'complete',
      bytesReceived: contentLength,
      duration: duration.toFixed(2),
      speedMbps: speedMbps.toFixed(2)
    });
  });
});

// 5. Complete test endpoint
app.post('/api/test', async (req, res) => {
  const testId = `test_${Date.now()}`;
  testResults[testId] = { status: 'started', timestamp: new Date().toISOString() };
  
  try {
    // Measure ping (ICMP)
    const ping = await measureICMPPing('localhost');
    testResults[testId].ping = ping;
    
    // Measure download speed (average of 3 runs)
    const downloadSpeeds = [];
    for (let i = 0; i < 3; i++) {
      const speed = await measureDownloadSpeed(`http://localhost:${PORT}/api/download`);
      downloadSpeeds.push(speed);
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause between tests
    }
    testResults[testId].download = average(downloadSpeeds);
    
    // Measure upload speed
    const uploadSpeed = await measureUploadSpeed(`http://localhost:${PORT}/api/upload`);
    testResults[testId].upload = uploadSpeed;
    
    testResults[testId].status = 'completed';
    testResults[testId].completedAt = new Date().toISOString();
    
    res.json(testResults[testId]);
  } catch (error) {
    testResults[testId].status = 'failed';
    testResults[testId].error = error.message;
    res.status(500).json(testResults[testId]);
  }
});

// Helper Functions

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function measureICMPPing(host) {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' 
      ? `ping -n 4 ${host}`
      : `ping -c 4 ${host}`;
    
    exec(cmd, (error, stdout) => {
      if (error) return resolve(-1);
      
      // Parse ping output
      const match = stdout.match(/= (\d+\.?\d*)\/(\d+\.?\d*)\/(\d+\.?\d*)\/(\d+\.?\d*) ms/);
      resolve(match ? parseFloat(match[2]) : -1); // Return average ping
    });
  });
}

async function measureDownloadSpeed(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = require(url.startsWith('https') ? 'https' : 'http').get(url, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => bytes += chunk.length);
      res.on('end', () => {
        const duration = (Date.now() - start) / 1000;
        resolve(((bytes * 8) / duration) / 1000000);
      });
    });
    req.on('error', () => resolve(0));
  });
}

async function measureUploadSpeed(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const payload = Buffer.alloc(UPLOAD_CHUNK_SIZE);
    const req = require(url.startsWith('https') ? 'https' : 'http').request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const duration = (Date.now() - start) / 1000;
        try {
          const result = JSON.parse(data);
          resolve(result.speedMbps);
        } catch {
          resolve(0);
        }
      });
    });
    
    req.on('error', () => resolve(0));
    req.write(payload);
    req.end();
  });
}

app.listen(PORT, () => {
  console.log(`Speed Test API running on port ${PORT}`);
  console.log(`Test file: ${TEST_FILE_PATH} (${(TEST_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB)`);
});

// const express = require('express');
// const cors = require('cors');
// const youtubeDl = require('youtube-dl-exec');
// const app = express();
// const PORT = process.env.SERVER_PORT || 8000;
// const { testSpeedHandler } = require('./api-handlers');
// const path = require('path');
// const fs = require('fs');


// const cookiesPath = path.resolve(__dirname, 'cookies.txt');
// console.log(cookiesPath)
// require('dotenv').config();
// const corsOptions = {
//   origin: '*',
//   optionsSuccessStatus: 200,
// }
// app.use(cors(corsOptions));
// app.use(express.json());

// // Create temp directory for downloads if it doesn't exist
// const tempDir = path.join(__dirname, 'temp');
// if (!fs.existsSync(tempDir)) {
//   fs.mkdirSync(tempDir);
// }

// // Helper to clean filename
// function sanitizeFilename(filename) {
//   return filename.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
// }

// app.post('/api/video-info', async (req, res) => {
//   try {
//     const { url } = req.body;

//     console.log("Received request for URL:", url);

//     if (!url) {
//       return res.status(400).json({ error: 'URL is required' });
//     }

//     // Get video info using youtube-dl
//     const videoInfo = await youtubeDl(url, {
//       cookies: cookiesPath,
//       dumpSingleJson: true,
//       noWarnings: true,
//       noCallHome: true,
//       preferFreeFormats: true,
//       youtubeSkipDashManifest: true,
//     });

//     console.log("Video info retrieved successfully");

//     // Format the response
//     const videoDetails = {
//       title: videoInfo.title,
//       thumbnail: videoInfo.thumbnail,
//       duration: formatDuration(videoInfo.duration),
//       formats: []
//     };

//     // Process video formats
//     const videoFormats = videoInfo.formats.filter(format =>
//       format.ext === 'mp4' && format.vcodec !== 'none' && format.acodec !== 'none'
//     );

//     // Process unique resolutions
//     const qualitySet = new Set();
//     videoFormats.forEach(format => {
//       const quality = format.height ? `${format.height}p` : 'Unknown';
//       if (!qualitySet.has(quality) && format.height) {
//         qualitySet.add(quality);
//         videoDetails.formats.push({
//           quality: quality,
//           format: 'mp4',
//           size: formatSize(format.filesize || format.filesize_approx),
//           id: format.format_id
//         });
//       }
//     });

//     // Sort formats by quality (highest first)
//     videoDetails.formats.sort((a, b) => {
//       const aRes = parseInt(a.quality.replace('p', ''));
//       const bRes = parseInt(b.quality.replace('p', ''));
//       return bRes - aRes;
//     });

//     // Add audio option
//     const audioFormat = videoInfo.formats.find(f =>
//       f.ext === 'm4a' && f.vcodec === 'none'
//     );

//     if (audioFormat) {
//       videoDetails.formats.push({
//         quality: 'Audio',
//         format: 'mp3',
//         size: formatSize(audioFormat.filesize || audioFormat.filesize_approx),
//         id: 'audio'
//       });
//     }

//     return res.status(200).json(videoDetails);
//   } catch (error) {
//     console.error("Error processing video info request:", error);
//     return res.status(500).json({
//       error: 'Failed to get video information',
//       message: error.message
//     });
//   }
// });

// app.get('/api/download', async (req, res) => {
//   try {
//     const { url, format } = req.query;

//     if (!url) {
//       return res.status(400).send('URL is required');
//     }

//     // Set appropriate headers to force download rather than opening in browser
//     res.setHeader('Content-Disposition', 'attachment');

//     // Get video info - This is needed to get the title
//     const videoInfo = await youtubeDl(url, {
//       cookies: cookiesPath,
//       dumpSingleJson: true,
//       noWarnings: true,
//       noCallHome: true,
//       preferFreeFormats: true,
//       youtubeSkipDashManifest: true
//     });

//     const fileName = sanitizeFilename(videoInfo.title || 'video');

//     if (format === 'audio') {
//       // Download as audio
//       const outputFile = path.join(tempDir, `${fileName}.mp3`);

//       // Set specific headers for audio download
//       res.setHeader('Content-Disposition', `attachment; filename="${fileName}.mp3"`);
//       res.setHeader('Content-Type', 'audio/mpeg');

//       // Start the download process
//       await youtubeDl(url, {
//         cookies: cookiesPath,
//         extractAudio: true,
//         audioFormat: 'mp3',
//         output: outputFile,
//         noWarnings: true,
//         noCallHome: true
//       });

//       // Stream the file to the client and delete after
//       const fileStream = fs.createReadStream(outputFile);
//       fileStream.pipe(res);

//       fileStream.on('end', () => {
//         // Delete the file after sending
//         fs.unlink(outputFile, (err) => {
//           if (err) console.error("Error deleting file:", err);
//         });
//       });
//     } else {
//       // Download specific video format
//       const outputFile = path.join(tempDir, `${fileName}.mp4`);

//       // Set specific headers for video download
//       res.setHeader('Content-Disposition', `attachment; filename="${fileName}.mp4"`);
//       res.setHeader('Content-Type', 'video/mp4');

//       // Start the download process
//       await youtubeDl(url, {
//         cookies: cookiesPath,
//         format: format,
//         output: outputFile,
//         noWarnings: true,
//         noCallHome: true,
//       });

//       // Stream the file to the client and delete after
//       const fileStream = fs.createReadStream(outputFile);
//       fileStream.pipe(res);

//       fileStream.on('end', () => {
//         // Delete the file after sending
//         fs.unlink(outputFile, (err) => {
//           if (err) console.error("Error deleting file:", err);
//         });
//       });
//     }
//   } catch (error) {
//     console.error("Download error:", error);
//     res.status(500).send('Download failed: ' + error.message);
//   }
// });

// // Helper functions
// function formatDuration(seconds) {
//   if (!seconds) return "Unknown";
//   const minutes = Math.floor(seconds / 60);
//   const remainingSeconds = seconds % 60;
//   return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
// }

// function formatSize(bytes) {
//   if (!bytes) return 'Unknown';
//   const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//   const i = Math.floor(Math.log(bytes) / Math.log(1024));
//   return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
// }

// // Root endpoint for testing
// app.get("/", async (req, res) => {
//   res.status(200);
//   res.send({ statu: 'ok' });
// });

// app.get("/speedtest", async (req, res) => {
//   const speedTestData = await testSpeedHandler();
//   res.status(speedTestData.status);
//   res.send(speedTestData.data);
// });

// app.listen(PORT, () => {
//   console.log(`YouTube Downloader API listening on port ${PORT}`);
// });