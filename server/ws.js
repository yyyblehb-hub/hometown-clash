'use strict';
/**
 * Tiny RFC 6455 WebSocket server (text frames only) so the game has zero npm
 * dependencies. Handles: handshake, masked client frames, ping/pong, close.
 * Not a general purpose library - just enough for this game's JSON messages.
 */
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 1 << 20; // 1 MiB

class WSConn extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.alive = true;
    this.socket.setNoDelay(true);
    this.socket.on('data', (d) => this._onData(d));
    this.socket.on('close', () => this._gone());
    this.socket.on('end', () => this._gone());
    this.socket.on('error', () => this._gone());
  }

  _gone() {
    if (!this.alive) return;
    this.alive = false;
    this.emit('close');
  }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const frame = this._readFrame();
      if (!frame) return;
      if (frame.opcode === 0x1) {
        this.emit('message', frame.payload.toString('utf8'));
      } else if (frame.opcode === 0x8) {
        this.close();
        return;
      } else if (frame.opcode === 0x9) {
        this._write(0xa, frame.payload); // ping -> pong
      }
      // binary (0x2) and pong (0xa) are ignored
    }
  }

  _readFrame() {
    const b = this.buf;
    if (b.length < 2) return null;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) === 0x80;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (b.length < off + 2) return null;
      len = b.readUInt16BE(off);
      off += 2;
    } else if (len === 127) {
      if (b.length < off + 8) return null;
      len = Number(b.readBigUInt64BE(off));
      off += 8;
    }
    if (len > MAX_FRAME) {
      this.close();
      return null;
    }
    let mask = null;
    if (masked) {
      if (b.length < off + 4) return null;
      mask = b.subarray(off, off + 4);
      off += 4;
    }
    if (b.length < off + len) return null;
    const payload = Buffer.from(b.subarray(off, off + len));
    if (mask) {
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }
    this.buf = b.subarray(off + len);
    return { opcode, payload };
  }

  _write(opcode, payload) {
    if (!this.alive || this.socket.destroyed) return;
    const len = payload.length;
    let head;
    if (len < 126) {
      head = Buffer.alloc(2);
      head[1] = len;
    } else if (len < 65536) {
      head = Buffer.alloc(4);
      head[1] = 126;
      head.writeUInt16BE(len, 2);
    } else {
      head = Buffer.alloc(10);
      head[1] = 127;
      head.writeBigUInt64BE(BigInt(len), 2);
    }
    head[0] = 0x80 | opcode;
    try {
      this.socket.write(Buffer.concat([head, payload]));
    } catch {
      this._gone();
    }
  }

  send(obj) {
    const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
    this._write(0x1, Buffer.from(text, 'utf8'));
  }

  close() {
    if (!this.alive) return;
    this._write(0x8, Buffer.alloc(0));
    try {
      this.socket.end();
    } catch {}
    this._gone();
  }
}

function handleUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return null;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  return new WSConn(socket);
}

module.exports = { handleUpgrade, WSConn };
