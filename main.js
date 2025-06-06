const uWS = require('uWebSockets.js');

const port = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

let keepAliveTimer;
let clientCount = 0;

const app = uWS.App({
  compression: uWS.DISABLED, // Disable compression for performance
}).ws('/*', {
  message: (ws, message, opCode) => {
    const msg = Buffer.from(message).toString();
    
    if (msg === 'pong') {
      if (isDev) console.log('keepAlive');
      return;
    }
    
    // Broadcast to all clients except sender
    ws.publish('broadcast', message);
  },
  
  open: (ws) => {
    clientCount++;
    ws.subscribe('broadcast');
    
    if (isDev) {
      console.log('Connection opened. Client count:', clientCount);
    }
    
    // Start keepalive when first client connects
    if (clientCount === 1) {
      if (isDev) console.log('First connection: starting keepalive');
      keepAliveTimer = setInterval(() => {
        app.publish('broadcast', 'ping', uWS.OPCODE_TEXT);
      }, 5000);
    }
  },
  
  close: (ws) => {
    clientCount--;
    
    if (isDev) {
      console.log('Connection closed. Client count:', clientCount);
    }
    
    // Stop keepalive when last client disconnects
    if (clientCount === 0) {
      if (isDev) console.log('Last client disconnected, stopping keepalive');
      clearInterval(keepAliveTimer);
    }
  }
}).get('/*', (res, req) => {
  // Serve static files or simple response
  const url = req.getUrl();
  
  if (url === '/') {
    res.end('Hello World!');
  } else {
    // Simple static file serving (you can enhance this as needed)
    res.writeStatus('404 Not Found').end('Not Found');
  }
}).listen(port, (token) => {
  if (token) {
    console.log(`Server started on port ${port} in stage ${process.env.NODE_ENV || 'development'}`);
  } else {
    console.log(`Failed to listen to port ${port}`);
  }
});
