'use client';
import { GameHeader } from './GameHeader';
import './GameLayout.css';
import './GamePolish.css';
import { GamePreferencesDialog } from './GamePreferencesDialog';
import { GameStatus } from './GameStatus';
import { MatchSummary } from './MatchSummary';
import {
  DEFAULT_GAME_PREFERENCES,
  GAME_PREFERENCES_KEY,
  getGamePreferences,
  updateGamePreferences,
  resetGamePreferences,
  refreshGamePreferences,
  subscribeGamePreferences,
} from '@/game/gamePreferences';
import { MatchRoster, SpectatorControls } from './MatchRoster';
import { TeamSizePicker } from './TeamSizePicker';
import { TeamOnlineRooms } from './TeamOnlineRooms';
import { mapsForTeams, type TeamSize } from '@/game/teams';
import './Teams.css';

import { MapPicker } from './MapPicker';
import { ARENA_MAPS, DEFAULT_MAP, type ArenaMapId } from '@/game/maps';
import { DeathRecap, DeathRecapDialog } from './DeathRecap';

import './LaserQuest.css'; // Keep the collectible HUD styles with this component.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameHudState } from '@/game/types';
import type { WeaponId, PrimaryWeaponId } from '@/game/weaponDefinitions';
import { WeaponShop } from './WeaponShop';
import type { OnlineGame } from '@/game/onlineMovement';
import { ROOM_SESSION_KEY } from '@/game/createRoomConnection';

import { NameSelection } from './NameSelection';
import { AimOverlay } from './AimOverlay';
import { LoadoutSelection, type LoadoutChoices } from './LoadoutSelection';
import { recoverModuleLoad, clearModuleRetry } from '@/game/recoverModuleLoad';
import { DIFFICULTIES, type Difficulty } from '@/game/difficulty';
import {
  createOrbRewards,
  DIFFICULTY_ORB_REWARDS,
} from '@/game/createOrbRewards';
import {
  createOrbWallet,
  WALLET_STORAGE_KEY,
  type PurchaseResult,
} from '@/game/createOrbWallet';
import {
  createProgression,
  createMatchXpTracker,
  levelDetails,
  EMPTY_COSMETICS,
  rewardAt,
  PROGRESSION_KEY,
  type CosmeticKind,
} from '@/game/progression';
import { CharacterShop } from './CharacterShop';
import type { DailyChoice } from '@/game/storeCatalog';
import { LevelBadge, ProgressionBar, ProgressionPanel } from './Progression';
import { localWeaponTesting } from '@/game/localWeaponTesting';

const initialHud: GameHudState = {
  deathRecap: null,
  nearbyLaserPart: null,
  laserPartsCount: 0,
  laserUnlocked: false,
  laserProgressSaved: true,
  laserNotice: '',
  lobbyStation: null,
  swordBoostState: 'ready',
  swordBoostSeconds: 0,
  grappleState: 'idle',
  scoped: false,
  weaponId: 'assaultRifle',
  weaponName: 'Kestrel AR',
  fireMode: 'Auto',
  ammo: 20,
  reserveAmmo: 100,
  reloading: false,
  hitMarker: 'none',
  hitId: 0,
  health: 100,
  maxHealth: 100,
  botHealth: 100,
  dead: false,
  roundWon: false,
  damageId: 0,
  playerScore: 0,
  botScore: 0,
  result: 'none',
  paused: false,
  awaitingFirstInput: false,
};

export function GameShell() {
  const [preferences, setPreferences] = useState({
    ...DEFAULT_GAME_PREFERENCES,
    saved: true,
  });
  const [guideSection, setGuideSection] = useState<
    'settings' | 'controls' | null
  >(null);
  useEffect(() => {
    setPreferences(getGamePreferences());
    const unsubscribe = subscribeGamePreferences(setPreferences);
    const changed = (event: StorageEvent) => {
      if (event.key === GAME_PREFERENCES_KEY || event.key === null)
        refreshGamePreferences();
    };
    window.addEventListener('storage', changed);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', changed);
    };
  }, []);
  const openGuide = useCallback((section: 'settings' | 'controls') => {
    if (document.pointerLockElement) document.exitPointerLock();
    setShopOpen(false);
    setCareerOpen(false);
    setCharacterShopOpen(false);
    setGuideSection(section);
  }, []);
  const [characterShopOpen, setCharacterShopOpen] = useState(false);
  const [storeState, setStoreState] = useState(() => createOrbWallet().state);
  const [daily, setDaily] = useState(() => createOrbWallet().dailyStatus());
  const progressionRef = useRef<ReturnType<typeof createProgression> | null>(
    null,
  );
  const botXpRef = useRef(createMatchXpTracker());
  const botScoresRef = useRef([0, 0]);
  const [career, setCareer] = useState({
    ...levelDetails(0),
    cosmetics: { ...EMPTY_COSMETICS },
    saved: true,
  });
  const cosmeticsRef = useRef({ ...EMPTY_COSMETICS });
  const [careerSection, setCareerSection] = useState<'levels' | 'cosmetics'>(
    'levels',
  );
  const [careerOpen, setCareerOpen] = useState(false);
  const [xpNotice, setXpNotice] = useState({
    amount: 0,
    before: 1,
    after: 1,
    bonuses: [] as string[],
  });
  const xpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function syncCareer() {
    const state = progressionRef.current?.state;
    if (!state) return;
    cosmeticsRef.current = state.cosmetics;
    setCareer(state);
    gameRef.current?.setCosmetics(state.cosmetics);
  }
  function awardXp(amount: number, bonuses: string[] = []) {
    if (amount <= 0 || !progressionRef.current) return;
    const reward = progressionRef.current.award(amount);
    if (reward.orbs > 0) {
      walletRef.current?.award(reward.orbs);
      syncWallet();
    }
    syncCareer();
    setXpNotice((previous) => ({
      amount: previous.amount + amount,
      before: previous.amount ? previous.before : reward.before,
      after: reward.after,
      bonuses: [...new Set([...previous.bonuses, ...bonuses])],
    }));
    if (xpTimer.current) clearTimeout(xpTimer.current);
    xpTimer.current = setTimeout(
      () => setXpNotice({ amount: 0, before: 1, after: 1, bonuses: [] }),
      6000,
    );
  }
  function equipCosmetic(kind: CosmeticKind, level: number | null) {
    if (progressionRef.current?.equip(kind, level)) syncCareer();
  }
  const openArmory = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    setCharacterShopOpen(false);
    setCareerOpen(false);
    setShopOpen(true);
  }, []);
  const openCareer = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    setCharacterShopOpen(false);
    setShopOpen(false);
    setCareerSection('levels');
    setCareerOpen(true);
  }, []);
  const openCosmetics = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    setCharacterShopOpen(false);
    setShopOpen(false);
    setCareerSection('cosmetics');
    setCareerOpen(true);
  }, []);
  const openCharacterShop = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    walletRef.current?.refresh();
    syncWallet();
    setCareerOpen(false);
    setShopOpen(false);
    setCharacterShopOpen(true);
  }, []);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!gameRef.current) return;
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey)
        return;
      if (
        document.querySelector(
          'dialog[open], [role="dialog"][aria-modal="true"]',
        )
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      const actions: Record<string, () => void> = {
        KeyB: openArmory,
        KeyL: openCareer,
        KeyK: openCosmetics,
        KeyH: openCharacterShop,
        F1: () => openGuide('controls'),
        F2: () => openGuide('settings'),
      };
      const action = actions[event.code];
      if (action) {
        event.preventDefault();
        action();
      }
    }
    window.addEventListener('keydown', shortcut, true);
    return () => window.removeEventListener('keydown', shortcut, true);
  }, [openArmory, openCareer, openCosmetics, openCharacterShop, openGuide]);
  const [teamSize, setTeamSize] = useState<TeamSize>(1);
  const teamSizeRef = useRef<TeamSize>(1);
  const [mapId, setMapId] = useState<ArenaMapId>(DEFAULT_MAP);
  const mapRef = useRef<ArenaMapId>(DEFAULT_MAP);
  const [recapOpen, setRecapOpen] = useState(false);
  const [dismissedRecap, setDismissedRecap] =
    useState<GameHudState['deathRecap']>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [onlineInMatch, setOnlineInMatch] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<
    | (OnlineGame & {
        dispose: () => void;
        requestPointerLock: () => void;
        selectWeapon: (weaponId: WeaponId) => void;
        playAgain: () => void;
        enterLobby: () => void;
        interactLobby: () => void;
      })
    | null
  >(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  useEffect(() => {
    if (status !== 'ready') return;
    try {
      if (/^[a-f0-9]{48}$/.test(sessionStorage.getItem(ROOM_SESSION_KEY) ?? ''))
        setOnlineOpen(true);
    } catch {
      /* Live reconnect works without storage. */
    }
  }, [status]);
  const [started, setStarted] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const difficultyRef = useRef<Difficulty>('normal');
  const [shopOpen, setShopOpen] = useState(false);
  const [error, setError] = useState('');
  const [hud, setHud] = useState(initialHud);
  const [orbs, setOrbs] = useState(0);
  const [orbReward, setOrbReward] = useState({ total: 0, matchBonus: 0 });
  const [orbsSaved, setOrbsSaved] = useState(true);
  const [uziOwned, setUziOwned] = useState(false);
  const [secondaryWeapon, setSecondaryWeapon] = useState<'pistol' | 'uzi'>(
    'pistol',
  );
  const secondaryRef = useRef<'pistol' | 'uzi'>('pistol');
  function equipSecondary(id: 'pistol' | 'uzi') {
    if (id === 'uzi' && !walletRef.current?.state.uziOwned) return;
    secondaryRef.current = id;
    setSecondaryWeapon(id);
    gameRef.current?.selectWeapon(id);
  }
  function buyUzi(): PurchaseResult {
    const result = walletRef.current?.buyUzi() ?? 'unavailable';
    syncWallet();
    return result;
  }
  const [molotovOwned, setMolotovOwned] = useState(false);
  const [utilityWeapon, setUtilityWeapon] = useState<'grenade' | 'molotov'>(
    'grenade',
  );
  const utilityRef = useRef<'grenade' | 'molotov'>('grenade');
  function equipUtility(id: 'grenade' | 'molotov') {
    if (id === 'molotov' && !walletRef.current?.state.molotovOwned) return;
    utilityRef.current = id;
    setUtilityWeapon(id);
    gameRef.current?.selectWeapon(id);
  }
  function buyMolotov(): PurchaseResult {
    const result = walletRef.current?.buyMolotov() ?? 'unavailable';
    syncWallet();
    return result;
  }
  const [rocketOwned, setRocketOwned] = useState(false);
  const [sniperOwned, setSniperOwned] = useState(false);
  const [orbiterOwned, setOrbiterOwned] = useState(false);
  const [orbClicks, setOrbClicks] = useState(0);
  const [primaryWeapon, setPrimaryWeapon] =
    useState<PrimaryWeaponId>('assaultRifle');
  const [meleeWeapon, setMeleeWeapon] = useState<'sword' | 'orbiter'>('sword');
  const meleeRef = useRef<'sword' | 'orbiter'>('sword');
  function equipMelee(id: 'sword' | 'orbiter') {
    if (id === 'orbiter' && !orbiterOwned) return;
    meleeRef.current = id;
    setMeleeWeapon(id);
    gameRef.current?.selectWeapon(id);
  }
  const primaryRef = useRef<PrimaryWeaponId>('assaultRifle');
  const walletRef = useRef<ReturnType<typeof createOrbWallet> | null>(null);

  function syncWallet() {
    const state = walletRef.current?.state;
    if (!state) return;
    setOrbs(state.orbs);
    setSniperOwned(state.sniperOwned);
    setRocketOwned(state.rocketOwned);
    setMolotovOwned(state.molotovOwned);
    setUziOwned(state.uziOwned);
    setOrbiterOwned(state.orbiterOwned);
    setOrbClicks(state.orbClicks);
    setOrbsSaved(state.saved);
    setStoreState(state);
    setDaily(walletRef.current!.dailyStatus());
    gameRef.current?.setCharacterAppearance(state.character);
  }
  function refreshStore() {
    walletRef.current?.refresh();
    syncWallet();
  }
  function buyCharacter(id: string) {
    const result = walletRef.current?.buyCharacter(id) ?? 'unavailable';
    syncWallet();
    return result;
  }
  function equipCharacter(id: string) {
    const result = walletRef.current?.equipCharacter(id) ?? false;
    syncWallet();
    return result;
  }
  function buyStoreCosmetic(id: number) {
    const result = walletRef.current?.buyCosmetic(id) ?? 'unavailable';
    syncWallet();
    return result;
  }
  function changeDaily(action: 'reroll' | 'upgrade') {
    const result = walletRef.current?.[
      action === 'reroll' ? 'rerollDaily' : 'upgradeDaily'
    ]() ?? { result: 'unavailable', message: 'Shop is loading.' };
    syncWallet();
    return result;
  }
  function claimDaily(choice: DailyChoice) {
    const result = walletRef.current?.claimDaily(choice) ?? {
      result: 'unavailable',
      message: 'Shop is loading.',
    };
    syncWallet();
    syncCareer();
    return result;
  }

  function buyRocket(): PurchaseResult {
    const result = walletRef.current?.buyRocket() ?? 'unavailable';
    syncWallet();
    return result;
  }
  function buySniper(): PurchaseResult {
    const result = walletRef.current?.buySniper() ?? 'unavailable';
    syncWallet();
    return result;
  }
  function clickOrb() {
    const result = walletRef.current?.clickOrb() ?? 'unavailable';
    syncWallet();
    return result;
  }

  function equipPrimary(id: PrimaryWeaponId) {
    if (id === 'laserCannon' && !hud.laserUnlocked) return;
    if (id === 'rocketLauncher' && !walletRef.current?.state.rocketOwned)
      return;
    if (id === 'sniper' && !walletRef.current?.state.sniperOwned) return;
    primaryRef.current = id;
    setPrimaryWeapon(id);
    // Changing a loadout does not refill either weapon's ammunition.
    gameRef.current?.selectWeapon(id);
  }
  const loadoutChoices: LoadoutChoices = {
    selected: [primaryWeapon, secondaryWeapon, meleeWeapon, utilityWeapon],
    unlockProgress: { laserPartsCount: hud.laserPartsCount, orbClicks },
    available: [
      [
        'assaultRifle',
        ...(sniperOwned ? ['sniper' as const] : []),
        ...(rocketOwned ? ['rocketLauncher' as const] : []),
        ...(hud.laserUnlocked ? ['laserCannon' as const] : []),
      ],
      ['pistol', ...(uziOwned ? ['uzi' as const] : [])],
      ['sword', ...(orbiterOwned ? ['orbiter' as const] : [])],
      ['grenade', ...(molotovOwned ? ['molotov' as const] : [])],
    ],
    choose: (id) => {
      if (id === 'pistol' || id === 'uzi') equipSecondary(id);
      else if (id === 'sword' || id === 'orbiter') equipMelee(id);
      else if (id === 'grenade' || id === 'molotov') equipUtility(id);
      else equipPrimary(id);
    },
  };

  useEffect(() => {
    let cancelled = false;
    const rewards = createOrbRewards();
    let storage: Storage | undefined;
    let rewardTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingReward = 0;
    let pendingMatchBonus = 0;
    try {
      storage = window.localStorage;
    } catch {
      setOrbsSaved(false);
    }
    const testWeapons = localWeaponTesting(
      import.meta.env.DEV,
      window.location.hostname,
    );
    walletRef.current = createOrbWallet(storage, testWeapons);
    syncWallet();
    const loadProgression = () => {
      progressionRef.current = createProgression(
        storage,
        () => walletRef.current?.state.cosmeticOwned ?? [],
      );
      syncCareer();
    };
    loadProgression();
    const storageChanged = (event: StorageEvent) => {
      if (event.key === WALLET_STORAGE_KEY || event.key === PROGRESSION_KEY) {
        refreshStore();
        loadProgression();
      }
    };
    window.addEventListener('storage', storageChanged);
    // Free local test unlocks do not change the default Vesper loadout.
    async function startEngine() {
      try {
        // Babylon is loaded in the browser only, keeping the server build simple.
        const { createGame } = await import('@/game/createGame');
        if (!canvasRef.current || cancelled) return;
        gameRef.current = createGame(
          canvasRef.current,
          (update) => {
            if (cancelled) return;
            if (update.playerScore !== undefined)
              botScoresRef.current[0] = update.playerScore;
            if (update.botScore !== undefined)
              botScoresRef.current[1] = update.botScore;
            awardXp(
              botXpRef.current.update(
                botScoresRef.current,
                update.result ?? 'none',
                difficultyRef.current,
                update.elimination,
              ),
              botXpRef.current.bonuses,
            );
            const earned = rewards.update(update, difficultyRef.current);
            if (earned > 0) {
              walletRef.current?.award(earned);
              syncWallet();
              // The final round and victory arrive separately; combine their popup.
              pendingReward += earned;
              if (update.result === 'victory') {
                pendingMatchBonus +=
                  DIFFICULTY_ORB_REWARDS[difficultyRef.current].matchWin;
              }
              setOrbReward({
                total: pendingReward,
                matchBonus: pendingMatchBonus,
              });
              clearTimeout(rewardTimer);
              rewardTimer = setTimeout(() => {
                pendingReward = 0;
                pendingMatchBonus = 0;
                setOrbReward({ total: 0, matchBonus: 0 });
              }, 5000);
            }
            setHud((current) => ({ ...current, ...update }));
          },
          (id) =>
            id === 'uzi'
              ? walletRef.current?.state.uziOwned === true
              : id === 'molotov'
                ? walletRef.current?.state.molotovOwned === true
                : id === 'rocketLauncher'
                  ? walletRef.current?.state.rocketOwned === true
                  : id === 'orbiter'
                    ? walletRef.current?.state.orbiterOwned === true
                    : id !== 'sniper' ||
                      walletRef.current?.state.sniperOwned === true,
          () => primaryRef.current,
          () => difficultyRef.current,
          () => meleeRef.current,
          (station) => {
            if (station === 'armory') setShopOpen(true);
            else setSetupOpen(true);
          },
          () => utilityRef.current,
          () => secondaryRef.current,
          () => cosmeticsRef.current,
        );
        syncCareer();
        syncWallet();
        setStatus('ready');
        clearModuleRetry();
      } catch (caught) {
        if (cancelled) return;
        if (recoverModuleLoad(caught)) return;
        console.error(caught);
        setError(
          caught instanceof Error
            ? caught.message
            : 'The 3D engine could not start.',
        );
        setStatus('error');
      }
    }

    startEngine();
    return () => {
      cancelled = true;
      clearTimeout(rewardTimer);
      if (xpTimer.current) clearTimeout(xpTimer.current);
      botXpRef.current.stop();
      window.removeEventListener('storage', storageChanged);
      gameRef.current?.dispose();
    };
  }, []);

  function enterArena() {
    if (status !== 'ready') return;
    gameRef.current?.enterLobby();
    gameRef.current?.setPreMatchLocked(true);
    setNameConfirmed(false);
    setStarted(false);
    setShopOpen(false);
    setSetupOpen(false);
    setSelecting(true);
  }
  function finishSelection() {
    setSelecting(false);
    setStarted(true);
    setSetupOpen(false);
    botScoresRef.current = [0, 0];
    botXpRef.current.begin();
    gameRef.current?.setPreMatchLocked(false);
    const choices = mapsForTeams(teamSizeRef.current);
    const selectedMap = choices.includes(mapRef.current)
      ? mapRef.current
      : choices[0];
    mapRef.current = selectedMap;
    setMapId(selectedMap);
    gameRef.current?.setArenaMap(selectedMap);
    gameRef.current?.setBotTeamSize(teamSizeRef.current);
    gameRef.current?.playAgain();
  }

  function returnToLobby() {
    botXpRef.current.stop();
    setSelecting(false);
    gameRef.current?.enterLobby();
    setRecapOpen(false);
    setStarted(false);
    setSetupOpen(false);
  }

  function playAgain() {
    enterArena();
  }

  function selectWeapon(weaponId: WeaponId) {
    if (hud.dead || hud.roundWon || hud.result !== 'none') return;
    gameRef.current?.selectWeapon(weaponId);
    if (document.pointerLockElement !== canvasRef.current) {
      gameRef.current?.requestPointerLock();
    }
  }

  return (
    <main
      className={`game-shell ${preferences.reducedMotion ? 'reduced-motion' : ''} ${started ? 'bot-match' : ''} ${onlineOpen && onlineInMatch ? 'online-match' : ''} ${!started && !selecting && (setupOpen || onlineOpen) && !(onlineOpen && onlineInMatch) ? 'setup-view' : ''}`}
    >
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="Edgefront Arena game"
      />
      <GameHeader
        compact={started || (onlineOpen && onlineInMatch)}
        visible={!selecting && status === 'ready'}
        dailyReward={daily.available}
        onArmory={openArmory}
        onLevels={openCareer}
        onCosmetics={openCosmetics}
        onCharacter={openCharacterShop}
        onControls={() => openGuide('controls')}
        onSettings={() => openGuide('settings')}
      />
      {status !== 'ready' && (
        <GameStatus
          status={status}
          error={error}
          onReload={() => window.location.reload()}
        />
      )}
      {guideSection && (
        <GamePreferencesDialog
          preferences={preferences}
          initialSection={guideSection}
          onChange={updateGamePreferences}
          onReset={resetGamePreferences}
          onClose={() => setGuideSection(null)}
          online={onlineInMatch}
        />
      )}
      {!selecting && !setupOpen && !onlineOpen && (
        <div className={`career-dock ${started ? 'match' : 'lobby'}`}>
          {!started && (
            <div className="career-orbs">
              ◈ {orbs.toLocaleString()} <span>ORBS</span>
            </div>
          )}
          <ProgressionBar
            state={career}
            onOpen={openCareer}
            compact={started}
          />
        </div>
      )}
      {careerOpen && (
        <ProgressionPanel
          key={careerSection}
          initialSection={careerSection}
          onOpenArmory={openArmory}
          state={career}
          onEquip={equipCosmetic}
          onClose={() => setCareerOpen(false)}
        />
      )}
      {characterShopOpen && (
        <CharacterShop
          state={storeState}
          daily={daily}
          cosmetics={career.cosmetics}
          onClose={() => setCharacterShopOpen(false)}
          onBuyCharacter={buyCharacter}
          onEquipCharacter={equipCharacter}
          onBuyCosmetic={buyStoreCosmetic}
          onEquipCosmetic={equipCosmetic}
          onClaim={claimDaily}
          onChangeDaily={changeDaily}
          onRefresh={refreshStore}
        />
      )}
      <div className="reward-feed">
        {xpNotice.amount > 0 && (
          <output className="progression-toast">
            <strong>
              +{xpNotice.amount} XP
              {xpNotice.after > xpNotice.before
                ? ` · Level ${xpNotice.after}!`
                : ''}
            </strong>
            {xpNotice.bonuses.length > 0 && (
              <small>
                {xpNotice.bonuses.join(' · ')} · mode multiplier applied
              </small>
            )}
            {xpNotice.after > xpNotice.before && (
              <small>
                +{(xpNotice.after - xpNotice.before) * 15} Orbs ·{' '}
                {`${rewardAt(xpNotice.after)?.name} unlocked`}
              </small>
            )}
          </output>
        )}
        {orbReward.total > 0 && (
          <output className="career-orb-toast">
            ◈ +{orbReward.total} Orbs earned
          </output>
        )}
      </div>

      {started && (
        <div className="combat-hud" aria-live="polite">
          {!hud.dead && !hud.spectator && <AimOverlay scoped={hud.scoped} />}
          <section
            className="scoreboard"
            aria-label={`Match score: ${teamSize === 1 ? playerName || 'Player1' : 'Cyan team'} ${hud.playerScore}, ${teamSize === 1 ? 'Rook' : 'Coral team'} ${hud.botScore}. First to 5.`}
          >
            <div className="score-side player-side">
              <span>
                {teamSize === 1 ? playerName || 'Player1' : 'Cyan team'}{' '}
                <LevelBadge level={career.level} />
              </span>
              <strong>{hud.playerScore}</strong>
            </div>
            <div className="score-goal">
              <span>First to</span>
              <strong>5</strong>
            </div>
            <div className="score-side bot-side">
              <span>{teamSize === 1 ? 'Rook' : 'Coral team'}</span>
              <strong>{hud.botScore}</strong>
            </div>
          </section>
          {hud.participants && (
            <MatchRoster
              players={hud.participants.map((p) =>
                p.slot === 0
                  ? { ...p, name: playerName || 'Player1', level: career.level }
                  : p,
              )}
              localSlot={0}
              team={0}
              spectator={hud.spectator}
              onSelect={(slot) => gameRef.current?.spectatePlayer(slot)}
            />
          )}
          {hud.participants && (
            <MatchRoster
              players={hud.participants}
              localSlot={0}
              team={1}
              opposing
              spectator={hud.spectator}
              onSelect={(slot) => gameRef.current?.spectatePlayer(slot)}
            />
          )}
          {hud.spectator &&
            (!hud.dead ||
              hud.deathRecap === dismissedRecap ||
              !hud.deathRecap) && (
              <SpectatorControls
                state={hud.spectator}
                intermission={!!hud.teamIntermission || teamSize === 1}
                onCycle={(direction) =>
                  gameRef.current?.cycleSpectator(direction)
                }
                onRecap={hud.deathRecap ? () => setRecapOpen(true) : undefined}
              />
            )}
          {hud.damageId > 0 && (
            <div
              key={hud.damageId}
              className="damage-flash"
              aria-hidden="true"
            />
          )}
          {hud.weaponId === 'orbiter' &&
            !hud.paused &&
            !hud.dead &&
            !hud.roundWon &&
            hud.result === 'none' && (
              <p className={`grapple-hint ${hud.grappleState}`} role="status">
                {
                  {
                    idle: 'Aim at solid cover · Hold E / right-click to grapple',
                    miss: 'No solid target within 35 m · Release and try again',
                    throwing: 'Orbiter thrown · Keep holding',
                    pulling: 'Pulling · Hold to cling, release to detach',
                    clinging: 'Clinging · Release E / right-click to drop',
                    blocked: 'Tether blocked · Release and aim again',
                  }[hud.grappleState]
                }
              </p>
            )}
          {hud.weaponId === 'sword' &&
            !hud.paused &&
            !hud.dead &&
            hud.result === 'none' && (
              <p className="grapple-hint">
                {hud.swordBoostState === 'ready'
                  ? 'E · Speed boost ready'
                  : `${hud.swordBoostState === 'boosting' ? 'Speed boost' : 'Cooldown'} · ${hud.swordBoostSeconds}s`}
              </p>
            )}
          {hud.hitMarker !== 'none' && (
            <div
              key={hud.hitId}
              className={`hit-marker ${hud.hitMarker}`}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {!hud.dead && !hud.roundWon && hud.result === 'none' && (
            <nav className="weapon-selector" aria-label="Weapon slots">
              <button
                type="button"
                className={`weapon-slot ${hud.weaponId === primaryWeapon ? 'active' : ''}`}
                aria-pressed={hud.weaponId === primaryWeapon}
                onClick={() => selectWeapon(primaryWeapon)}
              >
                <span className="weapon-slot-kind">Primary</span>
                <strong>
                  {primaryWeapon === 'laserCannon'
                    ? 'Helion'
                    : primaryWeapon === 'rocketLauncher'
                      ? 'Comet'
                      : primaryWeapon === 'sniper'
                        ? 'Meridian'
                        : 'Kestrel AR'}
                </strong>
                <kbd>1</kbd>
              </button>
              <button
                type="button"
                className={`weapon-slot ${hud.weaponId === secondaryWeapon ? 'active' : ''}`}
                aria-pressed={hud.weaponId === secondaryWeapon}
                onClick={() => selectWeapon(secondaryWeapon)}
              >
                <span className="weapon-slot-kind">Secondary</span>
                <strong>
                  {secondaryWeapon === 'uzi' ? 'Flux Uzi' : 'Vesper'}
                </strong>
                <kbd>2</kbd>
              </button>
              <button
                type="button"
                className={`weapon-slot ${hud.weaponId === meleeWeapon ? 'active' : ''}`}
                aria-pressed={hud.weaponId === meleeWeapon}
                onClick={() => selectWeapon(meleeWeapon)}
              >
                <span className="weapon-slot-kind">Melee</span>
                <strong>
                  {meleeWeapon === 'sword' ? 'Vector Sword' : 'Orbiter'}
                </strong>
                <kbd>3</kbd>
              </button>
              <button
                type="button"
                className={`weapon-slot ${hud.weaponId === utilityWeapon ? 'active' : ''}`}
                aria-pressed={hud.weaponId === utilityWeapon}
                onClick={() => selectWeapon(utilityWeapon)}
              >
                <span className="weapon-slot-kind">Utility</span>
                <strong>
                  {utilityWeapon === 'molotov'
                    ? 'Ember Molotov'
                    : 'Pulse Grenade'}
                </strong>
                <kbd>4</kbd>
              </button>
            </nav>
          )}
          <div className="ammo-panel">
            <div>
              <span className="weapon-name">{hud.weaponName}</span>
              <span className="fire-mode">{hud.fireMode}</span>
            </div>
            <div className="ammo-row">
              {hud.weaponId === 'laserCannon' ? (
                <>
                  <strong>{hud.ammo}%</strong>
                  <span>ENERGY</span>
                </>
              ) : hud.fireMode === 'Melee' ? (
                <strong style={{ fontSize: '24px' }}>Melee</strong>
              ) : (
                <>
                  <strong>{hud.ammo}</strong>
                  <span>/ {hud.reserveAmmo}</span>
                </>
              )}
            </div>
            {hud.weaponId === 'laserCannon' && (
              <div className="laser-energy">
                <div
                  role="progressbar"
                  aria-label="Laser energy"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={hud.ammo}
                >
                  <i style={{ width: `${hud.ammo}%` }} />
                </div>
                <small>
                  {hud.reloading
                    ? 'Recharging'
                    : hud.ammo < 3
                      ? 'Low energy · Release fire to recharge'
                      : 'Release fire · Recharge after 1.5s'}
                </small>
              </div>
            )}
            <div
              className={`reload-status ${hud.reloading && hud.weaponId !== 'laserCannon' ? 'visible' : ''}`}
            >
              Reloading
            </div>
          </div>
          <div className="health-panel">
            <div className="health-heading">
              <span>Vital integrity</span>
              <strong>{hud.health}</strong>
            </div>
            <div className="health-track">
              <i
                style={{
                  width: `${Math.min(100, (hud.health / hud.maxHealth) * 100)}%`,
                }}
              />
            </div>
            <div className="health-caption">HP / {hud.maxHealth}</div>
          </div>
          {teamSize === 1 && !hud.participants && (
            <div className="health-panel bot-health-panel">
              <div className="health-heading">
                <span>Rook · {DIFFICULTIES[difficulty].label}</span>
                <strong>{hud.botHealth}</strong>
              </div>
              <div className="health-track">
                <i style={{ width: `${hud.botHealth}%` }} />
              </div>
              <div className="health-caption">HP / 100</div>
            </div>
          )}
          <span className="bot-map-label">
            {ARENA_MAPS[mapId].name} · {ARENA_MAPS[mapId].difficulty} terrain
          </span>
          {hud.deathRecap && (
            <button
              className="recap-shortcut"
              onClick={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setRecapOpen(true);
              }}
            >
              Last death recap
            </button>
          )}
          {recapOpen && hud.deathRecap && (
            <DeathRecapDialog
              recap={hud.deathRecap}
              onClose={() => setRecapOpen(false)}
            />
          )}
          {hud.dead && hud.deathRecap && hud.deathRecap !== dismissedRecap && (
            <div className="respawn-overlay">
              <strong>Eliminated</strong>
              <span>
                {teamSize > 1 && !hud.teamIntermission
                  ? 'Your team is still fighting · next round after team elimination'
                  : 'Intermission · 3 seconds'}
              </span>
              {hud.deathRecap && (
                <DeathRecap
                  recap={hud.deathRecap}
                  onClose={() => setDismissedRecap(hud.deathRecap)}
                  onPlaybackComplete={() => setDismissedRecap(hud.deathRecap)}
                />
              )}
            </div>
          )}
          {hud.roundWon && hud.result === 'none' && (
            <div className="respawn-overlay round-win-overlay">
              <strong>You win</strong>
              <span>Round secured · next round in 3 seconds</span>
            </div>
          )}
          {hud.awaitingFirstInput && hud.result === 'none' && !hud.dead && (
            <section className="match-enter-screen" aria-label="Start match">
              <button
                className="primary-button"
                onClick={() => gameRef.current?.requestPointerLock()}
              >
                Enter arena
              </button>
            </section>
          )}
          {hud.paused &&
            !hud.awaitingFirstInput &&
            hud.result === 'none' &&
            !hud.dead && (
              <section
                className="pause-screen polished-pause"
                aria-labelledby="pause-title"
              >
                <p>Match paused</p>
                <h2 id="pause-title">Ready when you are</h2>
                <span>
                  Your cursor is released. Click Resume to get back in.
                </span>
                <div className="pause-actions">
                  <button
                    className="polish-button emphasized"
                    onClick={() => gameRef.current?.requestPointerLock()}
                  >
                    Resume
                  </button>
                  <button
                    className="polish-button"
                    onClick={() => openGuide('settings')}
                  >
                    Settings
                  </button>
                  <button className="polish-button" onClick={openArmory}>
                    Armory
                  </button>
                  <button className="polish-button" onClick={returnToLobby}>
                    Return to lobby
                  </button>
                </div>
              </section>
            )}
          {hud.result !== 'none' &&
            (!hud.dead ||
              !hud.deathRecap ||
              hud.deathRecap === dismissedRecap) && (
              <MatchSummary
                result={hud.result}
                scores={[hud.playerScore, hud.botScore]}
                sides={[
                  teamSize === 1 ? playerName || 'Player1' : 'Cyan team',
                  teamSize === 1 ? 'Rook' : 'Coral team',
                ]}
                detail={`${teamSize}v${teamSize} · ${ARENA_MAPS[mapId].name} · ${DIFFICULTIES[difficulty].label}`}
                onReplay={playAgain}
                onLobby={returnToLobby}
                onRecap={hud.deathRecap ? () => setRecapOpen(true) : undefined}
              />
            )}
        </div>
      )}

      {selecting &&
        gameRef.current &&
        (nameConfirmed ? (
          <LoadoutSelection
            game={gameRef.current}
            loadout={loadoutChoices}
            onComplete={finishSelection}
          />
        ) : (
          <NameSelection
            game={gameRef.current}
            onConfirm={(name) => {
              setPlayerName(name);
              setNameConfirmed(true);
            }}
            onBack={returnToLobby}
          />
        ))}
      {!started && !setupOpen && !onlineOpen && !selecting && (
        <section className="lobby-hud" aria-label="Edgefront lobby">
          <div className="lobby-heading">
            <p>CONCOURSE / 01</p>
            <h1>Edgefront Atrium</h1>
            <span>Armory ↖ · Duel deck ↑ · Lounge ↗</span>
          </div>
          <div
            className={`laser-quest ${hud.laserUnlocked ? 'complete' : ''}`}
            aria-live="polite"
          >
            <span>SECRET PROJECT / HELION</span>
            <strong>
              {hud.laserUnlocked
                ? 'Helion unlocked · Equip in Armory'
                : `${hud.laserPartsCount} / 5 parts recovered`}
            </strong>
            {hud.laserNotice && (
              <small key={hud.laserNotice}>{hud.laserNotice}</small>
            )}
            {!hud.laserProgressSaved && (
              <small>
                Progress is session-only: browser saving is unavailable.
              </small>
            )}
          </div>
          <div className="lobby-actions">
            {hud.nearbyLaserPart && (
              <button
                className="lobby-interact"
                onClick={() => gameRef.current?.interactLobby()}
              >
                <kbd>E</kbd>
                <span>
                  Collect {hud.nearbyLaserPart}
                  <small>Helion component</small>
                </span>
              </button>
            )}
            {!hud.nearbyLaserPart && hud.lobbyStation && (
              <button
                className="lobby-interact"
                onClick={() => gameRef.current?.interactLobby()}
              >
                <kbd>E</kbd>
                <span>
                  {hud.lobbyStation === 'armory'
                    ? 'Open armory'
                    : 'Enter duel deck'}
                  <small>
                    {hud.lobbyStation === 'armory'
                      ? 'Weapons & loadout'
                      : 'Choose difficulty · Start a match'}
                  </small>
                </span>
              </button>
            )}
            {!hud.nearbyLaserPart && !hud.lobbyStation && (
              <p>Walk to a glowing terminal · Press E nearby to interact</p>
            )}
            {status === 'ready' && hud.paused && (
              <button
                className="primary-button shop-open-button"
                onClick={() => gameRef.current?.requestPointerLock()}
              >
                Click to explore
              </button>
            )}
            {status === 'loading' && <p>Preparing atrium…</p>}
            <button
              className="primary-button shop-open-button"
              onClick={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setSetupOpen(true);
              }}
            >
              Play menu
            </button>
            <p className="lobby-controls">
              WASD move · Mouse look · E interact · Esc cursor
            </p>
            {status === 'error' && (
              <div className="error-message" role="alert">
                {error}
                <button
                  className="primary-button"
                  onClick={() => window.location.reload()}
                >
                  Reload game
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {!started && onlineOpen && (
        <TeamOnlineRooms
          character={storeState.character}
          career={career}
          onXp={awardXp}
          game={gameRef.current}
          loadout={loadoutChoices}
          paused={hud.paused}
          spectator={hud.spectator ?? null}
          onMatchStateChange={setOnlineInMatch}
          ammo={hud}
          onNameChange={setPlayerName}
          onOpenCareer={openCareer}
          onBack={() => {
            setOnlineOpen(false);
            setSetupOpen(true);
          }}
        />
      )}
      {!started && setupOpen && !onlineOpen && (
        <section className="start-screen" aria-labelledby="game-title">
          <div className="start-card">
            <div className="setup-actions">
              <button
                className="primary-button shop-open-button"
                onClick={() => setSetupOpen(false)}
              >
                Back to lobby
              </button>
              <button
                className="primary-button shop-open-button"
                disabled={status !== 'ready'}
                onClick={() => {
                  if (document.pointerLockElement) document.exitPointerLock();
                  setOnlineOpen(true);
                }}
              >
                Online · 1v1 to 5v5
              </button>
              <button
                className="primary-button shop-open-button"
                onClick={openCareer}
              >
                Level rewards & cosmetics
              </button>
            </div>
            <p className="eyebrow">Team training protocol</p>
            <h1 id="game-title">
              Edgefront <span>Arena</span>
            </h1>
            <p className="intro">
              Train against Rook bots, with allies in team matches, across
              futuristic arenas. The first team to win five rounds wins the
              match.
            </p>
            <TeamSizePicker
              value={teamSize}
              onChange={(size) => {
                teamSizeRef.current = size;
                setTeamSize(size);
                const choices = mapsForTeams(size);
                const id = choices[0];
                mapRef.current = id;
                setMapId(id);
              }}
            />
            <MapPicker
              teamSize={teamSize}
              value={mapId}
              onChange={(id) => {
                mapRef.current = id;
                setMapId(id);
              }}
            />
            <p className="bot-map-note">
              Bot training uses your selected map. Map voting is for online
              matches.
            </p>
            <fieldset className="difficulty-picker">
              <legend>Rook difficulty</legend>
              <div className="difficulty-options">
                {(Object.keys(DIFFICULTIES) as Difficulty[]).map((id) => (
                  <label
                    key={id}
                    style={
                      {
                        '--difficulty-color': DIFFICULTIES[id].color,
                      } as React.CSSProperties
                    }
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={id}
                      checked={difficulty === id}
                      onChange={() => {
                        difficultyRef.current = id;
                        setDifficulty(id);
                      }}
                    />
                    <span>{DIFFICULTIES[id].label}</span>
                  </label>
                ))}
              </div>
              <p aria-live="polite">{DIFFICULTIES[difficulty].description}</p>
              <small>
                Rook: 100 HP · Kestrel AR · Same damage on every difficulty
              </small>
              <small>
                Rewards: +{DIFFICULTY_ORB_REWARDS[difficulty].roundWin} Orbs per
                round won · +{DIFFICULTY_ORB_REWARDS[difficulty].matchWin} extra
                match-win bonus
              </small>
            </fieldset>
            <details className="setup-controls">
              <summary>Controls & movement guide</summary>
              <div className="controls-row" aria-label="Controls">
                <span className="control-chip">
                  <kbd>Lobby: E</kbd> Open a nearby Armory or Duel deck terminal
                </span>
                <span className="control-chip">
                  <kbd>Helion: Hold click</kbd> Beam drains energy · Release to
                  recharge · Requires 5 parts
                </span>
                <span className="control-chip">
                  <kbd>WASD</kbd> Move
                </span>
                <span className="control-chip">
                  <kbd>Mouse</kbd> Look around
                </span>
                <span className="control-chip">
                  <kbd>Click</kbd> Fire / Melee · Hold for AR
                </span>
                <span className="control-chip">
                  <kbd>Q Toggle / Right click</kbd> Aim guns
                </span>
                <span className="control-chip">
                  <kbd>Grenade: 4 + Click</kbd> 2s fuse · 34 damage · 4m blast ·
                  One per life · No self-damage
                </span>
                <span className="control-chip">
                  <kbd>4 · Click</kbd> Throw chosen utility · Molotov burns for
                  5 seconds · No self-damage
                </span>
                <span className="control-chip">
                  <kbd>Blast jump</kbd> Explode a grenade or rocket near your
                  feet · WASD steers in air · No self-damage
                </span>
                <span className="control-chip">
                  <kbd>Sword: E</kbd> Speed boost 5s · Then cooldown 5s
                </span>
                <span className="control-chip grapple-control">
                  <kbd>Orbiter: Hold E / Right click</kbd> Aim at solid cover ·
                  Pull and cling · Release to drop
                </span>
                <span className="control-chip">
                  <kbd>R</kbd> Reload
                </span>
                <span className="control-chip">
                  <kbd>1 / 2 / 3 / 4</kbd> Primary / Secondary / Melee / Utility
                </span>
                <span className="control-chip">
                  <kbd>Double-tap W</kbd> Sprint
                </span>
                <span className="control-chip">
                  <kbd>C / Ctrl Toggle</kbd> Crouch
                </span>
                <span className="control-chip">
                  <kbd>Hold Shift</kbd> Slide from standing or moving · No
                  cooldown
                </span>
                <span className="control-chip">
                  <kbd>Space</kbd> Jump
                </span>
                <span className="control-chip">
                  <kbd>Esc</kbd> Release cursor
                </span>
              </div>
            </details>
            <div className="setup-launch">
              <p>
                {teamSize}v{teamSize} · {ARENA_MAPS[mapId].name} ·{' '}
                {DIFFICULTIES[difficulty].label}
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={
                  status === 'error'
                    ? () => window.location.reload()
                    : enterArena
                }
                disabled={status === 'loading'}
              >
                {status === 'loading'
                  ? 'Preparing arena…'
                  : status === 'error'
                    ? 'Reload game'
                    : 'Choose name & loadout'}
              </button>
            </div>
            {status === 'loading' && (
              <p className="loading-line">Calibrating the arena renderer…</p>
            )}
            {status === 'error' && (
              <div className="error-message" role="alert">
                <p>
                  The game could not load. Try Reload game. If you are using
                  localhost, the local game server must be running.
                </p>
                <details>
                  <summary>Technical details</summary>
                  {error}
                </details>
              </div>
            )}
            <button
              className="primary-button shop-open-button"
              type="button"
              onClick={() => setShopOpen(true)}
            >
              Weapon shop
            </button>
          </div>
        </section>
      )}

      <WeaponShop
        cosmetics={career.cosmetics}
        onOpenLevels={openCareer}
        onOpenCosmetics={openCosmetics}
        onOpenCharacterShop={openCharacterShop}
        uziOwned={uziOwned}
        onBuyUzi={buyUzi}
        secondaryWeapon={secondaryWeapon}
        onEquipSecondary={equipSecondary}
        molotovOwned={molotovOwned}
        onBuyMolotov={buyMolotov}
        utilityWeapon={utilityWeapon}
        onEquipUtility={equipUtility}
        laserOwned={hud.laserUnlocked}
        laserPartsCount={hud.laserPartsCount}
        difficulty={difficulty}
        rocketOwned={rocketOwned}
        onBuyRocket={buyRocket}
        meleeWeapon={meleeWeapon}
        onEquipMelee={equipMelee}
        open={shopOpen}
        onOpenChange={setShopOpen}
        orbs={orbs}
        orbsSaved={orbsSaved}
        sniperOwned={sniperOwned}
        onBuySniper={buySniper}
        primaryWeapon={primaryWeapon}
        onEquipPrimary={equipPrimary}
        orbiterOwned={orbiterOwned}
        orbClicks={orbClicks}
        onOrbClick={clickOrb}
      />
      {started && (
        <div className="pause-hint">
          ESC releases your mouse · Weapon shop in pause menu
        </div>
      )}
    </main>
  );
}
