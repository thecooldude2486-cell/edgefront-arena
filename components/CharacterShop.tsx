'use client';

import { RarityBadge } from './RarityBadge';
('use client');
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  CHARACTER_ITEMS,
  DEFAULT_CHARACTER,
  DAILY_REWARDS,
  STORE_COSMETICS,
  characterItem,
  type CharacterAppearance,
  type CharacterSlot,
  type DailyChoice,
} from '@/game/storeCatalog';
import type { createOrbWallet, PurchaseResult } from '@/game/createOrbWallet';
import {
  rewardAt,
  type Cosmetics,
  type CosmeticKind,
} from '@/game/progression';
import { CosmeticPreview, WrapSwatch } from './Progression';
import './CharacterShop.css';
type StoreState = ReturnType<typeof createOrbWallet>['state'];
type DailyStatus = ReturnType<
  ReturnType<typeof createOrbWallet>['dailyStatus']
>;
function CharacterArt({ appearance }: { appearance: CharacterAppearance }) {
  const suit = characterItem(appearance.suit)!,
    visor = characterItem(appearance.visor)!;
  return (
    <svg
      viewBox="0 0 200 290"
      aria-label={`${suit.name}, ${visor.name}, ${characterItem(appearance.gear)?.name}`}
    >
      <ellipse cx="100" cy="272" rx="66" ry="9" fill="#06151f" />
      <path
        d="M68 119 61 198 77 210 82 156h36l5 54 16-12-7-79Z"
        fill={suit.color}
      />
      <path d="m71 115 10 40h38l10-40-6-37H77Z" fill={suit.color} />
      <path d="m80 91-8 29 13 22h30l13-22-8-29Z" fill={suit.accent} />
      <path d="M82 112h36v6H82Z" fill={suit.color} />
      <path
        d="m64 92-13 7-9 69 20 5 10-42m64-39 13 7 9 69-20 5-10-42"
        fill={suit.color}
      />
      <path d="m51 98 13-7 5 22-19 6m99-21-13-7-5 22 19 6" fill={suit.accent} />
      <path d="m43 165 20 5-3 21-18-5m115-21-20 5 3 21 18-5" fill="#182733" />
      <path d="M77 182h18v59H75Zm28 0h18l2 59h-20Z" fill={suit.accent} />
      <path d="M74 234h23v26H70Zm29 0h23l4 26h-27Z" fill="#182733" />
      <path d="M80 46 100 38l20 8 6 27-14 17H88L74 73Z" fill={suit.accent} />
      <path d="m80 62 20-5 20 5-4 13H84Z" fill={visor.color} />
      <path d="M83 65h34" stroke={visor.accent} strokeWidth="3" />
      {appearance.gear === 'signal' && (
        <>
          <path d="M80 47 76 18" stroke="#182733" strokeWidth="5" />
          <circle cx="76" cy="17" r="5" fill={suit.color} />
        </>
      )}
      {appearance.gear === 'crest' && (
        <path d="m93 43 1-18h12l1 18" fill={suit.color} />
      )}
      {appearance.gear === 'halo' && (
        <ellipse
          cx="100"
          cy="26"
          rx="34"
          ry="8"
          fill="none"
          stroke={suit.color}
          strokeWidth="5"
        />
      )}
    </svg>
  );
}
function CharacterPreview({ appearance }: { appearance: CharacterAppearance }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(appearance),
    [ready, setReady] = useState(false);
  useEffect(() => {
    latest.current = appearance;
  }, [appearance]);
  useEffect(() => {
    let cancelled = false,
      dispose: (() => void) | undefined;
    void import('@/game/createCharacterPreview')
      .then(({ createCharacterPreview }) => {
        if (!cancelled && canvas.current) {
          dispose = createCharacterPreview(
            canvas.current,
            () => latest.current,
          );
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  return (
    <div className={`character-preview ${ready ? 'ready' : ''}`}>
      <CharacterArt appearance={appearance} />
      <canvas ref={canvas} aria-label="Your character. Drag to rotate." />
      <small>{ready ? 'DRAG TO ROTATE' : 'CHARACTER PREVIEW'}</small>
    </div>
  );
}
export function CharacterShop({
  state,
  daily,
  cosmetics,
  onClose,
  onBuyCharacter,
  onEquipCharacter,
  onBuyCosmetic,
  onEquipCosmetic,
  onClaim,
  onChangeDaily,
  onRefresh,
}: {
  state: StoreState;
  daily: DailyStatus;
  cosmetics: Cosmetics;
  onClose: () => void;
  onBuyCharacter: (id: string) => PurchaseResult;
  onEquipCharacter: (id: string) => boolean;
  onBuyCosmetic: (id: number) => PurchaseResult;
  onEquipCosmetic: (kind: CosmeticKind, id: number | null) => void;
  onClaim: (choice: DailyChoice) => { result: string; message: string };
  onChangeDaily: (action: 'reroll' | 'upgrade') => {
    result: string;
    message: string;
  };
  onRefresh: () => void;
}) {
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);
  const dialog = useRef<HTMLDialogElement>(null),
    [tab, setTab] = useState<'character' | 'cosmetics' | 'daily'>('character'),
    [slot, setSlot] = useState<CharacterSlot>('suit');
  const [inspected, setInspected] = useState<CharacterAppearance | null>(null),
    [cosmetic, setCosmetic] = useState<number | null>(null),
    [choice, setChoice] = useState<DailyChoice>('wrap'),
    [notice, setNotice] = useState('');
  useEffect(() => {
    dialog.current?.focus();
    const timer = setInterval(() => refreshRef.current(), 30000);
    return () => clearInterval(timer);
  }, []);
  const inspect = inspected ?? state.character,
    preview = cosmetic === null ? null : rewardAt(cosmetic);
  const result = (value: PurchaseResult) =>
    setNotice(
      value === 'insufficient'
        ? 'Not enough Orbs yet.'
        : value === 'unavailable'
          ? 'Could not save. Your Orbs were not spent.'
          : value === 'purchased'
            ? 'Unlocked. Choose Equip to wear it.'
            : 'Already owned.',
    );
  const claimed = Math.min(7, state.dailyClaims);
  return (
    <dialog
      open
      ref={dialog}
      tabIndex={-1}
      className="character-store"
      aria-modal="true"
      aria-labelledby="character-shop-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="character-store-inner">
        <header>
          <div>
            <p className="store-kicker">EDGEFRONT / OUTFITTER</p>
            <h2 id="character-shop-title">Your character. Your style.</h2>
          </div>
          <button onClick={onClose} aria-label="Close character shop">
            ✕
          </button>
        </header>
        <nav className="store-tabs" aria-label="Shop categories">
          {(['character', 'cosmetics', 'daily'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={tab === value}
              onClick={() => {
                setTab(value);
                setNotice('');
              }}
            >
              {value === 'character'
                ? 'Character'
                : value === 'cosmetics'
                  ? 'Weapon cosmetics'
                  : 'Daily rewards'}
              {value === 'daily' && daily.available && <i />}
            </button>
          ))}
          <strong>
            ◈ {state.orbs.toLocaleString()} <small>ORBS</small>
          </strong>
        </nav>
        {notice && <output className="store-notice">{notice}</output>}
        {tab === 'character' && (
          <div className="outfitter-layout">
            <section className="outfitter-inspect">
              <CharacterPreview appearance={inspect} />
              <p>
                {inspected
                  ? 'Preview · Equip to wear this look'
                  : 'Your equipped character'}
              </p>
              <dl>
                {(['suit', 'visor', 'gear'] as const).map((kind) => (
                  <div key={kind}>
                    <dt>{kind}</dt>
                    <dd>
                      {characterItem(state.character[kind])?.name}
                      <RarityBadge
                        rarity={
                          characterItem(state.character[kind])?.rarity ??
                          'common'
                        }
                      />
                    </dd>
                    <button
                      disabled={
                        state.character[kind] === DEFAULT_CHARACTER[kind]
                      }
                      onClick={() => {
                        onEquipCharacter(DEFAULT_CHARACTER[kind]);
                        setInspected(null);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                ))}
              </dl>
              <small>
                Your suit changes your gloves. Online opponents see your
                complete character.
              </small>
            </section>
            <section>
              <nav className="store-filter" aria-label="Character gear">
                {(['suit', 'visor', 'gear'] as const).map((kind) => (
                  <button
                    key={kind}
                    aria-pressed={slot === kind}
                    onClick={() => setSlot(kind)}
                  >
                    {kind === 'suit'
                      ? 'Suits'
                      : kind === 'visor'
                        ? 'Visors'
                        : 'Accessories'}
                  </button>
                ))}
              </nav>
              <div className="store-grid">
                {CHARACTER_ITEMS.filter((item) => item.slot === slot).map(
                  (item) => {
                    const owned =
                        item.price === 0 ||
                        state.characterOwned.includes(item.id),
                      equipped = state.character[item.slot] === item.id,
                      candidate = { ...state.character, [item.slot]: item.id };
                    return (
                      <article
                        key={item.id}
                        className={equipped ? 'equipped' : ''}
                      >
                        <button
                          className="store-art"
                          onClick={() => setInspected(candidate)}
                          aria-label={'Preview ' + item.name}
                        >
                          <CharacterArt appearance={candidate} />
                        </button>
                        <small>{item.slot.toUpperCase()}</small>
                        <h3>{item.name}</h3>
                        <RarityBadge rarity={item.rarity} />
                        <p>{owned ? 'Owned' : `◈ ${item.price} Orbs`}</p>
                        <div className="store-actions">
                          <button onClick={() => setInspected(candidate)}>
                            Inspect
                          </button>
                          {owned ? (
                            <button
                              disabled={equipped}
                              onClick={() => {
                                if (onEquipCharacter(item.id)) {
                                  setInspected(null);
                                  setNotice('Equipped ' + item.name);
                                } else
                                  setNotice(
                                    'Could not save your equipped look.',
                                  );
                              }}
                            >
                              {equipped ? 'Equipped' : 'Equip'}
                            </button>
                          ) : (
                            <button
                              disabled={state.orbs < item.price}
                              onClick={() => result(onBuyCharacter(item.id))}
                            >
                              Buy · {item.price}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </section>
          </div>
        )}
        {tab === 'cosmetics' && (
          <div className="outfitter-layout">
            <section className="outfitter-inspect">
              <CosmeticPreview
                weapon="assaultRifle"
                cosmetics={
                  preview
                    ? { ...cosmetics, [preview.kind]: preview.level }
                    : cosmetics
                }
              />
              <p>
                {preview
                  ? preview.name + ' · Preview'
                  : 'Your equipped weapon cosmetics'}
              </p>
              <small>
                Store gear has its own collection. Career rewards remain tied to
                your level.
              </small>
              {(['skin', 'wrap', 'charm'] as const).map((kind) => (
                <p key={kind}>
                  {kind}:{' '}
                  {cosmetics[kind] === null
                    ? 'Standard issue'
                    : rewardAt(cosmetics[kind]!)?.name}
                  <button
                    disabled={cosmetics[kind] === null}
                    onClick={() => {
                      onEquipCosmetic(kind, null);
                      setCosmetic(null);
                    }}
                  >
                    Reset
                  </button>
                </p>
              ))}
            </section>
            <section>
              <div className="store-grid">
                {STORE_COSMETICS.map((item) => {
                  const owned = state.cosmeticOwned.includes(item.level),
                    equipped = cosmetics[item.kind] === item.level;
                  return (
                    <article
                      key={item.level}
                      className={equipped ? 'equipped' : ''}
                      style={
                        {
                          '--store-color': item.color,
                          '--store-accent': item.accent,
                        } as CSSProperties
                      }
                    >
                      <button
                        className={`store-cosmetic-art ${item.kind}`}
                        onClick={() => setCosmetic(item.level)}
                        aria-label={'Preview ' + item.name}
                      >
                        {item.kind === 'wrap' ? (
                          <WrapSwatch reward={item} />
                        ) : (
                          <>
                            <i />
                            <i />
                            <i />
                          </>
                        )}
                      </button>
                      <small>{item.kind.toUpperCase()}</small>
                      <h3>{item.name}</h3>
                      <RarityBadge rarity={item.rarity} />
                      <p>{item.description}</p>
                      <div className="store-actions">
                        <button onClick={() => setCosmetic(item.level)}>
                          Inspect
                        </button>
                        {owned ? (
                          <button
                            disabled={equipped}
                            onClick={() => {
                              onEquipCosmetic(item.kind, item.level);
                              setCosmetic(null);
                              setNotice('Equipped ' + item.name);
                            }}
                          >
                            {equipped ? 'Equipped' : 'Equip'}
                          </button>
                        ) : item.price === 0 ? (
                          <button onClick={() => setTab('daily')}>
                            {daily.recurring
                              ? 'Find in daily supply'
                              : 'Day 2 reward'}
                          </button>
                        ) : (
                          <button
                            disabled={state.orbs < item.price}
                            onClick={() => result(onBuyCosmetic(item.level))}
                          >
                            Buy · {item.price}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}
        {tab === 'daily' && (
          <section className="daily-section">
            <div className="daily-heading">
              <h3>
                {daily.recurring ? 'Your daily supply' : 'Seven days of gear'}
              </h3>
              <p>
                {daily.recurring
                  ? 'One reward each day. Keep the free 100 Orbs, or spend Orbs to reroll or upgrade today’s unclaimed reward.'
                  : 'Claim once each calendar day. Missed days keep your place. These seven starter rewards can be earned once.'}
              </p>
            </div>
            {!daily.recurring && (
              <div className="daily-track">
                {DAILY_REWARDS.map((reward) => (
                  <article
                    key={reward.day}
                    className={`${daily.day === reward.day && daily.available ? 'current' : ''} ${reward.day <= claimed ? 'claimed' : ''}`}
                  >
                    <small>DAY {reward.day}</small>
                    <strong>
                      {reward.day === 2
                        ? '✦'
                        : reward.day === 4
                          ? '◉'
                          : reward.day === 6
                            ? '⌁'
                            : reward.day === 7
                              ? '✧'
                              : '◈'}
                    </strong>
                    <h4>{reward.name}</h4>
                    <p>{reward.detail}</p>
                    <span>
                      {reward.day <= claimed
                        ? '✓ Claimed'
                        : daily.day === reward.day
                          ? 'Next reward'
                          : 'Upcoming'}
                    </span>
                  </article>
                ))}
              </div>
            )}
            {daily.recurring && (
              <>
                <article className="daily-supply">
                  <small>{daily.tier?.toUpperCase()} SUPPLY</small>
                  <h4>{daily.reward.name}</h4>
                  <p>{daily.reward.detail}</p>
                  <div className="store-actions">
                    <button
                      disabled={
                        !daily.available || state.orbs < (daily.rerollCost ?? 0)
                      }
                      onClick={() => setNotice(onChangeDaily('reroll').message)}
                    >
                      Reroll · {daily.rerollCost} Orbs
                    </button>
                    <button
                      disabled={
                        !daily.available ||
                        daily.upgradeCost === null ||
                        state.orbs < (daily.upgradeCost ?? 0)
                      }
                      onClick={() =>
                        setNotice(onChangeDaily('upgrade').message)
                      }
                    >
                      {daily.upgradeCost === null
                        ? 'Elite · Max upgrade'
                        : `Upgrade · ${daily.upgradeCost} Orbs`}
                    </button>
                  </div>
                  <p>
                    Reroll reveals a different reward at this tier. Upgrade
                    reveals a reward at the next tier. Changes save through
                    reloads; tomorrow starts with the free standard supply.
                  </p>
                </article>
                <details className="daily-completed">
                  <summary>
                    Starter track completed · All 7 rewards claimed
                  </summary>
                  <ol>
                    {DAILY_REWARDS.map((reward) => (
                      <li key={reward.day}>
                        Day {reward.day} · {reward.name} ✓
                      </li>
                    ))}
                  </ol>
                </details>
              </>
            )}
            {daily.day === 2 && (
              <fieldset className="daily-choices">
                <legend>Choose one day 2 reward</legend>
                {(['weapon', 'skin', 'wrap', 'charm'] as const).map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="daily-gear"
                      checked={choice === value}
                      onChange={() => setChoice(value)}
                    />
                    {value === 'weapon' ? 'Flux Uzi' : `Daybreak ${value}`}
                  </label>
                ))}
                <p>Already owned rewards become 150 Orbs.</p>
              </fieldset>
            )}
            <footer className="daily-claim">
              <div>
                <strong>
                  {daily.available
                    ? daily.recurring
                      ? 'Today’s supply is ready'
                      : `Day ${daily.day} is ready`
                    : 'Claimed for today'}
                </strong>
                <p>
                  {daily.available
                    ? daily.reward.name
                    : 'Return tomorrow for your next reward.'}{' '}
                </p>
              </div>
              <button
                className="primary-button"
                disabled={!daily.available}
                onClick={() => {
                  const claim = onClaim(choice);
                  setNotice(claim.message);
                }}
              >
                {daily.available
                  ? daily.recurring
                    ? 'Claim daily supply'
                    : `Claim day ${daily.day}`
                  : 'Come back tomorrow'}
              </button>
            </footer>
          </section>
        )}
        {!state.saved && (
          <output>
            Browser saving is unavailable. Purchases and daily claims need
            saving.
          </output>
        )}
        <footer className="outfitter-footer">
          <span>Cosmetic gear · Keeps your combat stats the same</span>
          <button onClick={onClose}>Back to game</button>
        </footer>
      </div>
    </dialog>
  );
}
