import React, { useState } from 'react';
import { ExternalControlBridge, HudSnapshot } from './TacticalArena3D.tsx';
import { WEAPONS, WEAPON_LIST, WeaponId } from '../game/weapons.ts';
import { MAPS, MapId } from '../game/maps.ts';
import { GameModeId, GAME_MODES } from '../game/rules.ts';
import { soundEngine } from '../game/soundEngine.ts';

export interface MobileHudCustomization {
  enabled: boolean;
  buttonScale: number; // 0.75 to 1.35
  fireOffsetX: number; // -60 to +60 px
  fireOffsetY: number; // -60 to +60 px
  joystickOffsetX: number;
  joystickOffsetY: number;
}

interface TacticalHudOverlayProps {
  lang: 'fa' | 'en';
  hud: HudSnapshot;
  mapId: MapId;
  gameMode: GameModeId;
  showBuyMenu: boolean;
  onCloseBuyMenu: () => void;
   onToggleBuyMenu: () => void;
  showScoreboard: boolean;
  onPauseRequest: () => void;
  controlBridgeRef: React.MutableRefObject<ExternalControlBridge | null>;
  mobileConfig: MobileHudCustomization;
  onUpdateMobileConfig: (cfg: MobileHudCustomization) => void;
}

export const TacticalHudOverlay: React.FC<TacticalHudOverlayProps> = ({
  lang,
  hud,
  mapId,
  gameMode,
  showBuyMenu,
  onCloseBuyMenu,
  onToggleBuyMenu,
  showScoreboard,
  onPauseRequest,
  controlBridgeRef,
  mobileConfig,
  onUpdateMobileConfig,
}) => {
  const [muted, setMuted] = useState(soundEngine.muted);
  const [editingTouchLayout, setEditingTouchLayout] = useState(false);
  const [joystickThumb, setJoystickThumb] = useState({ x: 0, y: 0 });

  const activeWeaponSpec = WEAPONS[hud.activeWeapon];
  const mapCfg = MAPS[mapId];
  const modeCfg = GAME_MODES[gameMode];

  const minutes = Math.floor(hud.timeRemainingSec / 60);
  const seconds = hud.timeRemainingSec % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const toggleMute = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    soundEngine.muted = !soundEngine.muted;
    setMuted(soundEngine.muted);
  };

  // Convert world coordinates (-48..48) to radar canvas (0..112)
  const worldToRadar = (wx: number, wz: number) => {
    const nx = ((wx + 48) / 96) * 112;
    const nz = ((wz + 48) / 96) * 112;
    return {
      x: Math.max(6, Math.min(106, nx)),
      y: Math.max(6, Math.min(106, nz)),
    };
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Peripheral Low-HP / Damage Vignette */}
      {(hud.damageIndicatorAlpha > 0.02 || hud.health < 30) && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-150"
          style={{
            opacity: Math.max(hud.damageIndicatorAlpha, hud.health < 30 ? 0.42 : 0),
            boxShadow: 'inset 0 0 110px 36px rgba(220, 38, 38, 0.75)',
          }}
        />
      )}

      {/* Flashbang Stun Whiteout Screen */}
      {hud.flashAlpha > 0.01 && (
        <div
          className="fixed inset-0 bg-white pointer-events-none"
          style={{ opacity: hud.flashAlpha }}
        />
      )}

      {/* AWP Sniper Dual-Stage Optical Scope Overlay */}
      {hud.isAiming && hud.activeWeapon === 'awp' && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center bg-black/75">
          <div className="relative w-[min(76vh,76vw)] h-[min(76vh,76vw)] rounded-full border-4 border-zinc-800 shadow-[0_0_0_9999px_rgba(0,0,0,0.88)] overflow-hidden">
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-red-500/80" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-red-500/80" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-500" />
          </div>
        </div>
      )}

      {/* Center Tactical Crosshair & Gaze-Routed Reload / Bomb Progress */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
        aria-hidden="true"
      >
        <svg width="36" height="36" viewBox="0 0 36 36" className="overflow-visible">
          {/* Outer Crosshair Pips */}
          <line x1="18" y1="5" x2="18" y2="13" stroke="#10b981" strokeWidth="2" />
          <line x1="18" y1="23" x2="18" y2="31" stroke="#10b981" strokeWidth="2" />
          <line x1="5" y1="18" x2="13" y2="18" stroke="#10b981" strokeWidth="2" />
          <line x1="23" y1="18" x2="31" y2="18" stroke="#10b981" strokeWidth="2" />
          <circle cx="18" cy="18" r="1.5" fill="#ef4444" />

          {/* Hitmarker X */}
          {hud.hitMarkerType !== 'none' && (
            <g
              stroke={
                hud.hitMarkerType === 'kill' || hud.hitMarkerType === 'headshot'
                  ? '#ef4444'
                  : '#f8fafc'
              }
              strokeWidth="2.2"
            >
              <line x1="10" y1="10" x2="15" y2="15" />
              <line x1="26" y1="10" x2="21" y2="15" />
              <line x1="10" y1="26" x2="15" y2="21" />
              <line x1="26" y1="26" x2="21" y2="21" />
            </g>
          )}
        </svg>

        {/* Gaze-routed Reloading cue right below crosshair */}
        {hud.isReloading && (
          <div className="mt-3 px-2.5 py-0.5 bg-zinc-950/90 border border-amber-500/60 text-[11px] font-mono uppercase tracking-wider text-amber-400">
            {lang === 'fa' ? 'در حال خشاب‌گذاری...' : 'RELOADING...'}
          </div>
        )}

        {/* Bomb Plant / Defuse Action Prompt near crosshair */}
        {hud.nearBombSite && (
          <div className="mt-4 px-3 py-1.5 bg-zinc-950/92 border border-red-500/70 text-xs text-zinc-100 flex flex-col items-center gap-1">
            <span>
              {hud.bombState === 'none'
                ? lang === 'fa'
                  ? `نگه‌داشتن [E] برای کار گذاشتن بمب در سایت ${hud.nearBombSite}`
                  : `Hold [E] to Plant C4 at Site ${hud.nearBombSite}`
                : lang === 'fa'
                ? 'نگه‌داشتن [E] برای خنثی‌سازی بمب C4'
                : 'Hold [E] to Defuse C4 Bomb'}
            </span>
            {hud.actionProgress > 0 && (
              <div className="w-36 h-1.5 bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${Math.round(hud.actionProgress * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* CLUSTER 1 (Top-Left): Tactical Radar Minimap + Match Score & Timer */}
      <div className="fixed top-3 left-3 flex items-start gap-3">
        {/* Navigable Level Geometry Minimap */}
        <div className="relative w-28 h-28 bg-zinc-950/92 border border-zinc-800 shadow-lg overflow-hidden">
          <svg width="112" height="112" viewBox="0 0 112 112">
            <rect width="112" height="112" fill="#090a0f" />
            <line x1="56" y1="0" x2="56" y2="112" stroke="#1e293b" strokeWidth="1" />
            <line x1="0" y1="56" x2="112" y2="56" stroke="#1e293b" strokeWidth="1" />
            {/* Bomb Sites A & B */}
            {(() => {
              const pA = worldToRadar(mapCfg.bombSiteA.x, mapCfg.bombSiteA.z);
              const pB = worldToRadar(mapCfg.bombSiteB.x, mapCfg.bombSiteB.z);
              return (
                <>
                  <circle cx={pA.x} cy={pA.y} r="6" fill="rgba(239,68,68,0.22)" stroke="#ef4444" strokeWidth="1" />
                  <text x={pA.x} y={pA.y + 3} fontSize="8" fill="#fca5a5" textAnchor="middle">A</text>
                  <circle cx={pB.x} cy={pB.y} r="6" fill="rgba(239,68,68,0.22)" stroke="#ef4444" strokeWidth="1" />
                  <text x={pB.x} y={pB.y + 3} fontSize="8" fill="#fca5a5" textAnchor="middle">B</text>
                </>
              );
            })()}
            {/* Live Actors on Radar */}
            {hud.radarEntities.map((ent, idx) => {
              const pos = worldToRadar(ent.x, ent.z);
              if (ent.isBomb) {
                return <circle key={idx} cx={pos.x} cy={pos.y} r="4" fill="#f97316" />;
              }
              return (
                <circle
                  key={idx}
                  cx={pos.x}
                  cy={pos.y}
                  r={ent.isPlayer ? 3.6 : 2.6}
                  fill={ent.isPlayer ? '#22c55e' : ent.team === 'vanguard' ? '#38bdf8' : '#ef4444'}
                />
              );
            })}
          </svg>
          <div className="absolute bottom-0 inset-x-0 bg-zinc-950/90 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 flex justify-between">
            <span>{mapCfg.name}</span>
            <span className="text-red-400">{modeCfg.id.toUpperCase()}</span>
          </div>
        </div>

        {/* Compact Score & Round Clock Strip */}
        <div className="bg-zinc-950/92 border border-zinc-800 px-3.5 py-2 flex items-center gap-4 shadow-lg">
          <div className="text-center">
            <div className="text-[10px] font-semibold tracking-wider text-sky-400 uppercase">
              VANGUARD
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-white leading-none mt-0.5">
              {hud.vanguardScore}
            </div>
          </div>

          <div className="border-x border-zinc-800 px-3.5 text-center">
            <div className="text-[10px] font-mono text-zinc-400 uppercase">
              {hud.bombState === 'planted'
                ? lang === 'fa'
                  ? 'انفجار C4'
                  : 'C4 ACTIVE'
                : lang === 'fa'
                ? 'زمان مسابقه'
                : 'ROUND TIME'}
            </div>
            <div
              className={`text-xl font-bold font-mono tabular-nums leading-none mt-0.5 ${
                hud.bombState === 'planted' ? 'text-red-500' : 'text-zinc-100'
              }`}
            >
              {hud.bombState === 'planted' ? `0:${hud.bombCountdownSec < 10 ? '0' : ''}${hud.bombCountdownSec}` : formattedTime}
            </div>
          </div>

          <div className="text-center">
            <div className="text-[10px] font-semibold tracking-wider text-red-400 uppercase">
              PHANTOM
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-white leading-none mt-0.5">
              {hud.phantomScore}
            </div>
          </div>
        </div>
      </div>

      {/* CLUSTER 2 (Top-Right): Utility Controls + Kill Feed */}
      <div className="fixed top-3 right-3 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleBuyMenu();
            }}
            aria-label="Buy Weapons Menu [B]"
            className="h-9 px-3 bg-zinc-950/92 hover:bg-red-950/80 border border-zinc-800 text-xs font-mono text-zinc-200 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="text-emerald-400 font-bold tabular-nums">${hud.cash}</span>
            <span>·</span>
            <span>{lang === 'fa' ? 'خرید سلاح [B]' : 'BUY [B]'}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onUpdateMobileConfig({ ...mobileConfig, enabled: !mobileConfig.enabled });
            }}
            aria-label="Toggle Touch Controls"
            className={`h-9 px-2.5 border text-xs font-mono cursor-pointer ${
              mobileConfig.enabled
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-zinc-950/92 text-zinc-300 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {lang === 'fa' ? 'لمسی موبایل' : 'TOUCH HUD'}
          </button>

          {mobileConfig.enabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                setEditingTouchLayout(!editingTouchLayout);
              }}
              aria-label="Customize Mobile Buttons"
              className="h-9 px-2.5 bg-zinc-950/92 border border-amber-500/60 text-amber-300 text-xs font-mono cursor-pointer"
            >
              {lang === 'fa' ? 'تنظیم دکمه‌ها' : 'LAYOUT'}
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={toggleMute}
            aria-label={muted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
            className="w-9 h-9 bg-zinc-950/92 hover:bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {!muted ? (
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
              ) : (
                <line x1="23" y1="9" x2="17" y2="15" />
              )}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPauseRequest();
            }}
            aria-label="Pause Game [P]"
            className="w-9 h-9 bg-zinc-950/92 hover:bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          </button>
        </div>

        {/* Live Kill Feed */}
        <div className="flex flex-col items-end gap-1 mt-1">
          {hud.killFeed.map((entry) => (
            <div
              key={entry.id}
              className="bg-zinc-950/88 border border-zinc-800 px-2.5 py-1 text-xs font-mono flex items-center gap-2"
            >
              <span className={entry.team === 'vanguard' ? 'text-sky-400 font-semibold' : 'text-red-400 font-semibold'}>
                {entry.killer}
              </span>
              <span className="text-zinc-500">[{WEAPONS[entry.weaponId].name.split(' ')[0]}]</span>
              {entry.headshot && <span className="text-amber-400 font-bold">HS</span>}
              <span className="text-zinc-200">{entry.victim}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CLUSTER 3 (Bottom-Left): Vitality Health & Kevlar Armor Readout (2.8:1 Hero-to-Kicker Scale) */}
      <div className="fixed bottom-4 left-4 bg-zinc-950/92 border border-zinc-800 px-4 py-2.5 flex items-center gap-6 shadow-xl">
        {/* Health Readout */}
        <div className="flex items-center gap-3">
          <svg width="26" height="26" viewBox="0 0 24 24" className="shrink-0">
            <rect x="2" y="2" width="20" height="20" rx="3" fill="#18181b" stroke="#dc2626" strokeWidth="1.8" />
            <path d="M12 7v10M7 12h10" stroke="#ef4444" strokeWidth="3" strokeLinecap="square" />
          </svg>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
              {lang === 'fa' ? 'سلامتی (HP)' : 'HEALTH'}
            </div>
            <div
              className={`text-3xl font-bold font-mono tabular-nums leading-none ${
                hud.health <= 25 ? 'text-red-500' : 'text-white'
              }`}
            >
              {Math.round(hud.health)}
            </div>
          </div>
        </div>

        {/* Kevlar Armor Readout */}
        <div className="flex items-center gap-3 border-l border-zinc-800 pl-6">
          <svg width="26" height="26" viewBox="0 0 24 24" className="shrink-0">
            <path
              d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="1.8"
            />
          </svg>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
              {lang === 'fa' ? 'زره (ARMOR)' : 'ARMOR'}
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-sky-400 leading-none">
              {Math.round(hud.armor)}
            </div>
          </div>
        </div>
      </div>

      {/* CLUSTER 4 (Bottom-Right): Active Weapon Ammo + 1-5 Loadout Switcher */}
      <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2">
        {/* Loadout Slots 1-5 */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {[
            { slot: 1 as const, id: hud.primaryWeapon, keyLabel: '1' },
            { slot: 2 as const, id: hud.secondaryWeapon, keyLabel: '2' },
            { slot: 3 as const, id: 'knife' as WeaponId, keyLabel: '3' },
            { slot: 4 as const, id: 'grenade' as WeaponId, keyLabel: '4' },
            { slot: 5 as const, id: 'smoke' as WeaponId, keyLabel: '5' },
          ].map((item) => {
            const isSelected =
              hud.activeWeapon === item.id ||
              (item.slot === 5 && (hud.activeWeapon === 'smoke' || hud.activeWeapon === 'flashbang'));
            return (
              <button
                key={item.slot}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  controlBridgeRef.current?.switchWeaponSlot(item.slot);
                }}
                className={`px-2.5 py-1 border text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-red-600/90 border-red-500 text-white font-bold'
                    : 'bg-zinc-950/90 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="text-[10px] opacity-80">[{item.keyLabel}]</span>
                <span>{WEAPONS[item.id].name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Active Weapon Hero Counter */}
        <div className="bg-zinc-950/92 border border-zinc-800 px-4 py-2.5 flex items-center gap-5 shadow-xl">
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-red-400">
              {lang === 'fa' ? activeWeaponSpec.nameFa : activeWeaponSpec.name}
            </div>
            <div className="text-[11px] text-zinc-400">
              {lang === 'fa' ? activeWeaponSpec.roleDescFa : activeWeaponSpec.roleDescEn}
            </div>
          </div>

          <div className="border-l border-zinc-800 pl-4 flex items-baseline gap-1.5 font-mono tabular-nums">
            <span className="text-3xl font-bold text-white leading-none">
              {activeWeaponSpec.category === 'melee' ? '∞' : hud.magAmmo}
            </span>
            {activeWeaponSpec.category !== 'melee' && (
              <span className="text-sm text-zinc-400">/ {hud.reserveAmmo}</span>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE VIRTUAL JOYSTICK & TOUCH ACTION PAD (When Touch HUD is active) */}
      {mobileConfig.enabled && (
        <div className="fixed inset-0 pointer-events-none z-20">
          {/* Virtual Left Movement Joystick */}
          <div
            className="fixed bottom-24 left-8 w-28 h-28 rounded-full bg-zinc-950/75 border-2 border-zinc-700 pointer-events-auto flex items-center justify-center touch-none"
            style={{
              transform: `translate(${mobileConfig.joystickOffsetX}px, ${mobileConfig.joystickOffsetY}px) scale(${mobileConfig.buttonScale})`,
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 0 && e.pressure === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const dx = Math.max(-40, Math.min(40, e.clientX - cx));
              const dy = Math.max(-40, Math.min(40, e.clientY - cy));
              setJoystickThumb({ x: dx, y: dy });
              controlBridgeRef.current?.setTouchMoveVector(dx / 40, -dy / 40);
            }}
            onPointerUp={() => {
              setJoystickThumb({ x: 0, y: 0 });
              controlBridgeRef.current?.setTouchMoveVector(0, 0);
            }}
          >
            <div
              className="w-11 h-11 rounded-full bg-red-600/90 border border-red-400 shadow-md"
              style={{ transform: `translate(${joystickThumb.x}px, ${joystickThumb.y}px)` }}
            />
          </div>

          {/* Right Touch Look Pad */}
          <div
            className="fixed top-20 right-0 w-1/2 h-3/5 pointer-events-auto touch-none"
            onPointerMove={(e) => {
              if (e.buttons > 0) {
                controlBridgeRef.current?.addTouchLookDelta(e.movementX, e.movementY);
              }
            }}
          />

          {/* Customizable Touch Action Buttons (Fire, Aim, Jump, Crouch, Reload, Swap) */}
          <div
            className="fixed bottom-24 right-8 flex flex-col items-end gap-2.5 pointer-events-auto"
            style={{
              transform: `translate(${mobileConfig.fireOffsetX}px, ${mobileConfig.fireOffsetY}px) scale(${mobileConfig.buttonScale})`,
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => controlBridgeRef.current?.toggleAim()}
                className="w-14 h-12 rounded-lg bg-zinc-900/90 border border-zinc-700 text-xs font-mono font-bold text-sky-400"
              >
                {lang === 'fa' ? 'نشانه' : 'AIM'}
              </button>
              <button
                type="button"
                onClick={() => controlBridgeRef.current?.triggerReload()}
                className="w-14 h-12 rounded-lg bg-zinc-900/90 border border-zinc-700 text-xs font-mono font-bold text-amber-400"
              >
                {lang === 'fa' ? 'خشاب' : 'RLD'}
              </button>
              <button
                type="button"
                onClick={() => controlBridgeRef.current?.triggerJump()}
                className="w-14 h-12 rounded-lg bg-zinc-900/90 border border-zinc-700 text-xs font-mono font-bold text-zinc-100"
              >
                {lang === 'fa' ? 'پرش' : 'JUMP'}
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => controlBridgeRef.current?.toggleCrouch()}
                className="w-14 h-12 rounded-lg bg-zinc-900/90 border border-zinc-700 text-xs font-mono font-bold text-zinc-300"
              >
                {lang === 'fa' ? 'نشستن' : 'CRCH'}
              </button>
              <button
                type="button"
                onPointerDown={() => controlBridgeRef.current?.setFiring(true)}
                onPointerUp={() => controlBridgeRef.current?.setFiring(false)}
                className="w-20 h-20 rounded-full bg-red-600/95 border-2 border-red-400 text-sm font-mono font-bold text-white shadow-lg"
              >
                {lang === 'fa' ? 'شلیک' : 'FIRE'}
              </button>
            </div>
          </div>

          {/* Mobile Touch Layout Customizer Modal */}
          {editingTouchLayout && (
            <div className="fixed top-16 right-4 w-80 bg-zinc-950 border border-zinc-800 p-4 pointer-events-auto shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">
                  {lang === 'fa' ? 'سفارشی‌سازی دکمه‌های موبایل' : 'Mobile Touch Layout Editor'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingTouchLayout(false)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3 text-xs">
                <label className="block">
                  <span className="text-zinc-400 block mb-1">
                    {lang === 'fa' ? 'اندازه دکمه‌ها (Button Scale)' : 'Button Size Scale'}: {Math.round(mobileConfig.buttonScale * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0.75"
                    max="1.35"
                    step="0.05"
                    value={mobileConfig.buttonScale}
                    onChange={(e) =>
                      onUpdateMobileConfig({ ...mobileConfig, buttonScale: Number(e.target.value) })
                    }
                    className="w-full accent-red-600"
                  />
                </label>
                <label className="block">
                  <span className="text-zinc-400 block mb-1">
                    {lang === 'fa' ? 'جابه‌جایی افقی دکمه شلیک (X)' : 'Fire Cluster Offset X'}: {mobileConfig.fireOffsetX}px
                  </span>
                  <input
                    type="range"
                    min="-80"
                    max="40"
                    step="4"
                    value={mobileConfig.fireOffsetX}
                    onChange={(e) =>
                      onUpdateMobileConfig({ ...mobileConfig, fireOffsetX: Number(e.target.value) })
                    }
                    className="w-full accent-red-600"
                  />
                </label>
                <label className="block">
                  <span className="text-zinc-400 block mb-1">
                    {lang === 'fa' ? 'جابه‌جایی عمودی دکمه شلیک (Y)' : 'Fire Cluster Offset Y'}: {mobileConfig.fireOffsetY}px
                  </span>
                  <input
                    type="range"
                    min="-80"
                    max="40"
                    step="4"
                    value={mobileConfig.fireOffsetY}
                    onChange={(e) =>
                      onUpdateMobileConfig({ ...mobileConfig, fireOffsetY: Number(e.target.value) })
                    }
                    className="w-full accent-red-600"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TACTICAL BUY MENU MODAL ([B]) */}
      {showBuyMenu && (
        <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {lang === 'fa' ? 'زرادخانه تاکتیکی MOSAVI CS (خرید سلاح)' : 'MOSAVI CS Tactical Armory'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {lang === 'fa'
                    ? 'سلاح یا تجهیزات مورد نظر خود را برای نبرد انتخاب کنید'
                    : 'Select primary weapons, sidearms, Kevlar armor, and tactical grenades'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 font-mono text-sm">
                  <span className="text-zinc-400 mr-2">{lang === 'fa' ? 'اعتبار:' : 'FUNDS:'}</span>
                  <span className="text-emerald-400 font-bold tabular-nums">${hud.cash}</span>
                </div>
                <button
                  type="button"
                  onClick={onCloseBuyMenu}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 cursor-pointer"
                >
                  {lang === 'fa' ? 'بستن [B]' : 'CLOSE [B]'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[62vh] overflow-y-auto pr-1">
              {/* Armor refill card */}
              <button
                type="button"
                onClick={() => controlBridgeRef.current?.buyWeaponOrItem('armor')}
                className="p-3.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-left flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-sky-400">
                      {lang === 'fa' ? 'جلیقه و کلاهک ضدگلوله' : 'Heavy Kevlar + Helmet'}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">$650</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {lang === 'fa'
                      ? 'بازگردانی کامل زره به ۱۰۰ واحد و کاهش آسیب گلوله'
                      : 'Restores Armor to 100 and reduces incoming ballistic damage'}
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-zinc-400">
                  {lang === 'fa' ? `زره فعلی: ${hud.armor}/100` : `Current Armor: ${hud.armor}/100`}
                </div>
              </button>

              {WEAPON_LIST.filter((w) => w.price > 0).map((w) => {
                const canAfford = hud.cash >= w.price;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      const ok = controlBridgeRef.current?.buyWeaponOrItem(w.id);
                      if (ok) onCloseBuyMenu();
                    }}
                    className={`p-3.5 border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      canAfford
                        ? 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800'
                        : 'bg-zinc-950/60 border-zinc-900 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">
                          {lang === 'fa' ? w.nameFa : w.name}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                          ${w.price}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {lang === 'fa' ? w.roleDescFa : w.roleDescEn}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
                      <span>DMG: {w.damage}</span>
                      <span>RPM: {w.fireRateRPM}</span>
                      <span>MAG: {w.magCapacity}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LIVE SCOREBOARD OVERLAY ([Tab]) */}
      {showScoreboard && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4 pointer-events-none">
          <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {lang === 'fa' ? `جدول امتیازات مسابقه — ${mapCfg.nameFa}` : `Match Scoreboard — ${mapCfg.name}`}
                </h3>
                <p className="text-xs text-zinc-400">
                  {lang === 'fa' ? modeCfg.nameFa : modeCfg.nameEn}
                </p>
              </div>
              <div className="flex items-center gap-6 font-mono text-lg font-bold tabular-nums">
                <span className="text-sky-400">VANGUARD: {hud.vanguardScore}</span>
                <span className="text-red-400">PHANTOM: {hud.phantomScore}</span>
              </div>
            </div>

            <table className="w-full text-xs font-mono tabular-nums text-left">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="py-2">{lang === 'fa' ? 'اپراتور' : 'OPERATOR'}</th>
                  <th className="py-2">{lang === 'fa' ? 'تیم' : 'SQUAD'}</th>
                  <th className="py-2">{lang === 'fa' ? 'وضعیت' : 'STATUS'}</th>
                  <th className="py-2 text-right">KILLS</th>
                  <th className="py-2 text-right">DEATHS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                <tr className="bg-red-950/25 text-white font-bold">
                  <td className="py-2">{lang === 'fa' ? 'شما (YOU)' : 'YOU (COMMANDER)'}</td>
                  <td className="py-2 uppercase text-sky-400">ACTIVE</td>
                  <td className="py-2 text-emerald-400">{hud.health > 0 ? 'ALIVE' : 'RESPAWNING'}</td>
                  <td className="py-2 text-right">{hud.playerKills}</td>
                  <td className="py-2 text-right">{hud.playerDeaths}</td>
                </tr>
                {hud.botsScoreboard.map((b) => (
                  <tr key={b.id} className="text-zinc-300">
                    <td className="py-2">{b.name}</td>
                    <td className={`py-2 uppercase ${b.team === 'vanguard' ? 'text-sky-400' : 'text-red-400'}`}>
                      {b.team}
                    </td>
                    <td className="py-2">{b.alive ? 'ALIVE' : 'DOWN'}</td>
                    <td className="py-2 text-right">{b.kills}</td>
                    <td className="py-2 text-right">{b.deaths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
