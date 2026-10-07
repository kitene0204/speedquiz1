import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory room store for fast live relay fallback
interface StudentSubmission {
  id: string;
  roomId: string;
  studentName: string;
  avatar: string;
  keywords: string[];
  story?: string;
  submittedAt: number;
}

interface Room {
  id: string;
  pin: string;
  teacherName: string;
  status: 'waiting' | 'submitting' | 'playing' | 'revealed' | 'finished';
  currentQuizIndex: number;
  revealedKeywordCount: number;
  timerSeconds: number;
  submissions: StudentSubmission[];
  players: { id: string; name: string; avatar: string; score: number; isOnline: boolean }[];
  activeBuzzer: { studentId: string; studentName: string; timestamp: number } | null;
  lastGuessResult: { studentName: string; guessedPerson: string; isCorrect: boolean } | null;
}

const rooms = new Map<string, Room>();

// WebSocket for zero-config live multi-client sync
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastToRoom(roomId: string, message: any) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && (client as any).roomId === roomId) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws: WebSocket) => {
  let joinedRoomId: string | null = null;
  let playerId: string | null = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const { type, roomId, payload } = msg;

      if (type === 'JOIN_ROOM') {
        joinedRoomId = roomId;
        (ws as any).roomId = roomId;
        playerId = payload?.playerId || null;

        let room = rooms.get(roomId);
        if (!room) {
          room = {
            id: roomId,
            pin: roomId,
            teacherName: payload?.teacherName || '선생님',
            status: 'waiting',
            currentQuizIndex: 0,
            revealedKeywordCount: 1,
            timerSeconds: 30,
            submissions: [],
            players: [],
            activeBuzzer: null,
            lastGuessResult: null,
          };
          rooms.set(roomId, room);
        }

        if (payload?.player) {
          const existing = room.players.find((p) => p.id === payload.player.id);
          if (existing) {
            existing.isOnline = true;
            existing.name = payload.player.name;
            existing.avatar = payload.player.avatar;
          } else {
            room.players.push({ ...payload.player, score: 0, isOnline: true });
          }
        }

        ws.send(JSON.stringify({ type: 'ROOM_STATE', payload: room }));
        broadcastToRoom(roomId, { type: 'ROOM_STATE', payload: room });
      }

      if (type === 'SUBMIT_KEYWORDS') {
        const room = rooms.get(roomId);
        if (room) {
          const existingIdx = room.submissions.findIndex((s) => s.studentName === payload.studentName);
          const newSub: StudentSubmission = {
            id: payload.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            roomId,
            studentName: payload.studentName,
            avatar: payload.avatar || '🎓',
            keywords: payload.keywords,
            story: payload.story || '',
            submittedAt: Date.now(),
          };
          if (existingIdx >= 0) {
            room.submissions[existingIdx] = newSub;
          } else {
            room.submissions.push(newSub);
          }
          broadcastToRoom(roomId, { type: 'ROOM_STATE', payload: room });
        }
      }

      if (type === 'UPDATE_ROOM') {
        const room = rooms.get(roomId);
        if (room) {
          Object.assign(room, payload);
          broadcastToRoom(roomId, { type: 'ROOM_STATE', payload: room });
        }
      }

      if (type === 'BUZZ') {
        const room = rooms.get(roomId);
        if (room && !room.activeBuzzer) {
          room.activeBuzzer = {
            studentId: payload.studentId,
            studentName: payload.studentName,
            timestamp: Date.now(),
          };
          broadcastToRoom(roomId, { type: 'ROOM_STATE', payload: room });
          broadcastToRoom(roomId, { type: 'BUZZ_SOUND', payload: room.activeBuzzer });
        }
      }

      if (type === 'GUESS_ANSWER') {
        const room = rooms.get(roomId);
        if (room && room.status === 'playing') {
          const currentSubmission = room.submissions[room.currentQuizIndex];
          const isCorrect = currentSubmission && currentSubmission.studentName.trim().toLowerCase() === payload.guessedName.trim().toLowerCase();
          
          if (isCorrect) {
            const player = room.players.find((p) => p.name === payload.studentName);
            if (player) {
              // Points based on how few keywords were revealed (earlier = higher)
              const points = Math.max(20, 100 - (room.revealedKeywordCount - 1) * 20);
              player.score += points;
            }
            room.status = 'revealed';
            room.activeBuzzer = null;
            room.lastGuessResult = {
              studentName: payload.studentName,
              guessedPerson: payload.guessedName,
              isCorrect: true,
            };
          } else {
            room.activeBuzzer = null;
            room.lastGuessResult = {
              studentName: payload.studentName,
              guessedPerson: payload.guessedName,
              isCorrect: false,
            };
          }
          broadcastToRoom(roomId, { type: 'ROOM_STATE', payload: room });
        }
      }

      if (type === 'REQUEST_STATE') {
        const room = rooms.get(roomId);
        if (room) {
          ws.send(JSON.stringify({ type: 'ROOM_STATE', payload: room }));
        }
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });

  ws.on('close', () => {
    if (joinedRoomId && playerId) {
      const room = rooms.get(joinedRoomId);
      if (room) {
        const p = room.players.find((pl) => pl.id === playerId);
        if (p) p.isOnline = false;
        broadcastToRoom(joinedRoomId, { type: 'ROOM_STATE', payload: room });
      }
    }
  });
});

// REST API for rooms
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.get('/api/rooms/:pin', (req, res) => {
  const room = rooms.get(req.params.pin);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(room);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
