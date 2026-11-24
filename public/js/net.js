/** Thin WebSocket wrapper: JSON messages, auto-reconnect, simple events. */
export class Net {
  constructor() {
    this.handlers = new Map();
    this.queue = [];
    this.ws = null;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws;
    try {
      ws = new WebSocket(`${proto}//${location.host}/ws`);
    } catch {
      setTimeout(() => this.connect(), 1500);
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      for (const m of this.queue) {
        try {
          ws.send(m);
        } catch {}
      }
      this.queue = [];
      this.emit('open', {});
    };
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m && typeof m.t === 'string') this.emit(m.t, m);
    };
    ws.onclose = () => {
      this.emit('closed', {});
      setTimeout(() => this.connect(), 1200);
    };
    ws.onerror = () => {};
  }

  send(obj) {
    const text = JSON.stringify(obj);
    if (this.ws && this.ws.readyState === 1) this.ws.send(text);
    else this.queue.push(text);
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }

  emit(type, msg) {
    const list = this.handlers.get(type);
    if (!list) return;
    for (const fn of list) fn(msg);
  }
}
