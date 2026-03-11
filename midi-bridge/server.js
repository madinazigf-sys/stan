#!/usr/bin/env node
/**
 * MIDI WebSocket relay server.
 * - "sender" role: the browser on this PC (reads Web MIDI, sends notes here)
 * - "receiver" role: iPad Safari (receives notes)
 *
 * Usage: node midi-bridge/server.js [--ws 9001]
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const wsPort = (() => {
  const i = args.indexOf('--ws');
  return i !== -1 ? parseInt(args[i + 1], 10) : 9001;
})();

// Serve the sender HTML page on the same port via HTTP
const senderHtml = readFileSync(join(__dirname, 'sender.html'), 'utf8');

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(senderHtml);
});

const wss = new WebSocketServer({ server: httpServer });

const senders = new Set();
const receivers = new Set();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost`);
  const role = url.searchParams.get('role') === 'sender' ? 'sender' : 'receiver';

  if (role === 'sender') {
    senders.add(ws);
    console.log(`[+] Sender connected (browser on this PC)`);
    ws.on('close', () => { senders.delete(ws); console.log(`[-] Sender disconnected`); });
    ws.on('message', (data) => {
      // Forward MIDI note to all iPad receivers
      for (const r of receivers) {
        if (r.readyState === r.OPEN) r.send(data);
      }
    });
  } else {
    receivers.add(ws);
    console.log(`[+] Receiver connected (iPad)`);
    ws.on('close', () => { receivers.delete(ws); console.log(`[-] Receiver disconnected`); });
  }
});

httpServer.listen(wsPort, () => {
  console.log('================================');
  console.log('   MIDI WebSocket Relay Server  ');
  console.log('================================');
  console.log(`\n1. Open in Chrome on this PC:`);
  console.log(`   http://localhost:${wsPort}`);
  console.log(`\n2. Connect iPad to:`);
  console.log(`   ws://<this-PC-IP>:${wsPort}`);
  console.log(`   (find IP via: ipconfig)`);
  console.log(`\nTo stop — close this window\n`);
});

process.on('SIGINT', () => { httpServer.close(); process.exit(0); });
