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
    
    if (isDev) {
      console.log('Received message:', msg);
    }
    
    // Handle client ping requests - respond immediately with pong
    if (msg === 'ping') {
      if (isDev) console.log('Client ping received, sending pong response');
      ws.send('pong');
      return;
    }
    
    // Handle keepalive pong responses from clients
    if (msg === 'pong') {
      if (isDev) console.log('keepAlive pong received');
      return;
    }
    
    // Broadcast all other messages to all clients except sender
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
        if (isDev) console.log('Sending keepalive ping to all clients');
        app.publish('broadcast', 'ping', uWS.OPCODE_TEXT);
      }, 50000);
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
  },
  
  // Handle WebSocket ping frames (different from text "ping" messages)
  ping: (ws, message) => {
    if (isDev) console.log('WebSocket ping frame received');
    // uWS automatically sends pong response for ping frames
  },
  
  // Handle WebSocket pong frames
  pong: (ws, message) => {
    if (isDev) console.log('WebSocket pong frame received');
  }
  
/* }).get('/*', (res, req) => {
  // Serve static files or simple response
  const url = req.getUrl();
  
  if (url === '/') {
    res.end('Hello World!');
  } else {
    // Simple static file serving (you can enhance this as needed)
    res.writeStatus('404 Not Found').end('Not Found');
  } */
}).listen(port, (success) => {
  if (success) {
    console.log(`Server started on port ${port} ${success}`);
  } else {
    console.log(`Failed to listen to port ${port}`);
    process.exit(1);
  }
});
