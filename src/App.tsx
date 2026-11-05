import React, { useEffect, useRef, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import {
  ExternalControlBridge,
  GameShellState,
  GraphicsSettings,
  HudSnapshot,
  TacticalArena3D,
} from './components/TacticalArena3D.tsx';
import {
  MobileHudCustomization,
  TacticalHudOverlay,
} from './components/TacticalHudOverlay.tsx';
import {
  ActiveModalTab,
  CommandModals,
  InventoryRecord,
  MatchRecord,
  RoomDto,
  UserProfileRecord,
} from './components/CommandModals.tsx';
import { MAPS, MapId } from './game/maps.ts';
import { BotDifficulty, GAME_MODES, GameModeId } from './game/rules.ts';
import { BotTeam } from './game/botAI.ts';

const INITIAL_HUD: HudSnapshot = {
  health: 100,
  armor: 100,
  activeWeapon: 'ak47',
  primaryWeapon: 'ak47',
  secondaryWeapon: 'deagle',
  magAmmo: 30,
  reserveAmmo: 90,
  isReloading: false,
  isAiming: false,
  isCrouching: false,
  cash: 4500,
  vanguardScore: 0,
  phantomScore: 0,
  timeRemainingSec: 480,
  playerKills: 0,
  playerDeaths: 0,
  playerHeadshots: 0,
  bombState: 'none',
  bombCountdownSec: 40,
  nearBombSite: null,
  actionProgress: 0,
  flashAlpha: 0,
  hitMarkerType: 'none',
  damageIndicatorAlpha: 0,
  radarEntities: [],
  playerX: 0,
  playerZ: 36,
  playerYaw: 0,
  killFeed: [],
  botsScoreboard: [],
};

const DEFAULT_OPERATOR: UserProfileRecord = {
  uid: 'commander-mosavi-01',
  username: 'MOSAVI_PRO',
  email: 'commander@mosavi-cs.ir',
  level: 50,
  xp: 28500,
  rankTier: 'MOSAVI Legend',
  credits: 25000,
  wins: 142,
  losses: 29,
  kills: 2840,
  deaths: 1120,
  headshots: 1490,
  role: 'admin',
  isBanned: false,
  equippedSkinsJson: '{"ak47":"skin_ak_crimson","awp":"skin_awp_obsidian","knife":"skin_knife_karambit_ruby"}',
};

export default function App() {
  const isAutoStart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [lang, setLang] = useState<'fa' | 'en'>('fa');
  const [gameState, setGameState] = useState<GameShellState>(isAutoStart ? 'playing' : 'title');
  const [activeModal, setActiveModal] = useState<ActiveModalTab>(null);

  // Match Configuration
  const [mapId, setMapId] = useState<MapId>('mosavi_dust');
  const [gameMode, setGameMode] = useState<GameModeId>('tdm');
  const [playerTeam, setPlayerTeam] = useState<BotTeam>('vanguard');
  const [botCount, setBotCount] = useState<number>(6);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('Normal');

  // Graphics & Mobile Settings
  const [graphics, setGraphics] = useState<GraphicsSettings>({
    preset: 'High',
    fov: 78,
    sensitivity: 1.0,
    volume: 0.75,
    bloodEnabled: true,
    fpsLimit: 120,
  });

  const [mobileConfig, setMobileConfig] = useState<MobileHudCustomization>({
    enabled: typeof window !== 'undefined' && window.innerWidth < 820,
    buttonScale: 1.0,
    fireOffsetX: 0,
    fireOffsetY: 0,
    joystickOffsetX: 0,
    joystickOffsetY: 0,
  });

  // Live HUD & Overlays
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [showBuyMenu, setShowBuyMenu] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const controlBridgeRef = useRef<ExternalControlBridge | null>(null);

  // Match End Summary Snapshot
  const [matchResult, setMatchResult] = useState<{
    wonMatch: boolean;
    winnerTeam: BotTeam;
    vanguardScore: number;
    phantomScore: number;
    kills: number;
    deaths: number;
    headshots: number;
    xpEarned: number;
    creditsEarned: number;
  } | null>(null);

  // User, Inventory, Leaderboard, Announcements & Admin Data
  const [user, setUser] = useState<UserProfileRecord>(DEFAULT_OPERATOR);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchRecord[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [storeNotice, setStoreNotice] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<UserProfileRecord[]>([]);
  const [announcements, setAnnouncements] = useState<
    { id: number; title: string; content: string; authorName: string }[]
  >([]);
  const [adminData, setAdminData] = useState<{
    users: UserProfileRecord[];
    matches: MatchRecord[];
    abuseReports: { id: number; reporterUid: string; suspectName: string; reason: string; status: string }[];
    securityLogs: { id: number; eventType: string; actorUid: string; details: string; severity: string }[];
    serverConfig?: { tickRate: number; antiCheatStrictMode: boolean; activeRoomsCount: number };
  } | null>(null);

  // WebSocket Multiplayer State
  const wsRef = useRef<WebSocket | null>(null);
  const [publicRooms, setPublicRooms] = useState<RoomDto[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomDto | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<
    { uid: string; username: string; team: BotTeam; x: number; y: number; z: number; yaw: number }[]
  >([]);

  let equippedSkins: Record<string, string> = {};
  try {
    equippedSkins = JSON.parse(user.equippedSkinsJson || '{}');
  } catch {
    equippedSkins = {};
  }

  // Sync game state to document.body.dataset.state & HTML dir
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  useEffect(() => {
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const apiUrl = (path: string) => `${API_BASE}${path}`;

  // Initial fetch of operator profile & global leaderboard from PostgreSQL
  const fetchInitialData = async (uidToLoad = user.uid) => {
    try {
      const [profRes, lbRes] = await Promise.all([
        fetch(apiUrl(`/api/profile/${encodeURIComponent(uidToLoad)}`)),
        fetch(apiUrl('/api/leaderboard')),
      ]);
      if (profRes.ok) {
        const data = await profRes.json();
        if (data.user) setUser(data.user);
        if (data.inventory) setInventory(data.inventory);
        if (data.recentMatches) setRecentMatches(data.recentMatches);
      }
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        if (lbData.leaderboard) setLeaderboard(lbData.leaderboard);
        if (lbData.announcements) setAnnouncements(lbData.announcements);
      }
    } catch (err) {
      console.error('Error loading initial server data:', err);
    }
  };

  useEffect(() => {
    fetchInitialData(DEFAULT_OPERATOR.uid);
  }, []);

  // Connect to Real-Time WebSocket Server (/ws)
  useEffect(() => {
    let reconnectTimer: number | undefined;
    let isUnmounted = false;

    const connectWs = () => {
      if (isUnmounted) return;
      const customWsUrl = import.meta.env.VITE_WS_SERVER_URL;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = customWsUrl || `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'auth:identify',
            uid: user.uid,
            username: user.username,
          })
        );
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg.type === 'rooms:list' && Array.isArray(msg.rooms)) {
            setPublicRooms(msg.rooms);
          } else if (msg.type === 'room:joined' || msg.type === 'room:updated') {
            setCurrentRoom(msg.room);
            if (msg.room.mapId) setMapId(msg.room.mapId);
            if (msg.room.gameMode) setGameMode(msg.room.gameMode);
            if (typeof msg.room.botCount === 'number') setBotCount(msg.room.botCount);
            if (msg.room.botDifficulty) setBotDifficulty(msg.room.botDifficulty);
          } else if (msg.type === 'match:started') {
            setCurrentRoom(msg.room);
            setActiveModal(null);
            startGameplayNow();
          } else if (msg.type === 'player:moved') {
            setRemotePlayers((prev) => {
              const filtered = prev.filter((p) => p.uid !== msg.uid);
              return [
                ...filtered,
                {
                  uid: msg.uid,
                  username: msg.username,
                  team: msg.team,
                  x: msg.x,
                  y: msg.y,
                  z: msg.z,
                  yaw: msg.yaw,
                },
              ];
            });
          }
        } catch {
          // ignore malformed packet
        }
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          reconnectTimer = window.setTimeout(connectWs, 3500);
        }
      };
    };

    connectWs();
    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [user.uid, user.username]);

  const startGameplayNow = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setActiveModal(null);
    setShowBuyMenu(false);
    setShowScoreboard(false);
    setMatchResult(null);
    document.body.dataset.state = 'playing';
    setGameState('playing');
  };

  // Title-to-Start keyboard handshake (Enter / Space while on 'title' with no modal open)
  useEffect(() => {
    const onTitleKey = (e: KeyboardEvent) => {
      if (gameState !== 'title' || activeModal !== null) return;
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        startGameplayNow();
      }
    };
    window.addEventListener('keydown', onTitleKey);
    return () => window.removeEventListener('keydown', onTitleKey);
  }, [gameState, activeModal]);

  // Handlers for Auth, Store, Admin & Lobby
  const handleRegisterAccount = async (username: string, email: string, password: string) => {
    setAuthError(null);
    const res = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Registration failed');
      return;
    }
    if (data.user) setUser(data.user);
    if (data.inventory) setInventory(data.inventory);
    if (data.recentMatches) setRecentMatches(data.recentMatches);
    setIsAuthenticated(true);
    fetchInitialData(data.user.uid);
  };

  const handleLoginAccount = async (identifier: string, password: string) => {
    setAuthError(null);
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Login failed');
      return;
    }
    if (data.user) setUser(data.user);
    if (data.inventory) setInventory(data.inventory);
    if (data.recentMatches) setRecentMatches(data.recentMatches);
    setIsAuthenticated(true);
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      const res = await fetch(apiUrl('/api/auth/firebase-sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: cred.user.displayName }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        setInventory(data.inventory || []);
        setRecentMatches(data.recentMatches || []);
        setIsAuthenticated(true);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Google Sign-In cancelled');
    }
  };

  const handlePurchaseItem = async (itemId: string) => {
    setStoreNotice(null);
    const res = await fetch(apiUrl('/api/store/purchase'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, itemId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStoreNotice(data.error || 'Purchase failed');
      return;
    }
    if (data.user) setUser(data.user);
    if (data.inventory) setInventory(data.inventory);
    setStoreNotice(
      lang === 'fa'
        ? 'آیتم با موفقیت خریداری و روی سلاح شما تجهیز شد!'
        : 'Item purchased and equipped to your loadout!'
    );
  };

  const handleEquipItem = async (itemId: string) => {
    const res = await fetch(apiUrl('/api/store/equip'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, itemId }),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setUser(data.user);
      setStoreNotice(lang === 'fa' ? 'تجهیزات شما بروزرسانی شد.' : 'Loadout updated.');
    }
  };

  const handleRefreshAdmin = async () => {
    const res = await fetch(apiUrl('/api/admin/overview'));
    if (res.ok) {
      const data = await res.json();
      setAdminData(data);
    }
  };

  const handleMatchFinished = async (summary: {
    wonMatch: boolean;
    winnerTeam: BotTeam;
    vanguardScore: number;
    phantomScore: number;
    kills: number;
    deaths: number;
    headshots: number;
    bombObjectives: number;
    durationSeconds: number;
  }) => {
    document.body.dataset.state = 'gameover';
    setGameState('gameover');

    try {
      const res = await fetch(apiUrl('/api/matches/record'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          roomCode: currentRoom?.code || 'SOLO-BOTS',
          mapId,
          gameMode,
          ...summary,
        }),
      });
      const data = await res.json();
      if (data.user) setUser(data.user);
      setMatchResult({
        ...summary,
        xpEarned: data.xpEarned || 250,
        creditsEarned: data.creditsEarned || 400,
      });
      fetchInitialData(user.uid);
    } catch {
      setMatchResult({
        ...summary,
        xpEarned: 250,
        creditsEarned: 400,
      });
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#090a0f] select-none">
      {/* 1. Persistent 3D WebGL Tactical Arena (Mounted once, never unmounted by UI state) */}
      <TacticalArena3D
        gameState={gameState}
        mapId={mapId}
        gameMode={gameMode}
        playerTeam={playerTeam}
        botCount={botCount}
        botDifficulty={botDifficulty}
        graphics={graphics}
        equippedSkins={equippedSkins}
        onHudUpdate={setHud}
        onPauseRequest={() => {
          document.body.dataset.state = 'paused';
          setGameState('paused');
        }}
        onToggleBuyMenu={() => setShowBuyMenu((prev) => !prev)}
        onScoreboardHold={setShowScoreboard}
        onMatchFinished={handleMatchFinished}
        controlBridgeRef={controlBridgeRef}
        onNetworkStateEmit={(st) => {
          if (currentRoom && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'player:state', ...st }));
          }
        }}
        remotePlayers={remotePlayers}
      />

      {/* 2. PLAYING STATE: World-Matched Tactical HUD Overlay */}
      {gameState === 'playing' && (
        <TacticalHudOverlay
          lang={lang}
          hud={hud}
          mapId={mapId}
          gameMode={gameMode}
          showBuyMenu={showBuyMenu}
          onCloseBuyMenu={() => setShowBuyMenu(false)}
          onToggleBuyMenu={() => setShowBuyMenu((p) => !p)}
          showScoreboard={showScoreboard}
          onPauseRequest={() => {
            document.body.dataset.state = 'paused';
            setGameState('paused');
          }}
          controlBridgeRef={controlBridgeRef}
          mobileConfig={mobileConfig}
          onUpdateMobileConfig={setMobileConfig}
        />
      )}

      {/* 3. TITLE SCREEN STATE: Asymmetric Negative-Space Command Center over Live 3D Tour */}
      {gameState === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none bg-gradient-to-r from-black/88 via-black/45 to-transparent">
          {/* Top Bar: Operator Status & Language Switcher */}
          <div className="flex items-center justify-between gap-4 pointer-events-auto">
            {/* Custom Inline SVG Title Lockup & Crest Emblem */}
            <div className="flex items-center gap-3.5">
              <svg width="46" height="46" viewBox="0 0 48 48" className="shrink-0">
                <polygon
                  points="24,2 44,12 44,36 24,46 4,36 4,12"
                  fill="#090a0f"
                  stroke="#dc2626"
                  strokeWidth="2.5"
                />
                <polygon
                  points="24,8 38,15 38,33 24,40 10,33 10,15"
                  fill="#18181b"
                  stroke="#3f3f46"
                  strokeWidth="1"
                />
                <path
                  d="M15 30L24 14L33 30H28L24 22L20 30H15Z"
                  fill="#ef4444"
                />
                <circle cx="24" cy="28" r="2.2" fill="#f8fafc" />
              </svg>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-wider text-white leading-none">
                  MOSAVI CS
                </h1>
                <p className="text-xs font-mono text-zinc-400 mt-1">
                  {lang === 'fa'
                    ? 'شوتر تاکتیکی سه‌بعدی رقابتی · نسخه PC و Android'
                    : 'TACTICAL 3D COMPETITIVE FPS · PC & ANDROID'}
                </p>
              </div>
            </div>

            {/* Right Operator Identity & Language Switch */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setActiveModal('profile')}
                className="px-3.5 py-2 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-xs flex items-center gap-3 cursor-pointer"
              >
                <span className="font-bold text-white">{user.username}</span>
                <span className="text-zinc-500">·</span>
                <span className="font-mono text-red-400">{user.rankTier}</span>
                <span className="text-zinc-500">·</span>
                <span className="font-mono text-amber-400 tabular-nums">{user.credits} CR</span>
              </button>

              <button
                type="button"
                onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
                aria-label="Switch Language FA/EN"
                className="px-3 py-2 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 cursor-pointer"
              >
                {lang === 'fa' ? 'EN / فارسی' : 'فارسی / EN'}
              </button>
            </div>
          </div>

          {/* Center-Side Command Column (Leaves 60%+ of the 3D Arena Tour unobstructed) */}
          <div className="my-auto max-w-md w-full space-y-5 pointer-events-auto">
            {/* Active Map & Mode Quick Selector */}
            <div className="p-4 bg-zinc-950/92 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{lang === 'fa' ? 'نقشه و عملیات فعال:' : 'ACTIVE DEPLOYMENT:'}</span>
                <span className="font-mono text-red-400">{MAPS[mapId].name}</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(['mosavi_dust', 'mosavi_city', 'mosavi_base'] as const).map((mKey) => (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => setMapId(mKey)}
                    className={`py-1.5 px-2 text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                      mapId === mKey
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {MAPS[mKey].name.replace('MOSAVI ', '')}
                  </button>
                ))}
              </div>

              {/* Primary Start CTA with data-start="true" */}
              <button
                type="button"
                data-start="true"
                onClick={startGameplayNow}
                className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-500 text-white font-bold text-base tracking-wide shadow-lg cursor-pointer transition-transform active:scale-[0.99]"
              >
                {lang === 'fa' ? 'شروع عملیات (PLAY NOW)' : 'PLAY TACTICAL MATCH'}
              </button>
            </div>

            {/* Complete 10-Item Operational Command Menu */}
            <nav
              aria-label="MOSAVI CS Main Menu"
              className="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                onClick={() => {
                  setGameMode('multiplayer');
                  setActiveModal('lobby');
                }}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white">
                  {lang === 'fa' ? 'لابی و آنلاین (Multiplayer)' : 'Multiplayer Lobby'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? 'اتاق‌ها، کد اختصاصی و چت' : 'Rooms, Matchmaking & Chat'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setGameMode('bots');
                  setBotCount(6);
                  startGameplayNow();
                }}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white">
                  {lang === 'fa' ? 'بازی با بات‌ها (Play With Bots)' : 'Play With Smart Bots'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? `هوش مصنوعی (${botDifficulty})` : `AI Pathfinding (${botDifficulty})`}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setGameMode('practice');
                  setBotCount(4);
                  startGameplayNow();
                }}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white">
                  {lang === 'fa' ? 'میدان تمرین (Practice)' : 'Practice Range'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? 'تست ۱۲ سلاح و نارنجک‌ها' : 'Test 12 Weapons & Recoil'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('store')}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white">
                  {lang === 'fa' ? 'فروشگاه (Store)' : 'Tactical Store'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? 'اسکین سلاح، کارامبیت و دستکش' : 'Skins, Karambit & Gloves'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('inventory')}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white">
                  {lang === 'fa' ? 'انبار تجهیزات (Inventory)' : 'Inventory & Loadout'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? 'شخصی‌سازی سلاح‌های فعال' : 'Equip Owned Skins'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('leaderboard')}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white">
                  {lang === 'fa' ? 'جدول رتبه‌بندی (Leaderboard)' : 'Global Leaderboard'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? '۸ سطح رنک تا MOSAVI Legend' : 'Ranks & Global Standings'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('profile')}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white">
                  {lang === 'fa' ? 'پروفایل و ثبت‌نام (Profile)' : 'Operator Profile'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? 'آمار K/D، سابقه و حساب کاربری' : 'Account, K/D & History'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('settings')}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white">
                  {lang === 'fa' ? 'تنظیمات و APK اندروید (Settings)' : 'Settings & Android APK'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? 'گرافیک، کنترل لمسی و دانلود APK' : 'Graphics, Touch HUD & APK'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleRefreshAdmin();
                  setActiveModal('admin');
                }}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-red-400">
                  {lang === 'fa' ? 'پنل مدیریت (Admin Panel)' : 'HQ Admin Panel'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? 'مدیریت کاربران، امنیت و سرور' : 'Users, Security & Anti-Cheat'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (document.fullscreenElement) {
                    document.exitFullscreen?.().catch(() => {});
                  } else {
                    document.documentElement.requestFullscreen?.().catch(() => {});
                  }
                }}
                className="p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-zinc-200">
                  {lang === 'fa' ? 'تمام‌صفحه / خروج (Fullscreen / Exit)' : 'Fullscreen / Reset Session'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {lang === 'fa' ? 'تغییر حالت نمایش بازی' : 'Toggle Display Mode'}
                </div>
              </button>
            </nav>

            {/* Latest HQ Announcement Strip */}
            {announcements.length > 0 && (
              <div className="p-3 bg-zinc-950/85 border border-zinc-800 text-xs">
                <span className="font-mono text-red-400 font-bold mr-2">
                  [{announcements[0].authorName}]
                </span>
                <span className="font-semibold text-white">{announcements[0].title}: </span>
                <span className="text-zinc-400">{announcements[0].content}</span>
              </div>
            )}
          </div>

          {/* Flat Borderless Bottom Control Hint Bar */}
          <div className="text-xs font-mono text-zinc-200 drop-shadow">
            WASD Move · Mouse Aim & Shoot · Right-Click Scope · R Reload · 1-5 Weapons · B Buy Armory · E Plant/Defuse C4 · Tab Scoreboard · Esc Pause
          </div>
        </div>
      )}

      {/* 4. PAUSED STATE: Single Focused Pause Modal Card */}
      {gameState === 'paused' && (
        <div
          className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5">
            <div className="border-b border-zinc-800 pb-3">
              <div className="text-xs font-mono text-red-400 uppercase">MOSAVI CS · TACTICAL PAUSE</div>
              <h2 className="text-xl font-bold text-white mt-0.5">
                {lang === 'fa' ? 'توقف موقت عملیات' : 'Mission Paused'}
              </h2>
            </div>

            {/* 3 Tabular Stat Tiles */}
            <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums text-center">
              <div className="p-3 bg-zinc-900 border border-zinc-800">
                <div className="text-[10px] text-zinc-400">SCORE</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {hud.vanguardScore} - {hud.phantomScore}
                </div>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800">
                <div className="text-[10px] text-zinc-400">KILLS / DEATHS</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  {hud.playerKills} / {hud.playerDeaths}
                </div>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800">
                <div className="text-[10px] text-zinc-400">FUNDS</div>
                <div className="text-base font-bold text-amber-400 mt-0.5">${hud.cash}</div>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  document.body.dataset.state = 'playing';
                  setGameState('playing');
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm cursor-pointer"
              >
                {lang === 'fa' ? 'ادامه بازی (Resume)' : 'RESUME MATCH'}
              </button>

              <button
                type="button"
                onClick={() => {
                  controlBridgeRef.current?.resetMatch();
                  document.body.dataset.state = 'playing';
                  setGameState('playing');
                }}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-bold cursor-pointer"
              >
                {lang === 'fa' ? 'شروع مجدد مسابقه (Restart)' : 'RESTART MATCH'}
              </button>

              <button
                type="button"
                onClick={() => {
                  document.body.dataset.state = 'title';
                  setGameState('title');
                }}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'fa' ? 'بازگشت به منوی اصلی (Title Screen)' : 'RETURN TO MAIN MENU'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. GAMEOVER / VICTORY STATE: Single Focused Match Summary Modal Card */}
      {gameState === 'gameover' && (
        <div
          className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5">
            <div className="border-b border-zinc-800 pb-3">
              <div className="text-xs font-mono text-red-400 uppercase">
                {MAPS[mapId].name} · {GAME_MODES[gameMode].nameEn}
              </div>
              <h2 className="text-2xl font-bold text-white mt-0.5">
                {matchResult?.wonMatch
                  ? lang === 'fa'
                    ? 'پیروزی در عملیات! (VICTORY)'
                    : 'TACTICAL VICTORY'
                  : lang === 'fa'
                  ? 'پایان عملیات (MATCH COMPLETE)'
                  : 'MATCH COMPLETE'}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums text-center">
              <div className="p-3 bg-zinc-900 border border-zinc-800">
                <div className="text-[10px] text-zinc-400">FINAL SCORE</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {matchResult?.vanguardScore ?? hud.vanguardScore} -{' '}
                  {matchResult?.phantomScore ?? hud.phantomScore}
                </div>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800">
                <div className="text-[10px] text-zinc-400">KILLS / HS</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  {matchResult?.kills ?? hud.playerKills} / {matchResult?.headshots ?? hud.playerHeadshots}
                </div>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800">
                <div className="text-[10px] text-zinc-400">REWARD</div>
                <div className="text-base font-bold text-amber-400 mt-0.5">
                  +{matchResult?.xpEarned ?? 250} XP
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  controlBridgeRef.current?.resetMatch();
                  startGameplayNow();
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm cursor-pointer"
              >
                {lang === 'fa' ? 'مسابقه مجدد (Play Again)' : 'PLAY AGAIN'}
              </button>

              <button
                type="button"
                onClick={() => {
                  document.body.dataset.state = 'title';
                  setGameState('title');
                }}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                {lang === 'fa' ? 'بازگشت به لابی اصلی' : 'RETURN TO COMMAND MENU'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Command Modals (Lobby, Store, Inventory, Profile, Leaderboard, Settings, Admin) */}
      <CommandModals
        lang={lang}
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        mapId={mapId}
        setMapId={setMapId}
        gameMode={gameMode}
        setGameMode={setGameMode}
        playerTeam={playerTeam}
        setPlayerTeam={setPlayerTeam}
        botCount={botCount}
        setBotCount={setBotCount}
        botDifficulty={botDifficulty}
        setBotDifficulty={setBotDifficulty}
        publicRooms={publicRooms}
        currentRoom={currentRoom}
        onCreateRoom={(name, isPrivate) => {
          wsRef.current?.send(
            JSON.stringify({
              type: 'room:create',
              name,
              isPrivate,
              mapId,
              gameMode,
              botCount,
              botDifficulty,
            })
          );
        }}
        onJoinRoomCode={(code) => {
          wsRef.current?.send(JSON.stringify({ type: 'room:join', code }));
        }}
        onLeaveRoom={() => {
          wsRef.current?.send(JSON.stringify({ type: 'room:leave' }));
          setCurrentRoom(null);
        }}
        onSendLobbyChat={(text) => {
          wsRef.current?.send(JSON.stringify({ type: 'room:chat', text }));
        }}
        onToggleReady={(ready) => {
          wsRef.current?.send(JSON.stringify({ type: 'room:ready', ready }));
        }}
        onStartMatchFromLobby={() => {
          if (currentRoom && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'room:start' }));
          } else {
            startGameplayNow();
          }
        }}
        user={user}
        inventory={inventory}
        recentMatches={recentMatches}
        isAuthenticated={isAuthenticated}
        authError={authError}
        onRegisterAccount={handleRegisterAccount}
        onLoginAccount={handleLoginAccount}
        onGoogleLogin={handleGoogleLogin}
        onLogout={() => {
          signOut(auth).catch(() => {});
          setIsAuthenticated(false);
        }}
        storeNotice={storeNotice}
        onPurchaseItem={handlePurchaseItem}
        onEquipItem={handleEquipItem}
        equippedSkins={equippedSkins}
        leaderboard={leaderboard}
        announcements={announcements}
        adminData={adminData}
        onRefreshAdmin={handleRefreshAdmin}
        onToggleBanUser={async (targetUid, isBanned) => {
          await fetch(apiUrl('/api/admin/ban'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUid, isBanned, adminUid: user.uid }),
          });
          await handleRefreshAdmin();
        }}
        onPublishAnnouncement={async (title, content) => {
          await fetch(apiUrl('/api/admin/announcement'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, authorName: user.username }),
          });
          await handleRefreshAdmin();
          fetchInitialData(user.uid);
        }}
        onResolveReport={async (id, status) => {
          await fetch(apiUrl('/api/admin/report-status'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
          });
          await handleRefreshAdmin();
        }}
        onUpdateServerConfig={async (tickRate, antiCheat) => {
          await fetch(apiUrl('/api/admin/server-config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickRate, antiCheat }),
          });
          await handleRefreshAdmin();
        }}
        graphics={graphics}
        setGraphics={setGraphics}
        mobileConfig={mobileConfig}
        setMobileConfig={setMobileConfig}
      />
    </main>
  );
}
