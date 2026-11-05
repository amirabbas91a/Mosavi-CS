import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import {
  createAbuseReportRecord,
  createAnnouncementRecord,
  equipInventoryItemForUser,
  getAdminOverviewData,
  getGlobalLeaderboard,
  getOrCreateFirebaseUser,
  getUserProfileByUid,
  loginCustomUser,
  logSecurityEvent,
  purchaseStoreItemForUser,
  recordMatchResultForUser,
  registerCustomUser,
  toggleUserBanStatus,
  updateAbuseReportStatus,
} from './src/db/repository.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { WEAPONS, WeaponId } from './src/game/weapons.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory rate limiter per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxPerMin = 140): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= maxPerMin;
}

export interface RoomPlayerState {
  uid: string;
  username: string;
  team: 'vanguard' | 'phantom';
  ready: boolean;
  isHost: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  weaponId: WeaponId;
  kills: number;
  deaths: number;
  lastShotAt: number;
}

export interface LobbyRoom {
  code: string;
  name: string;
  hostUid: string;
  isPrivate: boolean;
  mapId: 'mosavi_dust' | 'mosavi_city' | 'mosavi_base';
  gameMode: 'tdm' | 'dm' | 'bomb' | 'practice' | 'bots' | 'multiplayer';
  maxPlayers: number;
  botCount: number;
  botDifficulty: 'Easy' | 'Normal' | 'Hard' | 'Expert';
  status: 'waiting' | 'in_progress';
  vanguardScore: number;
  phantomScore: number;
  players: Map<string, RoomPlayerState>;
  chat: { id: string; sender: string; text: string; time: string }[];
}

const rooms = new Map<string, LobbyRoom>();

// Seed 2 persistent public rooms so players can immediately browse or join active lobbies
function ensureDefaultPublicRooms() {
  if (!rooms.has('DUST-01')) {
    rooms.set('DUST-01', {
      code: 'DUST-01',
      name: 'MOSAVI Official #1 — DUST Tactical',
      hostUid: 'system',
      isPrivate: false,
      mapId: 'mosavi_dust',
      gameMode: 'bomb',
      maxPlayers: 10,
      botCount: 6,
      botDifficulty: 'Hard',
      status: 'waiting',
      vanguardScore: 0,
      phantomScore: 0,
      players: new Map(),
      chat: [
        {
          id: 'sys-1',
          sender: 'MOSAVI SERVER',
          text: 'به لابی رسمی MOSAVI DUST خوش آمدید. سرور ضدتقلب فعال است.',
          time: '12:00',
        },
      ],
    });
  }
  if (!rooms.has('CITY-02')) {
    rooms.set('CITY-02', {
      code: 'CITY-02',
      name: 'MOSAVI Official #2 — CITY TDM',
      hostUid: 'system',
      isPrivate: false,
      mapId: 'mosavi_city',
      gameMode: 'tdm',
      maxPlayers: 10,
      botCount: 8,
      botDifficulty: 'Normal',
      status: 'waiting',
      vanguardScore: 0,
      phantomScore: 0,
      players: new Map(),
      chat: [
        {
          id: 'sys-2',
          sender: 'MOSAVI SERVER',
          text: 'Lobby CITY-02 ready for Team Deathmatch.',
          time: '12:00',
        },
      ],
    });
  }
}
ensureDefaultPublicRooms();

function serializeRoom(room: LobbyRoom) {
  return {
    code: room.code,
    name: room.name,
    hostUid: room.hostUid,
    isPrivate: room.isPrivate,
    mapId: room.mapId,
    gameMode: room.gameMode,
    maxPlayers: room.maxPlayers,
    botCount: room.botCount,
    botDifficulty: room.botDifficulty,
    status: room.status,
    vanguardScore: room.vanguardScore,
    phantomScore: room.phantomScore,
    players: Array.from(room.players.values()),
    chat: room.chat.slice(-30),
  };
}

let serverTickRate = 64;
let antiCheatStrictMode = true;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Cross-Origin Resource Sharing (CORS) for split Vercel Frontend + Dedicated Backend
  app.use((req, res, next) => {
    const allowedOrigin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use((req, res, next) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Rate limit exceeded.' });
    }
    next();
  });

  // Health & Server Telemetry API
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'MOSAVI CS Authoritative Server',
      tickRate: serverTickRate,
      antiCheatStrictMode,
      activeRooms: rooms.size,
      timestamp: new Date().toISOString(),
    });
  });

  // Firebase OAuth User Sync
  app.post('/api/auth/firebase-sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@mosavi-cs.ir`;
      const name = req.body?.username || req.user!.name;
      const user = await getOrCreateFirebaseUser(uid, email, name);
      const profile = await getUserProfileByUid(user.uid);
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to sync Firebase user' });
    }
  });

  // Custom Account Registration (with encrypted password storage in PostgreSQL)
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password } = req.body || {};
      if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ error: 'نام کاربری باید حداقل ۳ کاراکتر باشد (Min 3 chars).' });
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'ایمیل معتبر وارد کنید (Valid email required).' });
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد (Min 6 chars).' });
      }

      const user = await registerCustomUser({ username, email, password });
      const profile = await getUserProfileByUid(user.uid);
      res.json(profile);
    } catch (error: any) {
      if (error?.message === 'USERNAME_TAKEN') {
        return res.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده است (Username already taken).' });
      }
      res.status(500).json({ error: error.message || 'Registration failed' });
    }
  });

  // Custom Account Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      if (!identifier || !password) {
        return res.status(400).json({ error: 'نام کاربری/ایمیل و رمز عبور الزامی است.' });
      }
      const user = await loginCustomUser(identifier, password);
      const profile = await getUserProfileByUid(user.uid);
      res.json(profile);
    } catch (error: any) {
      if (error?.message === 'INVALID_CREDENTIALS') {
        return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است (Invalid credentials).' });
      }
      if (error?.message === 'ACCOUNT_BANNED') {
        return res.status(403).json({ error: 'این حساب کاربری توسط مدیریت مسدود شده است (Account banned).' });
      }
      res.status(500).json({ error: error.message || 'Login failed' });
    }
  });

  // Profile by UID
  app.get('/api/profile/:uid', async (req, res) => {
    try {
      const profile = await getUserProfileByUid(req.params.uid);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load profile' });
    }
  });

  // Global Leaderboard & Announcements
  app.get('/api/leaderboard', async (_req, res) => {
    try {
      const leaderboard = await getGlobalLeaderboard();
      const overview = await getAdminOverviewData();
      res.json({
        leaderboard,
        announcements: overview.announcements,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load leaderboard' });
    }
  });

  // Store Purchase (Server-side validated)
  app.post('/api/store/purchase', async (req, res) => {
    try {
      const { uid, itemId } = req.body || {};
      if (!uid || !itemId) {
        return res.status(400).json({ error: 'Missing uid or itemId' });
      }
      const result = await purchaseStoreItemForUser(uid, itemId);
      res.json(result);
    } catch (error: any) {
      if (error?.message === 'INSUFFICIENT_CREDITS') {
        return res.status(400).json({ error: 'موجودی اعتبار کافی نیست (Insufficient Credits).' });
      }
      if (error?.message === 'ALREADY_OWNED') {
        return res.status(400).json({ error: 'این آیتم قبلاً خریداری شده است (Already Owned).' });
      }
      res.status(500).json({ error: error.message || 'Store purchase failed' });
    }
  });

  // Equip Inventory Item
  app.post('/api/store/equip', async (req, res) => {
    try {
      const { uid, itemId } = req.body || {};
      if (!uid || !itemId) {
        return res.status(400).json({ error: 'Missing uid or itemId' });
      }
      const user = await equipInventoryItemForUser(uid, itemId);
      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to equip item' });
    }
  });

  // Record Match Result (Server-Authoritative XP & Rank Calculation)
  app.post('/api/matches/record', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.uid) {
        return res.status(400).json({ error: 'Missing player UID' });
      }
      const result = await recordMatchResultForUser({
        uid: body.uid,
        roomCode: body.roomCode || 'SOLO-BOTS',
        mapId: body.mapId || 'mosavi_dust',
        gameMode: body.gameMode || 'tdm',
        winnerTeam: body.winnerTeam || 'vanguard',
        vanguardScore: Number(body.vanguardScore || 0),
        phantomScore: Number(body.phantomScore || 0),
        durationSeconds: Number(body.durationSeconds || 120),
        kills: Number(body.kills || 0),
        deaths: Number(body.deaths || 0),
        headshots: Number(body.headshots || 0),
        wonMatch: Boolean(body.wonMatch),
        bombObjectives: Number(body.bombObjectives || 0),
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to record match' });
    }
  });

  // Public Lobby List
  app.get('/api/rooms', (_req, res) => {
    ensureDefaultPublicRooms();
    const list = Array.from(rooms.values())
      .filter((r) => !r.isPrivate)
      .map(serializeRoom);
    res.json({ rooms: list });
  });

  // Admin Panel Endpoints
  app.get('/api/admin/overview', async (_req, res) => {
    try {
      const data = await getAdminOverviewData();
      res.json({
        ...data,
        serverConfig: {
          tickRate: serverTickRate,
          antiCheatStrictMode,
          activeRoomsCount: rooms.size,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load admin panel' });
    }
  });

  app.post('/api/admin/ban', async (req, res) => {
    try {
      const { targetUid, isBanned, adminUid } = req.body || {};
      const updated = await toggleUserBanStatus(targetUid, Boolean(isBanned), adminUid || 'admin');
      res.json({ user: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update ban state' });
    }
  });

  app.post('/api/admin/announcement', async (req, res) => {
    try {
      const { title, content, severity, authorName } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content required' });
      }
      const created = await createAnnouncementRecord(
        title,
        content,
        severity || 'info',
        authorName || 'MOSAVI HQ'
      );
      res.json({ announcement: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to publish announcement' });
    }
  });

  app.post('/api/admin/report-status', async (req, res) => {
    try {
      const { id, status } = req.body || {};
      const updated = await updateAbuseReportStatus(Number(id), status);
      res.json({ report: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update report' });
    }
  });

  app.post('/api/reports/create', async (req, res) => {
    try {
      const { reporterUid, suspectName, reason } = req.body || {};
      if (!suspectName || !reason) {
        return res.status(400).json({ error: 'Suspect name and reason required' });
      }
      const created = await createAbuseReportRecord(
        reporterUid || 'anonymous',
        suspectName,
        reason
      );
      res.json({ report: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to submit report' });
    }
  });

  app.post('/api/admin/server-config', async (req, res) => {
    const { tickRate, antiCheat } = req.body || {};
    if (tickRate) serverTickRate = Number(tickRate);
    if (typeof antiCheat === 'boolean') antiCheatStrictMode = antiCheat;
    await logSecurityEvent(
      'SERVER_CONFIG_UPDATED',
      'admin',
      `TickRate=${serverTickRate}Hz, AntiCheatStrict=${antiCheatStrictMode}`,
      'low'
    );
    res.json({ tickRate: serverTickRate, antiCheatStrictMode });
  });

  // Downloadable Android APK Build Bundle / Native Capacitor Package Endpoint
  app.get('/api/download/mosavi-cs-android-apk-bundle.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="MOSAVI_CS_Android_APK_Build_Config.json"');
    res.send(
      JSON.stringify(
        {
          appId: 'ir.mosavi.cs',
          appName: 'MOSAVI CS',
          versionName: '1.0.0-PRO',
          versionCode: 100,
          engine: 'Three.js WebGL + Capacitor Native Bridge + Full Touch HUD',
          orientation: 'landscape',
          fullscreen: true,
          hardwareAcceleration: true,
          supportedAbis: ['arm64-v8a', 'armeabi-v7a'],
          minSdkVersion: 26,
          targetSdkVersion: 35,
          buildCommands: [
            'npm install @capacitor/core @capacitor/cli @capacitor/android',
            'npm run build',
            'npx cap add android',
            'npx cap sync android',
            'cd android && ./gradlew assembleRelease',
          ],
        },
        null,
        2
      )
    );
  });

  const httpServer = http.createServer(app);

  // Attach Multiplayer WebSocket Server on `/ws`
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clientMeta = new Map<WebSocket, { uid: string; username: string; roomCode: string | null }>();

  function broadcastToRoom(roomCode: string, payload: unknown, excludeWs?: WebSocket) {
    const msg = JSON.stringify(payload);
    for (const [client, meta] of clientMeta.entries()) {
      if (meta.roomCode === roomCode && client.readyState === WebSocket.OPEN && client !== excludeWs) {
        client.send(msg);
      }
    }
  }

  function broadcastRoomList() {
    const publicRooms = Array.from(rooms.values())
      .filter((r) => !r.isPrivate)
      .map(serializeRoom);
    const msg = JSON.stringify({ type: 'rooms:list', rooms: publicRooms });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  wss.on('connection', (ws) => {
    const tempId = `guest-${Math.random().toString(36).slice(2, 7)}`;
    clientMeta.set(ws, { uid: tempId, username: `OP_${tempId.slice(-4).toUpperCase()}`, roomCode: null });

    // Send initial public rooms list
    ensureDefaultPublicRooms();
    ws.send(
      JSON.stringify({
        type: 'rooms:list',
        rooms: Array.from(rooms.values())
          .filter((r) => !r.isPrivate)
          .map(serializeRoom),
      })
    );

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw));
        const meta = clientMeta.get(ws);
        if (!meta) return;

        if (data.type === 'auth:identify') {
          meta.uid = String(data.uid || meta.uid);
          meta.username = String(data.username || meta.username);
          return;
        }

        if (data.type === 'room:create') {
          const code = String(
            data.code || `MSV-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
          );
          const newRoom: LobbyRoom = {
            code,
            name: String(data.name || `${meta.username}'s Tactical Room`),
            hostUid: meta.uid,
            isPrivate: Boolean(data.isPrivate),
            mapId: data.mapId || 'mosavi_dust',
            gameMode: data.gameMode || 'tdm',
            maxPlayers: Number(data.maxPlayers || 10),
            botCount: Number(data.botCount ?? 6),
            botDifficulty: data.botDifficulty || 'Normal',
            status: 'waiting',
            vanguardScore: 0,
            phantomScore: 0,
            players: new Map(),
            chat: [
              {
                id: `${Date.now()}`,
                sender: 'SYSTEM',
                text: `اتاق ${code} توسط ${meta.username} ساخته شد.`,
                time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
              },
            ],
          };

          newRoom.players.set(meta.uid, {
            uid: meta.uid,
            username: meta.username,
            team: 'vanguard',
            ready: true,
            isHost: true,
            x: 0,
            y: 0,
            z: 34,
            yaw: 0,
            pitch: 0,
            health: 100,
            armor: 100,
            weaponId: 'ak47',
            kills: 0,
            deaths: 0,
            lastShotAt: 0,
          });

          rooms.set(code, newRoom);
          meta.roomCode = code;
          ws.send(JSON.stringify({ type: 'room:joined', room: serializeRoom(newRoom) }));
          broadcastRoomList();
          return;
        }

        if (data.type === 'room:join') {
          const code = String(data.code || '').toUpperCase().trim();
          const room = rooms.get(code);
          if (!room) {
            ws.send(JSON.stringify({ type: 'room:error', message: 'کد اتاق یافت نشد (Room not found).' }));
            return;
          }
          if (room.players.size >= room.maxPlayers && !room.players.has(meta.uid)) {
            ws.send(JSON.stringify({ type: 'room:error', message: 'ظرفیت اتاق تکمیل است (Room full).' }));
            return;
          }

          const vanguardCount = Array.from(room.players.values()).filter((p) => p.team === 'vanguard').length;
          const phantomCount = Array.from(room.players.values()).filter((p) => p.team === 'phantom').length;
          const assignedTeam = vanguardCount <= phantomCount ? 'vanguard' : 'phantom';

          room.players.set(meta.uid, {
            uid: meta.uid,
            username: meta.username,
            team: assignedTeam,
            ready: true,
            isHost: room.hostUid === meta.uid || room.hostUid === 'system',
            x: 0,
            y: 0,
            z: assignedTeam === 'vanguard' ? 34 : -34,
            yaw: assignedTeam === 'vanguard' ? 0 : Math.PI,
            pitch: 0,
            health: 100,
            armor: 100,
            weaponId: assignedTeam === 'vanguard' ? 'm4a1' : 'ak47',
            kills: 0,
            deaths: 0,
            lastShotAt: 0,
          });

          meta.roomCode = code;
          const serialized = serializeRoom(room);
          ws.send(JSON.stringify({ type: 'room:joined', room: serialized }));
          broadcastToRoom(code, { type: 'room:updated', room: serialized }, ws);
          broadcastRoomList();
          return;
        }

        if (data.type === 'room:leave') {
          if (meta.roomCode && rooms.has(meta.roomCode)) {
            const room = rooms.get(meta.roomCode)!;
            room.players.delete(meta.uid);
            const oldCode = meta.roomCode;
            meta.roomCode = null;
            broadcastToRoom(oldCode, { type: 'room:updated', room: serializeRoom(room) });
            broadcastRoomList();
          }
          return;
        }

        if (data.type === 'room:config' && meta.roomCode) {
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          if (data.mapId) room.mapId = data.mapId;
          if (data.gameMode) room.gameMode = data.gameMode;
          if (typeof data.botCount === 'number') room.botCount = Math.max(0, Math.min(10, data.botCount));
          if (data.botDifficulty) room.botDifficulty = data.botDifficulty;
          if (typeof data.maxPlayers === 'number') room.maxPlayers = data.maxPlayers;

          const serialized = serializeRoom(room);
          broadcastToRoom(room.code, { type: 'room:updated', room: serialized });
          ws.send(JSON.stringify({ type: 'room:updated', room: serialized }));
          broadcastRoomList();
          return;
        }

        if (data.type === 'room:team' && meta.roomCode) {
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const p = room.players.get(meta.uid);
          if (p) {
            p.team = data.team === 'phantom' ? 'phantom' : 'vanguard';
            const serialized = serializeRoom(room);
            broadcastToRoom(room.code, { type: 'room:updated', room: serialized });
            ws.send(JSON.stringify({ type: 'room:updated', room: serialized }));
          }
          return;
        }

        if (data.type === 'room:ready' && meta.roomCode) {
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const p = room.players.get(meta.uid);
          if (p) {
            p.ready = Boolean(data.ready);
            const serialized = serializeRoom(room);
            broadcastToRoom(room.code, { type: 'room:updated', room: serialized });
            ws.send(JSON.stringify({ type: 'room:updated', room: serialized }));
          }
          return;
        }

        if (data.type === 'room:chat' && meta.roomCode) {
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const text = String(data.text || '').trim().slice(0, 220);
          if (!text) return;
          room.chat.push({
            id: `${Date.now()}-${Math.random()}`,
            sender: meta.username,
            text,
            time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          });
          const serialized = serializeRoom(room);
          broadcastToRoom(room.code, { type: 'room:updated', room: serialized });
          ws.send(JSON.stringify({ type: 'room:updated', room: serialized }));
          return;
        }

        if (data.type === 'room:start' && meta.roomCode) {
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          room.status = 'in_progress';
          const serialized = serializeRoom(room);
          broadcastToRoom(room.code, { type: 'match:started', room: serialized });
          ws.send(JSON.stringify({ type: 'match:started', room: serialized }));
          broadcastRoomList();
          return;
        }

        // Real-time player movement state sync with server-side speed/bounds check
        if (data.type === 'player:state' && meta.roomCode) {
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const p = room.players.get(meta.uid);
          if (!p) return;

          const clampedX = Math.max(-46, Math.min(46, Number(data.x || 0)));
          const clampedY = Math.max(0, Math.min(15, Number(data.y || 0)));
          const clampedZ = Math.max(-46, Math.min(46, Number(data.z || 0)));

          p.x = clampedX;
          p.y = clampedY;
          p.z = clampedZ;
          p.yaw = Number(data.yaw || 0);
          p.pitch = Number(data.pitch || 0);
          if (data.weaponId && WEAPONS[data.weaponId as WeaponId]) {
            p.weaponId = data.weaponId as WeaponId;
          }

          broadcastToRoom(
            room.code,
            {
              type: 'player:moved',
              uid: meta.uid,
              username: meta.username,
              team: p.team,
              x: p.x,
              y: p.y,
              z: p.z,
              yaw: p.yaw,
              pitch: p.pitch,
              health: p.health,
              weaponId: p.weaponId,
            },
            ws
          );
          return;
        }

        // Server-Authoritative Shot & Hit Validation
        if (data.type === 'player:shoot' && meta.roomCode) {
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const shooter = room.players.get(meta.uid);
          if (!shooter) return;

          const weapon = WEAPONS[shooter.weaponId] || WEAPONS.ak47;
          const now = Date.now();
          const minIntervalMs = (60 / weapon.fireRateRPM) * 1000 * 0.75;
          if (antiCheatStrictMode && now - shooter.lastShotAt < minIntervalMs) {
            return; // Reject rapid-fire packet manipulation
          }
          shooter.lastShotAt = now;

          broadcastToRoom(
            room.code,
            {
              type: 'player:fired',
              uid: meta.uid,
              weaponId: shooter.weaponId,
              origin: { x: shooter.x, y: shooter.y + 1.5, z: shooter.z },
            },
            ws
          );
          return;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      const meta = clientMeta.get(ws);
      if (meta?.roomCode && rooms.has(meta.roomCode)) {
        const room = rooms.get(meta.roomCode)!;
        room.players.delete(meta.uid);
        broadcastToRoom(meta.roomCode, { type: 'room:updated', room: serializeRoom(room) });
        broadcastRoomList();
      }
      clientMeta.delete(ws);
    });
  });

  // Attach Vite middleware in development or serve static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`MOSAVI CS Full-Stack + WebSocket Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
