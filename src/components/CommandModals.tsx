import React, { useState } from 'react';
import { MAPS, MAP_LIST, MapId } from '../game/maps.ts';
import {
  BotDifficulty,
  GAME_MODES,
  GameModeId,
  RANK_THRESHOLDS,
  calculateKDRatio,
} from '../game/rules.ts';
import { STORE_CATALOG } from '../game/weapons.ts';
import { BotTeam } from '../game/botAI.ts';
import { GraphicsSettings } from './TacticalArena3D.tsx';
import { MobileHudCustomization } from './TacticalHudOverlay.tsx';

export interface UserProfileRecord {
  uid: string;
  username: string;
  email: string;
  level: number;
  xp: number;
  rankTier: string;
  credits: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  headshots: number;
  role: string;
  isBanned: boolean;
  equippedSkinsJson: string;
}

export interface InventoryRecord {
  id: number;
  itemId: string;
  itemName: string;
  category: string;
  weaponId: string;
  equipped: boolean;
}

export interface MatchRecord {
  id: number;
  roomCode: string;
  mapId: string;
  gameMode: string;
  winnerTeam: string;
  vanguardScore: number;
  phantomScore: number;
  playerKills: number;
  playerDeaths: number;
  xpEarned: number;
  creditsEarned: number;
  createdAt: string;
}

export interface RoomDto {
  code: string;
  name: string;
  hostUid: string;
  isPrivate: boolean;
  mapId: MapId;
  gameMode: GameModeId;
  maxPlayers: number;
  botCount: number;
  botDifficulty: BotDifficulty;
  status: 'waiting' | 'in_progress';
  vanguardScore: number;
  phantomScore: number;
  players: {
    uid: string;
    username: string;
    team: BotTeam;
    ready: boolean;
    isHost: boolean;
  }[];
  chat: { id: string; sender: string; text: string; time: string }[];
}

export type ActiveModalTab =
  | null
  | 'lobby'
  | 'store'
  | 'inventory'
  | 'profile'
  | 'leaderboard'
  | 'settings'
  | 'admin';

interface CommandModalsProps {
  lang: 'fa' | 'en';
  activeModal: ActiveModalTab;
  onClose: () => void;
  // Game & Lobby props
  mapId: MapId;
  setMapId: (m: MapId) => void;
  gameMode: GameModeId;
  setGameMode: (g: GameModeId) => void;
  playerTeam: BotTeam;
  setPlayerTeam: (t: BotTeam) => void;
  botCount: number;
  setBotCount: (n: number) => void;
  botDifficulty: BotDifficulty;
  setBotDifficulty: (d: BotDifficulty) => void;
  publicRooms: RoomDto[];
  currentRoom: RoomDto | null;
  onCreateRoom: (name: string, isPrivate: boolean) => void;
  onJoinRoomCode: (code: string) => void;
  onLeaveRoom: () => void;
  onSendLobbyChat: (text: string) => void;
  onToggleReady: (ready: boolean) => void;
  onStartMatchFromLobby: () => void;
  // User & Auth props
  user: UserProfileRecord;
  inventory: InventoryRecord[];
  recentMatches: MatchRecord[];
  isAuthenticated: boolean;
  authError: string | null;
  onRegisterAccount: (username: string, email: string, password: string) => Promise<void>;
  onLoginAccount: (identifier: string, password: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onLogout: () => void;
  // Store props
  storeNotice: string | null;
  onPurchaseItem: (itemId: string) => Promise<void>;
  onEquipItem: (itemId: string) => Promise<void>;
  equippedSkins: Record<string, string>;
  // Leaderboard & Admin props
  leaderboard: UserProfileRecord[];
  announcements: { id: number; title: string; content: string; authorName: string }[];
  adminData: {
    users: UserProfileRecord[];
    matches: MatchRecord[];
    abuseReports: { id: number; reporterUid: string; suspectName: string; reason: string; status: string }[];
    securityLogs: { id: number; eventType: string; actorUid: string; details: string; severity: string }[];
    serverConfig?: { tickRate: number; antiCheatStrictMode: boolean; activeRoomsCount: number };
  } | null;
  onRefreshAdmin: () => Promise<void>;
  onToggleBanUser: (targetUid: string, isBanned: boolean) => Promise<void>;
  onPublishAnnouncement: (title: string, content: string) => Promise<void>;
  onResolveReport: (id: number, status: string) => Promise<void>;
  onUpdateServerConfig: (tickRate: number, antiCheat: boolean) => Promise<void>;
  // Settings & Mobile props
  graphics: GraphicsSettings;
  setGraphics: (g: GraphicsSettings) => void;
  mobileConfig: MobileHudCustomization;
  setMobileConfig: (m: MobileHudCustomization) => void;
}

export const CommandModals: React.FC<CommandModalsProps> = (props) => {
  const { lang, activeModal, onClose } = props;

  // Lobby local form state
  const [newRoomName, setNewRoomName] = useState('MOSAVI Tactical Squad');
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [chatInput, setChatInput] = useState('');

  // Auth local form state
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('register');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRulesAccepted, setRegRulesAccepted] = useState(true);
  const [loginIdent, setLoginIdent] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [localAuthMsg, setLocalAuthMsg] = useState<string | null>(null);

  // Store filter state
  const [storeFilter, setStoreFilter] = useState<string>('all');

  // Leaderboard filter state
  const [lbTab, setLbTab] = useState<'global' | 'friends' | 'ranks'>('global');

  // Admin state
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');

  if (!activeModal) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-5xl bg-[#0d1017] border border-zinc-800 shadow-2xl overflow-hidden my-auto">
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="w-2 h-5 bg-red-600 inline-block" />
            <h2 className="text-lg font-bold tracking-tight text-white">
              {activeModal === 'lobby' && (lang === 'fa' ? 'لابی رسمی و مسابقات آنلاین (Multiplayer Lobby)' : 'Tactical Lobby & Matchmaking')}
              {activeModal === 'store' && (lang === 'fa' ? 'فروشگاه اختصاصی و اسکین‌های MOSAVI CS' : 'MOSAVI CS Tactical Store')}
              {activeModal === 'inventory' && (lang === 'fa' ? 'انبار تجهیزات و شخصی‌سازی سلاح (Inventory)' : 'Operator Loadout & Inventory')}
              {activeModal === 'profile' && (lang === 'fa' ? 'حساب کاربری، ثبت‌نام و آمار بازیکن' : 'Operator Profile & Authentication')}
              {activeModal === 'leaderboard' && (lang === 'fa' ? 'جدول رتبه‌بندی جهانی و سیستم رنکینگ' : 'Global Leaderboard & Rank Tiers')}
              {activeModal === 'settings' && (lang === 'fa' ? 'تنظیمات گرافیک، کنترل‌ها و دانلود نسخه اندروید (APK)' : 'Settings, Controls & Android APK Hub')}
              {activeModal === 'admin' && (lang === 'fa' ? 'پنل مدیریت فرماندهی و امنیت سرور' : 'MOSAVI HQ Admin Command Panel')}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Modal"
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-red-600 border border-zinc-700 text-xs font-mono text-zinc-200 hover:text-white transition-colors cursor-pointer"
          >
            {lang === 'fa' ? 'بستن [ESC]' : 'CLOSE [ESC]'}
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 max-h-[80vh] overflow-y-auto text-sm text-zinc-200">
          {/* 1. LOBBY & MULTIPLAYER */}
          {activeModal === 'lobby' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Room Browser or Active Room */}
              <div className="lg:col-span-7 space-y-5">
                {!props.currentRoom ? (
                  <>
                    {/* Create or Join Room Controls */}
                    <div className="p-4 bg-zinc-950 border border-zinc-800 space-y-4">
                      <h3 className="text-sm font-bold text-white">
                        {lang === 'fa' ? 'ساخت اتاق جدید یا ورود با کد اختصاصی' : 'Create Tactical Room or Join via Code'}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            {lang === 'fa' ? 'نام اتاق' : 'Room Name'}
                          </label>
                          <input
                            type="text"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer py-2">
                            <input
                              type="checkbox"
                              checked={isPrivateRoom}
                              onChange={(e) => setIsPrivateRoom(e.target.checked)}
                              className="accent-red-600"
                            />
                            {lang === 'fa' ? 'اتاق خصوصی (Private)' : 'Private Room'}
                          </label>
                          <button
                            type="button"
                            onClick={() => props.onCreateRoom(newRoomName, isPrivateRoom)}
                            className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                          >
                            {lang === 'fa' ? 'ساخت اتاق' : 'Create Room'}
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-900 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={lang === 'fa' ? 'کد اتاق (مثلاً DUST-01)' : 'Enter Room Code (e.g. DUST-01)'}
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value)}
                          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs font-mono text-white uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (joinCodeInput.trim()) props.onJoinRoomCode(joinCodeInput.trim());
                          }}
                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono cursor-pointer"
                        >
                          {lang === 'fa' ? 'ورود با کد' : 'Join by Code'}
                        </button>
                        <button
                          type="button"
                          onClick={() => props.onJoinRoomCode('DUST-01')}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                        >
                          {lang === 'fa' ? 'جستجوی سریع (Matchmaking)' : 'Quick Matchmaking'}
                        </button>
                      </div>
                    </div>

                    {/* Active Public Lobbies List */}
                    <div className="p-4 bg-zinc-950 border border-zinc-800">
                      <h3 className="text-sm font-bold text-white mb-3">
                        {lang === 'fa' ? 'اتاق‌های عمومی فعال در سرور WebSocket' : 'Active Public Multiplayer Lobbies'}
                      </h3>
                      <div className="space-y-2">
                        {props.publicRooms.map((rm) => (
                          <div
                            key={rm.code}
                            className="p-3 bg-zinc-900/80 border border-zinc-800 flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-red-400">[{rm.code}]</span>
                                <span className="font-semibold text-white">{rm.name}</span>
                              </div>
                              <div className="text-xs text-zinc-400 mt-0.5">
                                {MAPS[rm.mapId]?.name} · {GAME_MODES[rm.gameMode]?.nameEn} · Bots: {rm.botCount} ({rm.botDifficulty})
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono tabular-nums text-zinc-300">
                                {rm.players.length}/{rm.maxPlayers}
                              </span>
                              <button
                                type="button"
                                onClick={() => props.onJoinRoomCode(rm.code)}
                                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-xs font-bold text-white cursor-pointer"
                              >
                                {lang === 'fa' ? 'ورود به اتاق' : 'JOIN'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Active Joined Room Details + Chat */
                  <div className="p-4 bg-zinc-950 border border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div>
                        <span className="text-xs font-mono text-red-400">
                          {lang === 'fa' ? 'کد اختصاصی اتاق:' : 'ROOM CODE:'} {props.currentRoom.code}
                        </span>
                        <h3 className="text-base font-bold text-white">{props.currentRoom.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => props.onToggleReady(true)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
                        >
                          {lang === 'fa' ? 'آماده (READY)' : 'READY'}
                        </button>
                        <button
                          type="button"
                          onClick={props.onLeaveRoom}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer"
                        >
                          {lang === 'fa' ? 'خروج از اتاق' : 'Leave Room'}
                        </button>
                      </div>
                    </div>

                    {/* Players Present in Room */}
                    <div>
                      <div className="text-xs text-zinc-400 mb-2">
                        {lang === 'fa' ? 'بازیکنان حاضر در لابی:' : 'Operators in Lobby:'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {props.currentRoom.players.map((p) => (
                          <div
                            key={p.uid}
                            className="p-2.5 bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-white">{p.username}</span>
                            <div className="flex items-center gap-2 font-mono">
                              <span className={p.team === 'vanguard' ? 'text-sky-400' : 'text-red-400'}>
                                {p.team.toUpperCase()}
                              </span>
                              <span className="text-emerald-400">{p.ready ? 'READY' : 'WAIT'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Live Lobby Chat */}
                    <div className="border-t border-zinc-800 pt-3">
                      <div className="text-xs text-zinc-400 mb-2">
                        {lang === 'fa' ? 'چت آنلاین داخل لابی:' : 'Live Tactical Lobby Chat:'}
                      </div>
                      <div className="h-36 overflow-y-auto bg-zinc-900/90 border border-zinc-800 p-2.5 space-y-1.5 text-xs">
                        {props.currentRoom.chat.map((c) => (
                          <div key={c.id}>
                            <span className="font-mono text-zinc-500 mr-1.5">[{c.time}]</span>
                            <span className="font-bold text-red-400 mr-1.5">{c.sender}:</span>
                            <span className="text-zinc-200">{c.text}</span>
                          </div>
                        ))}
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!chatInput.trim()) return;
                          props.onSendLobbyChat(chatInput);
                          setChatInput('');
                        }}
                        className="mt-2 flex gap-2"
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder={lang === 'fa' ? 'پیام خود را بنویسید...' : 'Type tactical message...'}
                          className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs text-white"
                        />
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white cursor-pointer"
                        >
                          {lang === 'fa' ? 'ارسال' : 'Send'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>

              {/* Right 5 Cols: Match Configuration (Map, Mode, Team, Bots, Launch) */}
              <div className="lg:col-span-5 p-4 bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">
                    {lang === 'fa' ? 'تنظیمات نقشه، حالت بازی و بات‌ها' : 'Map, Mode & Bot AI Configuration'}
                  </h3>

                  {/* Map Selector */}
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {lang === 'fa' ? 'انتخاب نقشه اختصاصی سه‌بعدی:' : 'Select 3D Tactical Map:'}
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {MAP_LIST.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => props.setMapId(m.id)}
                          className={`p-2.5 border text-left transition-colors cursor-pointer ${
                            props.mapId === m.id
                              ? 'bg-red-950/40 border-red-500 text-white'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          <div className="font-bold text-xs">{lang === 'fa' ? m.nameFa : m.name}</div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            {lang === 'fa' ? m.subtitleFa : m.subtitleEn}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Game Mode Selector */}
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      {lang === 'fa' ? 'حالت بازی (Game Mode):' : 'Select Game Mode:'}
                    </label>
                    <select
                      value={props.gameMode}
                      onChange={(e) => props.setGameMode(e.target.value as GameModeId)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                    >
                      {Object.values(GAME_MODES).map((gm) => (
                        <option key={gm.id} value={gm.id}>
                          {lang === 'fa' ? gm.nameFa : gm.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Team & Bot Configuration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {lang === 'fa' ? 'انتخاب تیم:' : 'Select Squad:'}
                      </label>
                      <select
                        value={props.playerTeam}
                        onChange={(e) => props.setPlayerTeam(e.target.value as BotTeam)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      >
                        <option value="vanguard">VANGUARD (Defender / CT)</option>
                        <option value="phantom">PHANTOM (Attacker / T)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {lang === 'fa' ? 'درجه سختی بات‌ها:' : 'Bot AI Difficulty:'}
                      </label>
                      <select
                        value={props.botDifficulty}
                        onChange={(e) => props.setBotDifficulty(e.target.value as BotDifficulty)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      >
                        <option value="Easy">Easy (آسان)</option>
                        <option value="Normal">Normal (متوسط)</option>
                        <option value="Hard">Hard (سخت)</option>
                        <option value="Expert">Expert (حرفه‌ای)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      {lang === 'fa' ? `تعداد بات‌های هوشمند در نقشه: ${props.botCount}` : `Smart Bot Count: ${props.botCount}`}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={props.botCount}
                      onChange={(e) => props.setBotCount(Number(e.target.value))}
                      className="w-full accent-red-600"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  data-start="true"
                  onClick={props.onStartMatchFromLobby}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm tracking-wide cursor-pointer shadow-lg"
                >
                  {lang === 'fa' ? 'شروع مسابقه در نقشه انتخابی' : 'LAUNCH TACTICAL MATCH'}
                </button>
              </div>
            </div>
          )}

          {/* 2. STORE & INVENTORY */}
          {(activeModal === 'store' || activeModal === 'inventory') && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-950 border border-zinc-800 p-4">
                <div className="flex items-center gap-2">
                  {[
                    { id: 'all', labelEn: 'All Items', labelFa: 'همه آیتم‌ها' },
                    { id: 'weapon_skin', labelEn: 'Weapon Skins', labelFa: 'اسکین سلاح' },
                    { id: 'knife', labelEn: 'Knives', labelFa: 'چاقو' },
                    { id: 'gloves', labelEn: 'Gloves', labelFa: 'دستکش' },
                    { id: 'agent', labelEn: 'Operators', labelFa: 'لباس بازیکن' },
                    { id: 'card', labelEn: 'Profile Cards', labelFa: 'کارت پروفایل' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStoreFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                        storeFilter === tab.id
                          ? 'bg-red-600 text-white'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {lang === 'fa' ? tab.labelFa : tab.labelEn}
                    </button>
                  ))}
                </div>

                <div className="font-mono text-sm">
                  <span className="text-zinc-400 mr-2">
                    {lang === 'fa' ? 'موجودی حساب (Credits):' : 'OPERATOR CREDITS:'}
                  </span>
                  <span className="text-amber-400 font-bold tabular-nums">{props.user.credits} CR</span>
                </div>
              </div>

              {props.storeNotice && (
                <div className="p-3 bg-zinc-900 border border-amber-500/60 text-xs text-amber-300">
                  {props.storeNotice}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STORE_CATALOG.filter((item) =>
                  storeFilter === 'all' ? true : item.category === storeFilter
                ).map((item) => {
                  const owned = props.inventory.some((inv) => inv.itemId === item.id);
                  const slotKey = item.weaponId || item.category;
                  const isEquipped = props.equippedSkins[slotKey] === item.id;

                  return (
                    <div
                      key={item.id}
                      className="bg-zinc-950 border border-zinc-800 p-4 flex flex-col justify-between"
                    >
                      <div>
                        {/* Procedural SVG Skin Preview Swatch */}
                        <div className="h-24 w-full bg-zinc-900 border border-zinc-800 mb-3 flex items-center justify-center relative overflow-hidden">
                          <div
                            className="w-24 h-8 -rotate-12 shadow-lg"
                            style={{
                              backgroundColor: item.primaryHex,
                              border: `2px solid ${item.accentHex}`,
                            }}
                          />
                          <span className="absolute top-2 right-2 text-[10px] font-mono text-zinc-400">
                            {item.rarity}
                          </span>
                        </div>

                        <div className="font-bold text-white text-sm">
                          {lang === 'fa' ? item.nameFa : item.name}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          {lang === 'fa' ? item.descFa : item.descEn}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">
                          {owned ? (lang === 'fa' ? 'در انبار شما' : 'OWNED') : `${item.price} CR`}
                        </span>

                        {owned ? (
                          <button
                            type="button"
                            onClick={() => props.onEquipItem(item.id)}
                            className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                              isEquipped
                                ? 'bg-emerald-700 text-white'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                            }`}
                          >
                            {isEquipped
                              ? lang === 'fa'
                                ? 'مجهز شده'
                                : 'EQUIPPED'
                              : lang === 'fa'
                              ? 'استفاده در بازی'
                              : 'EQUIP'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => props.onPurchaseItem(item.id)}
                            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                          >
                            {lang === 'fa' ? 'خرید و تجهیز' : 'BUY ITEM'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. PROFILE & AUTHENTICATION */}
          {activeModal === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 6 Cols: Operator Stats & Match History */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-5 bg-zinc-950 border border-zinc-800">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                    <div>
                      <span className="text-xs font-mono text-red-400 uppercase">
                        {props.user.rankTier} · LEVEL {props.user.level}
                      </span>
                      <h3 className="text-xl font-bold text-white mt-0.5">{props.user.username}</h3>
                      <p className="text-xs text-zinc-400">{props.user.email}</p>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs text-zinc-400">TOTAL XP</div>
                      <div className="text-xl font-bold text-amber-400 tabular-nums">{props.user.xp}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 font-mono tabular-nums">
                    <div className="p-3 bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">WINS / LOSSES</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        {props.user.wins} / {props.user.losses}
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">KILLS / DEATHS</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        {props.user.kills} / {props.user.deaths}
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">K/D RATIO</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">
                        {calculateKDRatio(props.user.kills, props.user.deaths)}
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">HEADSHOTS</div>
                      <div className="text-base font-bold text-red-400 mt-0.5">{props.user.headshots}</div>
                    </div>
                  </div>
                </div>

                {/* Match History */}
                <div className="p-4 bg-zinc-950 border border-zinc-800">
                  <h4 className="text-sm font-bold text-white mb-3">
                    {lang === 'fa' ? 'سابقه مسابقات اخیر در دیتابیس PostgreSQL' : 'Recent Match History (PostgreSQL)'}
                  </h4>
                  {props.recentMatches.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      {lang === 'fa'
                        ? 'هنوز مسابقه‌ای برای این حساب ثبت نشده است. وارد بازی شوید تا امتیاز شما ثبت گردد.'
                        : 'No completed matches recorded yet.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {props.recentMatches.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs font-mono tabular-nums"
                        >
                          <div>
                            <span className="text-white font-bold">{m.mapId.toUpperCase()}</span>
                            <span className="text-zinc-400 ml-2">({m.gameMode.toUpperCase()})</span>
                          </div>
                          <div>
                            K/D: {m.playerKills}/{m.playerDeaths} · +{m.xpEarned} XP
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right 5 Cols: Registration / Login / Google OAuth */}
              <div className="lg:col-span-5 p-5 bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setLocalAuthMsg(null);
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold cursor-pointer ${
                      authMode === 'register' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {lang === 'fa' ? 'ثبت‌نام حساب جدید' : 'Register'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setLocalAuthMsg(null);
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold cursor-pointer ${
                      authMode === 'login' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {lang === 'fa' ? 'ورود به حساب' : 'Login'}
                  </button>
                </div>

                {(props.authError || localAuthMsg) && (
                  <div className="p-2.5 bg-red-950/60 border border-red-500/60 text-xs text-red-200">
                    {localAuthMsg || props.authError}
                  </div>
                )}

                {authMode === 'register' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setLocalAuthMsg(null);
                      if (!regUsername.trim() || !regEmail.trim() || !regPassword) {
                        setLocalAuthMsg(
                          lang === 'fa' ? 'لطفاً تمام فیلدها را تکمیل کنید.' : 'Please fill in all fields.'
                        );
                        return;
                      }
                      if (regPassword !== regConfirm) {
                        setLocalAuthMsg(
                          lang === 'fa' ? 'رمز عبور و تکرار آن مطابقت ندارند.' : 'Passwords do not match.'
                        );
                        return;
                      }
                      if (!regRulesAccepted) {
                        setLocalAuthMsg(
                          lang === 'fa' ? 'تأیید قوانین بازی الزامی است.' : 'Please accept the rules.'
                        );
                        return;
                      }
                      await props.onRegisterAccount(regUsername, regEmail, regPassword);
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {lang === 'fa' ? 'نام کاربری یکتا (Username)' : 'Unique Username'}
                      </label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {lang === 'fa' ? 'ایمیل (Email)' : 'Email Address'}
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {lang === 'fa' ? 'رمز عبور (حداقل ۶ کاراکتر)' : 'Password (min 6 chars)'}
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {lang === 'fa' ? 'تکرار رمز عبور' : 'Confirm Password'}
                      </label>
                      <input
                        type="password"
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={regRulesAccepted}
                        onChange={(e) => setRegRulesAccepted(e.target.checked)}
                        className="accent-red-600"
                      />
                      {lang === 'fa'
                        ? 'قوانین مسابقات جوانمردانه و ضدتقلب MOSAVI CS را می‌پذیرم'
                        : 'I accept the MOSAVI CS Fair-Play & Anti-Cheat Rules'}
                    </label>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                    >
                      {lang === 'fa' ? 'ثبت‌نام و ذخیره در دیتابیس' : 'Create Operator Account'}
                    </button>
                  </form>
                )}

                {authMode === 'login' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setLocalAuthMsg(null);
                      if (!loginIdent.trim() || !loginPass) {
                        setLocalAuthMsg(
                          lang === 'fa'
                            ? 'نام کاربری/ایمیل و رمز عبور را وارد کنید.'
                            : 'Enter username/email and password.'
                        );
                        return;
                      }
                      await props.onLoginAccount(loginIdent, loginPass);
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {lang === 'fa' ? 'نام کاربری یا ایمیل' : 'Username or Email'}
                      </label>
                      <input
                        type="text"
                        value={loginIdent}
                        onChange={(e) => setLoginIdent(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {lang === 'fa' ? 'رمز عبور' : 'Password'}
                      </label>
                      <input
                        type="password"
                        value={loginPass}
                        onChange={(e) => setLoginPass(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <button
                        type="button"
                        onClick={() => setAuthMode('reset')}
                        className="text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        {lang === 'fa' ? 'فراموشی رمز عبور؟' : 'Forgot Password?'}
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                    >
                      {lang === 'fa' ? 'ورود به حساب' : 'Sign In'}
                    </button>
                  </form>
                )}

                {authMode === 'reset' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-300">
                      {lang === 'fa'
                        ? 'ایمیل حساب خود را وارد کنید تا لینک بازیابی امن برای شما ارسال شود.'
                        : 'Enter your registered email address to request a password reset.'}
                    </p>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="operator@mosavi-cs.ir"
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLocalAuthMsg(
                          lang === 'fa'
                            ? 'درخواست بازیابی رمز عبور در سیستم ثبت شد.'
                            : 'Password recovery request registered.'
                        )
                      }
                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white cursor-pointer"
                    >
                      {lang === 'fa' ? 'ارسال لینک بازیابی' : 'Send Reset Link'}
                    </button>
                  </div>
                )}

                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <button
                    type="button"
                    onClick={props.onGoogleLogin}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-white cursor-pointer"
                  >
                    {lang === 'fa'
                      ? 'ورود سریع با حساب Google (Firebase OAuth)'
                      : 'Sign In with Google (Firebase Auth)'}
                  </button>
                  {props.isAuthenticated && (
                    <button
                      type="button"
                      onClick={props.onLogout}
                      className="w-full py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 cursor-pointer"
                    >
                      {lang === 'fa' ? 'خروج از حساب کاربری' : 'Sign Out'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. LEADERBOARD & RANKING SYSTEM */}
          {activeModal === 'leaderboard' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLbTab('global')}
                  className={`px-4 py-2 text-xs font-bold cursor-pointer ${
                    lbTab === 'global' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  {lang === 'fa' ? 'رتبه‌بندی جهانی (Global)' : 'Global Leaderboard'}
                </button>
                <button
                  type="button"
                  onClick={() => setLbTab('friends')}
                  className={`px-4 py-2 text-xs font-bold cursor-pointer ${
                    lbTab === 'friends' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  {lang === 'fa' ? 'رتبه‌بندی دوستان و هم‌تیمی‌ها' : 'Squad & Friends'}
                </button>
                <button
                  type="button"
                  onClick={() => setLbTab('ranks')}
                  className={`px-4 py-2 text-xs font-bold cursor-pointer ${
                    lbTab === 'ranks' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  {lang === 'fa' ? 'جدول رنک‌های هشت‌گانه MOSAVI CS' : '8 Competitive Rank Tiers'}
                </button>
              </div>

              {lbTab === 'ranks' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {RANK_THRESHOLDS.map((rt, idx) => (
                    <div
                      key={rt.tier}
                      className="p-4 bg-zinc-950 border border-zinc-800 flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-[11px] font-mono text-zinc-500">TIER 0{idx + 1}</span>
                        <div className="text-base font-bold mt-1" style={{ color: rt.colorHex }}>
                          {rt.tier}
                        </div>
                        <div className="text-xs text-zinc-300 mt-0.5">{rt.nameFa}</div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-zinc-900 font-mono text-xs text-zinc-400 tabular-nums">
                        Min XP: {rt.minXp}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-950 border border-zinc-800 overflow-x-auto">
                  <table className="w-full text-xs font-mono tabular-nums text-left">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/60">
                        <th className="p-3">#</th>
                        <th className="p-3">{lang === 'fa' ? 'نام بازیکن' : 'OPERATOR'}</th>
                        <th className="p-3">{lang === 'fa' ? 'رنک (Rank)' : 'RANK TIER'}</th>
                        <th className="p-3 text-right">LEVEL</th>
                        <th className="p-3 text-right">XP</th>
                        <th className="p-3 text-right">WINS</th>
                        <th className="p-3 text-right">KILLS</th>
                        <th className="p-3 text-right">K/D</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {(lbTab === 'friends' ? props.leaderboard.slice(0, 4) : props.leaderboard).map(
                        (u, index) => (
                          <tr
                            key={u.uid}
                            className={
                              u.uid === props.user.uid ? 'bg-red-950/30 text-white font-bold' : 'text-zinc-200'
                            }
                          >
                            <td className="p-3">{index + 1}</td>
                            <td className="p-3 font-sans font-semibold">{u.username}</td>
                            <td className="p-3 text-red-400">{u.rankTier}</td>
                            <td className="p-3 text-right">{u.level}</td>
                            <td className="p-3 text-right text-amber-400">{u.xp}</td>
                            <td className="p-3 text-right">{u.wins}</td>
                            <td className="p-3 text-right">{u.kills}</td>
                            <td className="p-3 text-right text-emerald-400">
                              {calculateKDRatio(u.kills, u.deaths)}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 5. SETTINGS & ANDROID APK HUB */}
          {activeModal === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 6 Cols: Graphics, Audio, Sensitivity, Controls */}
              <div className="lg:col-span-6 p-5 bg-zinc-950 border border-zinc-800 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">
                  {lang === 'fa' ? 'تنظیمات گرافیکی و بهینه‌سازی (PC & Mobile)' : 'Graphics & Performance Optimization'}
                </h3>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">
                    {lang === 'fa' ? 'کیفیت گرافیکی (Quality Preset):' : 'Graphics Quality Preset:'}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Low', 'Medium', 'High', 'Ultra'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => props.setGraphics({ ...props.graphics, preset })}
                        className={`py-2 text-xs font-mono font-bold border cursor-pointer ${
                          props.graphics.preset === preset
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {lang === 'fa'
                      ? `میدان دید دوربین (Field of View): ${props.graphics.fov}°`
                      : `Field of View (FOV): ${props.graphics.fov}°`}
                  </label>
                  <input
                    type="range"
                    min="60"
                    max="105"
                    step="1"
                    value={props.graphics.fov}
                    onChange={(e) =>
                      props.setGraphics({ ...props.graphics, fov: Number(e.target.value) })
                    }
                    className="w-full accent-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {lang === 'fa'
                      ? `حساسیت موس و لمس (Sensitivity): ${props.graphics.sensitivity.toFixed(1)}`
                      : `Mouse & Touch Sensitivity: ${props.graphics.sensitivity.toFixed(1)}`}
                  </label>
                  <input
                    type="range"
                    min="0.3"
                    max="2.5"
                    step="0.1"
                    value={props.graphics.sensitivity}
                    onChange={(e) =>
                      props.setGraphics({ ...props.graphics, sensitivity: Number(e.target.value) })
                    }
                    className="w-full accent-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {lang === 'fa'
                      ? `حجم صدای سه‌بعدی محیط: ${Math.round(props.graphics.volume * 100)}%`
                      : `3D Spatial Sound Volume: ${Math.round(props.graphics.volume * 100)}%`}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={props.graphics.volume}
                    onChange={(e) =>
                      props.setGraphics({ ...props.graphics, volume: Number(e.target.value) })
                    }
                    className="w-full accent-red-600"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={props.graphics.bloodEnabled}
                      onChange={(e) =>
                        props.setGraphics({ ...props.graphics, bloodEnabled: e.target.checked })
                      }
                      className="accent-red-600"
                    />
                    {lang === 'fa' ? 'فعال‌سازی افکت برخورد خون' : 'Enable Ballistic Blood Effects'}
                  </label>

                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={props.mobileConfig.enabled}
                      onChange={(e) =>
                        props.setMobileConfig({ ...props.mobileConfig, enabled: e.target.checked })
                      }
                      className="accent-red-600"
                    />
                    {lang === 'fa' ? 'نمایش کنترل لمسی اندروید' : 'Enable Mobile Touch HUD'}
                  </label>
                </div>
              </div>

              {/* Right 6 Cols: Dedicated Android APK & Native Build Package */}
              <div className="lg:col-span-6 p-5 bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">
                    {lang === 'fa' ? 'نسخه اندروید (APK) و کنترل لمسی اختصاصی' : 'Android Native APK & Mobile Package'}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {lang === 'fa'
                      ? 'بازی MOSAVI CS دارای معماری مشترک هسته سه‌بعدی برای PC و Android است. نسخه موبایل شامل جوی‌استیک مجازی، دکمه‌های قابل جابه‌جایی و تغییر سایز، بهینه‌سازی مصرف باتری و پیکربندی کامل ساخت APK بومی (Capacitor Android Gradle) می‌باشد.'
                      : 'MOSAVI CS shares its 3D WebGL tactical engine across PC and Android with full customizable virtual touch controls, battery/memory optimization presets, and Capacitor Android native APK packaging.'}
                  </p>

                  <div className="p-3 bg-zinc-900 border border-zinc-800 font-mono text-xs space-y-1 text-zinc-300">
                    <div>Package ID: <span className="text-red-400">ir.mosavi.cs</span></div>
                    <div>Orientation: <span className="text-emerald-400">SensorLandscape (Fullscreen)</span></div>
                    <div>Target ABI: <span className="text-sky-400">arm64-v8a / armeabi-v7a</span></div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <a
                    href="/api/download/mosavi-cs-android-apk-bundle.json"
                    download="MOSAVI_CS_Android_APK_Build_Config.json"
                    className="block w-full py-3 bg-red-600 hover:bg-red-500 text-center text-white font-bold text-xs tracking-wide"
                  >
                    {lang === 'fa'
                      ? 'دانلود پکیج تنظیمات و بیلد APK اندروید (MOSAVI CS Android Bundle)'
                      : 'DOWNLOAD ANDROID APK BUILD BUNDLE'}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 6. ADMIN COMMAND PANEL */}
          {activeModal === 'admin' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'fa'
                      ? 'مرکز فرماندهی مدیر سیستم (مدیریت کاربران، مسابقات، گزارش تخلف و سرور)'
                      : 'System Administrator Command Center'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {lang === 'fa'
                      ? 'متصل به دیتابیس PostgreSQL و سرور WebSocket'
                      : 'Connected to PostgreSQL & Authoritative WebSocket Server'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={props.onRefreshAdmin}
                  className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-white cursor-pointer"
                >
                  {lang === 'fa' ? 'بروزرسانی اطلاعات' : 'REFRESH DATA'}
                </button>
              </div>

              {props.adminData && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Users Management Table */}
                  <div className="lg:col-span-7 p-4 bg-zinc-950 border border-zinc-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      {lang === 'fa' ? 'مدیریت کاربران ثبت‌نام‌شده' : 'Registered Operators'}
                    </h4>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-xs font-mono tabular-nums text-left">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-400">
                            <th className="py-1.5">USER</th>
                            <th className="py-1.5">RANK</th>
                            <th className="py-1.5">STATUS</th>
                            <th className="py-1.5 text-right">ACTION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {props.adminData.users.map((u) => (
                            <tr key={u.uid}>
                              <td className="py-2 font-sans font-semibold text-white">{u.username}</td>
                              <td className="py-2 text-zinc-400">{u.rankTier}</td>
                              <td className="py-2">
                                {u.isBanned ? (
                                  <span className="text-red-500 font-bold">BANNED</span>
                                ) : (
                                  <span className="text-emerald-400">ACTIVE</span>
                                )}
                              </td>
                              <td className="py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => props.onToggleBanUser(u.uid, !u.isBanned)}
                                  className="px-2.5 py-1 bg-zinc-800 hover:bg-red-700 text-[11px] text-white cursor-pointer"
                                >
                                  {u.isBanned
                                    ? lang === 'fa'
                                      ? 'رفع مسدودیت'
                                      : 'Unban'
                                    : lang === 'fa'
                                    ? 'مسدود کردن'
                                    : 'Ban'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Publish Announcement + Server Settings */}
                  <div className="lg:col-span-5 p-4 bg-zinc-950 border border-zinc-800 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      {lang === 'fa' ? 'انتشار اطلاعیه رسمی و تنظیمات سرور' : 'Publish Announcement & Server Config'}
                    </h4>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!annTitle.trim() || !annContent.trim()) return;
                        await props.onPublishAnnouncement(annTitle, annContent);
                        setAnnTitle('');
                        setAnnContent('');
                      }}
                      className="space-y-2.5"
                    >
                      <input
                        type="text"
                        value={annTitle}
                        onChange={(e) => setAnnTitle(e.target.value)}
                        placeholder={lang === 'fa' ? 'عنوان اطلاعیه...' : 'Announcement Title...'}
                        className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                      <textarea
                        rows={2}
                        value={annContent}
                        onChange={(e) => setAnnContent(e.target.value)}
                        placeholder={lang === 'fa' ? 'متن اطلاعیه...' : 'Announcement Content...'}
                        className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 bg-red-600 hover:bg-red-500 text-xs font-bold text-white cursor-pointer"
                      >
                        {lang === 'fa' ? 'انتشار اطلاعیه در صفحه اصلی' : 'Publish Announcement'}
                      </button>
                    </form>

                    {props.adminData.serverConfig && (
                      <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                        <span>
                          TickRate: <strong>{props.adminData.serverConfig.tickRate}Hz</strong> · Anti-Cheat:{' '}
                          <strong>{props.adminData.serverConfig.antiCheatStrictMode ? 'ON' : 'OFF'}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            props.onUpdateServerConfig(
                              props.adminData!.serverConfig!.tickRate === 64 ? 128 : 64,
                              true
                            )
                          }
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white font-mono cursor-pointer"
                        >
                          Toggle 64/128Hz
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Abuse Reports & Security Logs */}
                  <div className="lg:col-span-6 p-4 bg-zinc-950 border border-zinc-800 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      {lang === 'fa' ? 'بررسی گزارش‌های تخلف بازیکنان' : 'Abuse & Cheat Reports'}
                    </h4>
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {props.adminData.abuseReports.map((rep) => (
                        <div
                          key={rep.id}
                          className="p-2.5 bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-white">{rep.suspectName}</div>
                            <div className="text-zinc-400">{rep.reason}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] uppercase text-amber-400">
                              {rep.status}
                            </span>
                            {rep.status === 'open' && (
                              <button
                                type="button"
                                onClick={() => props.onResolveReport(rep.id, 'resolved')}
                                className="px-2 py-1 bg-emerald-700 text-white text-[11px] cursor-pointer"
                              >
                                {lang === 'fa' ? 'بررسی شد' : 'Resolve'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-6 p-4 bg-zinc-950 border border-zinc-800 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      {lang === 'fa' ? 'رویدادهای امنیتی سرور (Security Logs)' : 'Server Security Audit Logs'}
                    </h4>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto font-mono text-[11px]">
                      {props.adminData.securityLogs.map((log) => (
                        <div key={log.id} className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-300">
                          <span className="text-red-400 font-bold mr-2">[{log.eventType}]</span>
                          <span>{log.details}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
