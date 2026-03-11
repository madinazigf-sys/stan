#!/usr/bin/env node
/**
 * MIDI WebSocket Bridge
 *
 * Reads MIDI input on this computer and broadcasts Note On messages
 * over WebSocket so an iPad (or any browser) can receive them.
 *
 * Usage:
 *   node midi-bridge/bridge.js           # auto-picks first MIDI input
 *   node midi-bridge/bridge.js --list    # list available MIDI inputs
 *   node midi-bridge/bridge.js --port 1  # use input at index 1
 *   node midi-bridge/bridge.js --ws 9001 # use a different WebSocket port (default: 9001)
 */

import JZZ from 'jzz';
import { WebSocketServer } from 'ws';

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const wsPort = (() => {
  const i = args.indexOf('--ws');
  return i !== -1 ? parseInt(args[i + 1], 10) : 9001;
})();
const midiPortIndex = (() => {
  const i = args.indexOf('--port');
  return i !== -1 ? parseInt(args[i + 1], 10) : 0;
})();

async function main() {
  const engine = await JZZ();
  const info = await engine.info();

  const inputs = info.inputs || [];

  if (inputs.length === 0) {
    console.error('No MIDI input devices found. Connect a keyboard and try again.');
    process.exit(1);
  }

  if (listOnly) {
    console.log('Available MIDI inputs:');
    inputs.forEach((inp, i) => console.log(`  [${i}] ${inp.name}`));
    process.exit(0);
  }

  if (midiPortIndex >= inputs.length) {
    console.error(`Port index ${midiPortIndex} not found. Run with --list to see available inputs.`);
    process.exit(1);
  }

  const deviceName = inputs[midiPortIndex].name;
  console.log(`Using MIDI input: "${deviceName}" (index ${midiPortIndex})`);

  const wss = new WebSocketServer({ port: wsPort });
  console.log(`WebSocket server listening on ws://0.0.0.0:${wsPort}`);
  console.log('Connect iPad to: ws://<this-computer-IP>:' + wsPort);
  console.log('Find your IP: run "ipconfig" (Windows) or "ifconfig" (Mac/Linux)');

  const clients = new Set();
  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    clients.add(ws);
    console.log(`[+] iPad connected from ${ip} (${clients.size} total)`);
    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[-] Client disconnected (${clients.size} remaining)`);
    });
  });

  const broadcast = (note) => {
    const msg = JSON.stringify({ midi: note });
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    }
  };

  const port = await engine.openMidiIn(deviceName);
  port.connect(JZZ.Widget.newCallbackWidget({
    receive(msg) {
      // Note On: status high nibble 0x9, velocity > 0
      if ((msg[0] & 0xF0) === 0x90 && msg[2] > 0) {
        broadcast(msg[1]);
        console.log(`Note On: ${msg[1]}`);
      }
    }
  }));

  console.log('\nBridge running. Press Ctrl+C to stop.\n');

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    wss.close();
    await engine.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Bridge error:', err.message || err);
  process.exit(1);
});
