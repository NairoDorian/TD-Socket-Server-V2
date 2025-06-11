const uWS = require('uWebSockets.js');

const port = parseInt(process.env.PORT) || 3000;
///const isDev = process.env.NODE_ENV !== 'production';
const isDev = false;

// Store authenticated receivers
const authenticatedReceivers = new Set();
const RECEIVER_TOKEN = process.env.RECEIVER_TOKEN || 'SECRET_RECEIVER_TOKEN_123';

let clientCount = 0;
let keepAliveId = null;

// Keep authenticated clients alive with periodic pings
const keepAuthClientAlive = () => {
  keepAliveId = setInterval(() => {
    for (const client of authenticatedReceivers) {
      client.send('ping');
      if (isDev) console.log(`Sent ping to authenticated client: ${client.clientId}`);
    }
  }, 10000); // Send ping every 10 seconds
};

const app = uWS.App({
  compression: uWS.DISABLED,
}).ws('/*', {
  message: (ws, message, opCode) => {
    try {
      const msg = Buffer.from(message).toString();
      
      if (isDev) {
        console.log('Received message:', msg);
      }
      
      // Handle ping/pong
      if (msg === 'ping') {
        if (isDev) console.log('Client ping received, sending pong response');
        ws.send('pong');
        return;
      }
      
      if (msg === 'pong') {
        if (isDev) console.log('Client pong received');
        return;
      }
      
      // Handle authentication for privileged receiver
      if (msg.startsWith('AUTH:')) {
        const token = msg.substring(5); // Remove 'AUTH:' prefix
        
        if (token === RECEIVER_TOKEN) {
          // Mark this client as authenticated receiver
          ws.isReceiver = true;
          authenticatedReceivers.add(ws);
          
          // Subscribe to the privileged topic
          ws.subscribe('privileged-monitor');
          
          // Start keep-alive if this is the first authenticated receiver
          if (authenticatedReceivers.size === 1 && !keepAliveId) {
            keepAuthClientAlive();
            if (isDev) console.log('Started keep-alive for authenticated clients');
          }
          
          //ws.send('AUTH:SUCCESS');
          if (isDev) console.log('Client authenticated as privileged receiver');
        } else {
          //ws.send('AUTH:FAILED');
          if (isDev) console.log('Client authentication failed');
        }
        return;
      }
      
      // Handle regular messages
      if (!ws.isReceiver) {
        // Regular client sent a message
        // Send to ALL authenticated receivers only
        if (authenticatedReceivers.size > 0) {
        
          // Parse the original message to extract x and y coordinates
          const originalMessage = JSON.parse(msg);
          
          // Create the flattened message structure
          const messageWithSender = JSON.stringify({
            senderId: ws.clientId || 'unknown',
            x: originalMessage.x,
            y: originalMessage.y
          });
          
          app.publish('privileged-monitor', messageWithSender, uWS.OPCODE_TEXT);
          
          if (isDev) {
            console.log(`Message from regular client forwarded to ${authenticatedReceivers.size} authenticated receiver(s)`);
          }
          
        }
        /* 
        // Optionally send confirmation back to sender
        ws.send(JSON.stringify({
          type: 'message_sent',
          status: 'delivered_to_receivers'
        })); */
        
      } else {
        // Message from authenticated receiver
        // You can decide what to do with these messages
        // For now, let's just log them
        if (isDev) {
          console.log('Message from privileged receiver:', msg);
        }
        
        // Optionally, you could broadcast receiver messages to other receivers
        // or handle them differently
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
      /* ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      })); */
    }
  },
  
  open: (ws) => {
    clientCount++;
    
    // Assign a unique ID to each client
    //ws.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    ws.clientId = Math.random().toString(36).substring(2, 12);
    ws.isReceiver = false;
    
    if (isDev) {
      console.log(`Connection opened. Client ID: ${ws.clientId}, Total clients: ${clientCount}`);
    }
    
    /* // Send welcome message with client ID
    ws.send(JSON.stringify({
      type: 'connection_established',
      clientId: ws.clientId,
      message: 'Connected! Send AUTH:your_token to become privileged receiver'
    })); */
  },
  
  close: (ws) => {
    clientCount--;
    
    // Clean up if this was an authenticated receiver
    if (ws.isReceiver) {
      authenticatedReceivers.delete(ws);
      
      // Stop keep-alive if no authenticated receivers remain
      if (authenticatedReceivers.size === 0 && keepAliveId) {
        clearInterval(keepAliveId);
        keepAliveId = null;
        if (isDev) console.log('Stopped keep-alive - no authenticated clients remaining');
      }
      
      if (isDev) {
        console.log(`Privileged receiver disconnected. Remaining receivers: ${authenticatedReceivers.size}`);
      }
    }
    
    if (isDev) {
      console.log(`Connection closed. Client ID: ${ws.clientId}, Total clients: ${clientCount}`);
    }
  },
  
  ping: (ws, message) => {
    if (isDev) console.log('WebSocket ping frame received');
  },
  
  pong: (ws, message) => {
    if (isDev) console.log('WebSocket pong frame received');
  }
  
/* }).get('/*', (res, req) => {
  const url = req.getUrl();
  
  if (url === '/') {
    res.end(`
      <h1>Privileged Receiver WebSocket Server</h1>
      <p>Connect via WebSocket and:</p>
      <ul>
        <li>Send <code>AUTH:${RECEIVER_TOKEN}</code> to become privileged receiver</li>
        <li>Regular clients' messages will be forwarded to privileged receivers only</li>
      </ul>
      <p>Total authenticated receivers: ${authenticatedReceivers.size}</p>
    `);
  } else {
    res.writeStatus('404 Not Found').end('Not Found');
  } */
  
}).listen(port, (listenSocket) => {
  if (listenSocket) {
    console.log(`Server started on port ${port} in stage ${process.env.NODE_ENV || 'development'}`);
    console.log(`Receiver token: ${RECEIVER_TOKEN}`);
  } else {
    console.log(`Failed to listen to port ${port}`);
    process.exit(1);
  }
});

/* // Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  app.close();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  app.close();
}); */
