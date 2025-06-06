const uWS = require('uWebSockets.js');
const fs = require('fs');
const path = require('path');

const serverPort = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

let keepAliveId;
const connectedClients = new Set();

// Broadcast to all connected clients except the sender (unless includeSelf is true)
const broadcast = (sender, message, includeSelf = false) => {
  for (const client of connectedClients) {
    if (includeSelf || client !== sender) {
      try {
        client.send(message);
      } catch (error) {
        // Remove client if sending fails (connection closed)
        connectedClients.delete(client);
      }
    }
  }
};

// Ping all clients every 50 seconds to keep the connection alive
const keepServerAlive = () => {
  keepAliveId = setInterval(() => {
    for (const client of connectedClients) {
      try {
        client.send('ping');
      } catch (error) {
        // Remove client if sending fails (connection closed)
        connectedClients.delete(client);
      }
    }
  }, 5000);
};

// Helper function to get MIME type based on file extension
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// Create uWebSockets.js app
const app = uWS.App({
  // Optional SSL configuration
  // key_file_name: 'misc/key.pem',
  // cert_file_name: 'misc/cert.pem',
}).ws('/*', {
  // WebSocket configuration
  compression: uWS.SHARED_COMPRESSOR,
  maxCompressedSize: 64 * 1024,
  maxBackpressure: 64 * 1024,
  maxPayloadLength: 16 * 1024,
  idleTimeout: 60,
  
  // WebSocket event handlers
  open: (ws) => {
    connectedClients.add(ws);
    
    // Optionally log connection info (suppress in production for performance)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Connection Opened. Client count:', connectedClients.size);
    }

    if (connectedClients.size === 1) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('First connection: starting keepalive');
      }
      keepServerAlive();
    }
  },
  
  message: (ws, message, opCode) => {
    const messageStr = Buffer.from(message).toString();
    
    if (messageStr === 'pong') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('keepAlive');
      }
      return;
    }
    
    broadcast(ws, messageStr);
  },
  
  close: (ws, code, message) => {
    connectedClients.delete(ws);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Closing connection. Client count:', connectedClients.size);
    }
    
    if (connectedClients.size === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Last client disconnected, stopping keepalive');
      }
      clearInterval(keepAliveId);
    }
  }
}).get('/', (res, req) => {
  // Handle root route
  res.end('Hello World!');
}).get('/*', (res, req) => {
  // Static file serving
  const url = req.getUrl();
  const filePath = path.join(publicDir, url === '/' ? 'index.html' : url);
  
  // Security check - prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    res.writeStatus('403 Forbidden').end('Forbidden');
    return;
  }
  
  // Check if file exists and serve it
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeStatus('404 Not Found').end('File not found');
      return;
    }
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeStatus('500 Internal Server Error').end('Internal Server Error');
        return;
      }
      
      const mimeType = getMimeType(filePath);
      res.writeHeader('Content-Type', mimeType).end(data);
    });
  });
}).listen(serverPort, (token) => {
  if (token) {
    console.log(`Server started on port ${serverPort} in stage ${process.env.NODE_ENV || 'development'}`);
  } else {
    console.log(`Failed to listen to port ${serverPort}`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  if (keepAliveId) {
    clearInterval(keepAliveId);
  }
  uWS.us_listen_socket_close(app);
  process.exit(0);
});