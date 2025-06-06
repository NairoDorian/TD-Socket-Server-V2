const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const app = express();
app.use(express.static("public"));

const serverPort = parseInt(process.env.PORT) || 3000;
const server = http.createServer(app);

// Optimized WebSocket server options
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false, // Disable compression for better performance
  maxPayload: 1024 * 1024 // 1MB max message size
});

let keepAliveId;
let clientCount = 0;

// Efficient broadcast function
const broadcast = (sender, message, includeSelf = false) => {
  const messageStr = message.toString();
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && (includeSelf || client !== sender)) {
      client.send(messageStr);
    }
  });
};

// Keepalive function
const startKeepAlive = () => {
  keepAliveId = setInterval(() => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send("ping");
      }
    });
  }, 50000);
};

wss.on("connection", (ws) => {
  clientCount++;
  
  if (process.env.NODE_ENV !== "production") {
    console.log("Connection opened. Client count:", clientCount);
  }

  // Start keepalive on first connection
  if (clientCount === 1) {
    if (process.env.NODE_ENV !== "production") {
      console.log("First connection: starting keepalive");
    }
    startKeepAlive();
  }

  ws.on("message", (data) => {
    const message = data.toString();
    
    if (message === "pong") {
      if (process.env.NODE_ENV !== "production") {
        console.log("keepAlive");
      }
      return;
    }
    
    broadcast(ws, message);
  });

  ws.on("close", () => {
    clientCount--;
    
    if (process.env.NODE_ENV !== "production") {
      console.log("Connection closed. Client count:", clientCount);
    }

    // Stop keepalive when last client disconnects
    if (clientCount === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.log("Last client disconnected, stopping keepalive");
      }
      clearInterval(keepAliveId);
    }
  });

  ws.on("error", (error) => {
    console.log("WebSocket error:", error);
    clientCount--;
  });
});

app.get("/", (req, res) => res.send("Hello World!"));

server.listen(serverPort, '0.0.0.0', () => {
  console.log(`Server started on port ${serverPort} in stage ${process.env.NODE_ENV || 'development'}`);
});
