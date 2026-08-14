const CHANNEL = "homepage-terminal";
const HEARTBEAT_MS = 2000;
const LEADER_TIMEOUT_MS = 6000;
const MAX_BUFFER = 256 * 1024;
const ELECTION_WAIT_MS = 400;

const OUTPUT_BYTE = "0".charCodeAt(0);

export default function createTerminalSync({ src, cwd, onOutput, onStatus }) {
  const channel = new BroadcastChannel(CHANNEL);
  const selfId = crypto.randomUUID();
  let role = "pending";
  let ws = null;
  let heartbeatTimer = null;
  let leaderCheckTimer = null;
  let lastLeaderBeat = 0;
  let buffer = [];
  let bufferBytes = 0;
  let disposed = false;
  let cols = 80;
  let rows = 24;

  function broadcast(msg) {
    if (!disposed) channel.postMessage({ ...msg, from: selfId });
  }

  function appendBuffer(chunk) {
    buffer.push(chunk);
    bufferBytes += chunk.length;
    while (bufferBytes > MAX_BUFFER && buffer.length > 1) {
      bufferBytes -= buffer.shift().length;
    }
  }

  function becomeLeader() {
    if (disposed || role === "leader") return;
    role = "leader";
    broadcast({ type: "leader-claim" });
    onStatus("connecting");

    const url = new URL(src);
    const wsProto = url.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${wsProto}//${url.host}${url.pathname.replace(/\/$/, "")}/ws`, ["tty"]);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      if (disposed) {
        ws.close();
        return;
      }
      onStatus("connected");
      broadcast({ type: "status", status: "connected" });
      ws.send(JSON.stringify({ AuthToken: "", columns: cols, rows }));
      ws.send(`1${JSON.stringify({ columns: cols, rows })}`);
      if (cwd) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(`0cd ${cwd} && clear\r`);
        }, 150);
      }
    };

    ws.onmessage = (event) => {
      const raw = new Uint8Array(event.data);
      if (raw[0] === OUTPUT_BYTE) {
        const chunk = raw.slice(1);
        onOutput(chunk);
        appendBuffer(chunk);
        broadcast({ type: "output", data: Array.from(chunk) });
      }
    };

    ws.onclose = () => {
      if (!disposed) {
        onStatus("disconnected");
        broadcast({ type: "status", status: "disconnected" });
      }
    };

    heartbeatTimer = setInterval(() => broadcast({ type: "heartbeat" }), HEARTBEAT_MS);
  }

  function becomeFollower() {
    if (disposed || role === "follower") return;
    role = "follower";
    lastLeaderBeat = Date.now();
    onStatus("connecting");
    broadcast({ type: "buffer-request" });

    leaderCheckTimer = setInterval(() => {
      if (disposed) {
        clearInterval(leaderCheckTimer);
        return;
      }
      if (Date.now() - lastLeaderBeat > LEADER_TIMEOUT_MS) {
        clearInterval(leaderCheckTimer);
        leaderCheckTimer = null;
        becomeLeader();
      }
    }, HEARTBEAT_MS);
  }

  channel.onmessage = (event) => {
    const msg = event.data;
    if (msg.from === selfId) return;

    if (role === "leader") {
      if (msg.type === "input") {
        if (ws?.readyState === WebSocket.OPEN) ws.send(`0${msg.data}`);
      } else if (msg.type === "buffer-request") {
        const combined = new Uint8Array(bufferBytes);
        let offset = 0;
        for (const chunk of buffer) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        broadcast({ type: "buffer-response", data: Array.from(combined) });
        broadcast({
          type: "status",
          status: ws?.readyState === WebSocket.OPEN ? "connected" : "disconnected",
        });
      }
    } else if (role === "follower") {
      if (msg.type === "output") {
        onOutput(new Uint8Array(msg.data));
      } else if (msg.type === "buffer-response") {
        if (msg.data.length) onOutput(new Uint8Array(msg.data));
      } else if (msg.type === "status") {
        onStatus(msg.status);
      } else if (msg.type === "heartbeat" || msg.type === "leader-claim") {
        lastLeaderBeat = Date.now();
      } else if (msg.type === "leader-resign") {
        clearInterval(leaderCheckTimer);
        leaderCheckTimer = null;
        setTimeout(() => {
          if (!disposed && role === "follower") becomeLeader();
        }, Math.random() * 300);
      }
    } else if (role === "pending") {
      if (msg.type === "heartbeat" || msg.type === "leader-claim" || msg.type === "leader-ack") {
        becomeFollower();
      }
    }
  };

  broadcast({ type: "leader-check" });
  const electionTimer = setTimeout(() => {
    if (!disposed && role === "pending") becomeLeader();
  }, ELECTION_WAIT_MS);

  return {
    sendInput(data) {
      if (role === "leader") {
        if (ws?.readyState === WebSocket.OPEN) ws.send(`0${data}`);
      } else {
        broadcast({ type: "input", data });
      }
    },

    sendResize(nextCols, nextRows) {
      cols = nextCols;
      rows = nextRows;
      if (role === "leader" && ws?.readyState === WebSocket.OPEN) {
        ws.send(`1${JSON.stringify({ columns: cols, rows })}`);
      }
    },

    dispose() {
      disposed = true;
      clearTimeout(electionTimer);
      clearInterval(heartbeatTimer);
      clearInterval(leaderCheckTimer);
      if (role === "leader") {
        broadcast({ type: "leader-resign" });
        if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
      }
      channel.close();
    },

    get isLeader() {
      return role === "leader";
    },
  };
}
