const axios = require('axios');
const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class SpeedTestClient {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
  }

  async runCompleteTest() {
    try {
      console.log('Starting comprehensive speed test...');
      
      // 1. Verify server status
      const status = await axios.get(`${this.serverUrl}/api/status`);
      console.log('Server status:', status.data.status);
      
      // 2. Measure ping (ICMP fallback to HTTP)
      let ping;
      try {
        ping = await this.measurePing();
        console.log(`Ping: ${ping.toFixed(1)}ms`);
      } catch (e) {
        console.log('ICMP ping failed, using HTTP fallback');
        ping = await this.measureHTTPPing();
        console.log(`HTTP Ping: ${ping.toFixed(1)}ms`);
      }
      
      // 3. Measure download speed (average of 3 runs)
      const downloadResults = [];
      for (let i = 0; i < 3; i++) {
        const speed = await this.measureDownload();
        downloadResults.push(speed);
        console.log(`Download test ${i + 1}: ${speed.toFixed(2)} Mbps`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const avgDownload = downloadResults.reduce((a, b) => a + b, 0) / downloadResults.length;
      
      // 4. Measure upload speed
      const uploadSpeed = await this.measureUpload();
      console.log(`Upload speed: ${uploadSpeed.toFixed(2)} Mbps`);
      
      return {
        ping: ping.toFixed(1),
        download: avgDownload.toFixed(2),
        upload: uploadSpeed.toFixed(2),
        unit: {
          ping: 'ms',
          download: 'Mbps',
          upload: 'Mbps'
        },
        status: 'completed'
      };
    } catch (error) {
      console.error('Test failed:', error.message);
      return {
        status: 'failed',
        error: error.message
      };
    }
  }

  async measurePing() {
    return new Promise((resolve, reject) => {
      const cmd = process.platform === 'win32' 
        ? `ping -n 4 ${new URL(this.serverUrl).hostname}`
        : `ping -c 4 ${new URL(this.serverUrl).hostname}`;
      
      require('child_process').exec(cmd, (error, stdout) => {
        if (error) return reject(error);
        
        const match = stdout.match(/= (\d+\.?\d*)\/(\d+\.?\d*)\/(\d+\.?\d*)\/(\d+\.?\d*) ms/);
        if (match) {
          resolve(parseFloat(match[2])); // Return average ping
        } else {
          reject(new Error('Could not parse ping output'));
        }
      });
    });
  }

  async measureHTTPPing() {
    const start = performance.now();
    await axios.get(`${this.serverUrl}/api/ping`);
    return performance.now() - start;
  }

  async measureDownload() {
    return new Promise((resolve) => {
      const start = performance.now();
      const url = `${this.serverUrl}/api/download`;
      const req = (url.startsWith('https') ? https : http).get(url, (res) => {
        let bytes = 0;
        res.on('data', (chunk) => bytes += chunk.length);
        res.on('end', () => {
          const duration = (performance.now() - start) / 1000;
          resolve(((bytes * 8) / duration) / 1000000);
        });
      });
      req.on('error', () => resolve(0));
    });
  }

  async measureUpload() {
    return new Promise((resolve) => {
      const start = performance.now();
      const payload = Buffer.alloc(5 * 1024 * 1024); // 5MB payload
      const req = (this.serverUrl.startsWith('https') ? https : http).request(
        `${this.serverUrl}/api/upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': payload.length
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolve(result.speedMbps);
            } catch {
              resolve(0);
            }
          });
        }
      );
      
      req.on('error', () => resolve(0));
      req.write(payload);
      req.end();
    });
  }
}

// Run test
(async () => {
  const client = new SpeedTestClient();
  const results = await client.runCompleteTest();
  console.log('\nFinal Results:');
  console.table(results);
})();