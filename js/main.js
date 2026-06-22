import { DPR, MAX_DT, FIXED_DT } from './core/constants.js';
import { loadConfig, CONFIG } from './core/config.js';
import { createEventBus } from './core/events.js';
import { createInput } from './core/input.js';
import { mountDevEditor } from './render/dev-editor.js';
import { createAudio } from './services/audio.js';
import { createStorage } from './services/storage.js';
import { initKv } from './services/kv.js';
import { createInitialState, resetState } from './state/state.js';
import { setupMap } from './state/map.js';
import { bindHotkeys } from './state/binds.js';
import { rebuildFlowField } from './systems/flowfield.js';
import { buildMobGrid } from './systems/spatial.js';
import { updateAI } from './systems/ai.js';
import { updateTiles } from './systems/tiles.js';
import { updateItems } from './systems/items.js';
import { updateSpawner, startWave } from './systems/spawner.js';
import { updateCombat, reload, placeWallFront, switchMelee, cycleMelee } from './systems/combat.js';
import { updateFX } from './systems/fx.js';
import { createTouchControls, shouldShowTouchUi, readTouchEnv } from './core/touch.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { renderFrame } from './render/renderer.js';
import { mountGameOver } from './render/overlay.js';
import { mountHUD } from './render/hud.js';
import { mountUpgrades } from './render/upgrades.js';
import { listSlotMetas, saveToSlot, loadFromSlot, deleteSlot } from './systems/save-local.js';
import {
  createUiState, isUiPaused, topOverlay,
  pushOverlay, closeTopOverlay, closeAllOverlays, requestBack, consumeResumeGuard,
} from './core/ui-state.js';
import { mountPauseMenu } from './render/pause-menu.js';
import { mountSaveMenu } from './render/save-menu.js';
import { mountSettingsPanel } from './render/settings-panel.js';
import { mountWeaponRadial } from './render/weapon-radial.js';
import { mountTitleScreen } from './render/title-screen.js';
import { mountScoresMenu } from './render/scores-menu.js';
import { mountContinueMenu } from './render/continue-menu.js';
import { setAppPhase, isPlaying } from './core/app-state.js';
import { readProgress, writeProgress, markStageReached } from './systems/progress.js';
import { stageDef, STAGES, STAGE_WAVES, STAGE_MAX } from './state/stages.js';
import {
  onAppBackground, shouldAutoPause,
  onAndroidBack, androidBackAction, exitApp, isNativeAndroid,
  hapticImpact, initNativeChrome,
} from './services/native.js';

const canvas  = document.getElementById('game');
const hudEl   = document.getElementById('hud');
const toastEl = document.getElementById('toast');

if (!canvas) {
  console.error('[INIT] #game canvas が見つかりません');
} else {
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) console.error('[INIT] 2Dコンテキストの取得に失敗');

  // 永続ストレージ初期化（ネイティブでは Preferences → localStorage を補完）。
  // 非同期だが await せず開始：ロード操作（Lキー）は起動より十分後のため間に合う。
  try { initKv(); } catch (_e) {}

  // --- DPR リサイズ ---
  function fitCanvas() {
    const w = Math.floor(canvas.clientWidth * DPR);
    const h = Math.floor(canvas.clientHeight * DPR);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  try {
    new ResizeObserver(fitCanvas).observe(canvas);
  } catch (_e) {
    addEventListener('resize', fitCanvas);
  }
  fitCanvas();

  // --- DI ---
  const bus     = createEventBus();
  const input   = createInput(window);
  const audio   = createAudio();
  const storage = createStorage('nobihaza_like_save'); // 互換用（今は未使用）

  // --- bus: SE ---
  bus.on('sfx', (name) => { try { audio.sfx(name); } catch (_e) {} });

  // --- 設定（開発者モード）読み込み：他システムが参照する前に ---
  loadConfig();

  // CONFIG.player の値をプレイヤー初期値へ反映
  function applyPlayerConfig(st) {
    const pc = CONFIG.player;
    st.player.baseSpeed = pc.baseSpeed;
    st.player.hpMax = pc.hpMax;
    st.player.hp = Math.min(st.player.hp, pc.hpMax);
    st.player.staMax = pc.staMax;
    st.player.sta = Math.min(st.player.sta, pc.staMax);
  }

  // --- state 初期化 & マップ ---
  const state = createInitialState();
  if (!state.stats) state.stats = { kills: 0, timeMs: 0, name: '' };
  applyPlayerConfig(state);
  state.runStart = performance.now();
  state.gameOver = false;
  // アプリ・フェーズ（F5a）：起動時はタイトル。ステージ/モードの既定。
  state.appPhase = 'title';
  state.mode = 'stage';
  state.stage = 1;
  state.mapId = stageDef(1).mapId; // ステージ1の専用マップ（F5c）

  setupMap(state);
  rebuildFlowField(state);
  startWave(state, 1);

  // --- HUD / Overlay ---
  mountHUD(hudEl, toastEl, state, bus);
  mountGameOver(document.getElementById('overlay'), bus, state);
  mountUpgrades(document.getElementById('upgrade-overlay'), bus, state);
  mountDevEditor(document.getElementById('dev-overlay'), bus, state);
  const devBtn = document.getElementById('dev-btn');
  if (devBtn) devBtn.addEventListener('click', () => bus.emit('dev:toggle'));

  // --- UI 状態機械（overlay stack：DESIGN §0.1/0.2）---
  state.ui = createUiState();

  // ゲーム操作入力（move/aim と hold 系キー）を中立化する。
  // overlay 表示中は破棄、再開直後は暴発防止のためリセットする（§0.3）。
  function neutralizeGameInput() {
    input.move.active = false; input.move.x = 0; input.move.y = 0;
    input.aim.active = false; input.aim.x = 0; input.aim.y = 0;
    input.keys['j'] = false; input.keys['k'] = false; input.keys['shift'] = false;
  }

  // overlay を描画する view 群（stack 変更時にまとめて再描画）。
  const uiViews = [];

  // overlay stack の変更を state.paused と DOM に反映する唯一の同期点。
  function syncUi() {
    state.paused = isUiPaused(state.ui) || state.gameOver;
    for (const v of uiViews) v.render(state.ui);
    // 閉じた直後の 1 フレームは hold 入力をリセット（再開時の暴発防止）
    if (consumeResumeGuard(state.ui) && !isUiPaused(state.ui)) neutralizeGameInput();
  }

  // overlay 遷移は必ずこの uiCtl を通す（呼び出し後に syncUi で反映）。
  const uiCtl = {
    push:     (n) => { pushOverlay(state.ui, n); syncUi(); },
    closeTop: ()  => { closeTopOverlay(state.ui); syncUi(); },
    closeAll: ()  => { closeAllOverlays(state.ui); syncUi(); },
    back:     ()  => { requestBack(state.ui); syncUi(); },
    top:      ()  => topOverlay(state.ui),
  };

  const wrapEl = document.getElementById('wrap');

  // --- 設定（共有オブジェクト）＋ タッチ操作（常時生成し、表示は設定で制御）---
  const settings = loadSettings();
  const touchEnv = readTouchEnv();

  // 武器選択（巡回／ラジアル共通）
  function selectWeapon(idx) {
    const ws = state.player.weapons;
    if (!ws.length) return;
    state.player.curW = ((idx % ws.length) + ws.length) % ws.length;
    bus.emit('ui:toast', '武器: ' + (ws[state.player.curW].name || ''));
  }
  // REQ-CTRL-3: 武器ラジアル（武器ボタン長押しで開く）
  const weaponRadial = mountWeaponRadial(wrapEl, { state, onSelect: (idx) => selectWeapon(idx) });

  // 近接武器ラジアル（近接ボタン長押し）。所持中の近接武器(meleeWeapons)から選ぶ。
  function meleeOwnedDefs() {
    const W = (CONFIG.melee && CONFIG.melee.weapons) || {};
    return (state.player.meleeWeapons || ['fists']).map((id) => W[id] || { name: id });
  }
  const meleeRadial = mountWeaponRadial(wrapEl, {
    state, radius: 84,
    list: meleeOwnedDefs,
    curIndex: () => state.player.curMelee || 0,
    onSelect: (idx) => switchMelee(state, idx, bus),
  });

  const touchCtl = createTouchControls(wrapEl, input, {
    reload: () => reload(state, bus),
    build:  () => placeWallFront(state, bus),
    cycleWeapon: () => selectWeapon(state.player.curW + 1),
    openWeaponRadial:   (x, y) => weaponRadial.openAt(x, y),
    updateWeaponRadial: (x, y) => weaponRadial.update(x, y),
    closeWeaponRadial:  (commit) => weaponRadial.close(commit),
    cycleMelee: () => cycleMelee(state, bus),
    openMeleeRadial:   (x, y) => meleeRadial.openAt(x, y),
    updateMeleeRadial: (x, y) => meleeRadial.update(x, y),
    closeMeleeRadial:  (commit) => meleeRadial.close(commit),
    pause: () => { if (!state.gameOver && !isUiPaused(state.ui)) uiCtl.push('pause'); },
    openSettings: () => uiCtl.push('settings'),
  }, settings);

  // 進行度（到達ステージ・エンドレス解放・最終モード）
  let progress = readProgress();
  if (progress.lastMode) state.mode = progress.lastMode;

  // REQ-TOUCH-4: forceTouchUi＋環境からタッチUIの表示可否を決め、即時反映する。
  // F5a: タッチUIは playing フェーズのときだけ表示する。
  function applyTouchVisibility() {
    const show = isPlaying(state) && shouldShowTouchUi(settings, touchEnv);
    if (touchCtl && touchCtl.setVisible) touchCtl.setVisible(show);
    document.body.classList.toggle('touch', isPlaying(state) && shouldShowTouchUi(settings, touchEnv));
  }

  // --- アプリ・フェーズ制御（REQ-APP-1）---
  function applyPhase() {
    const playing = isPlaying(state);
    if (hudEl) hudEl.style.display = playing ? '' : 'none';
    applyTouchVisibility();
    titleView.render(state);
  }
  function setPhase(phase) {
    setAppPhase(state, phase);
    if (phase === 'title') closeAllOverlays(state.ui);
    syncUi();
    applyPhase();
  }
  // 新規ランの初期化（指定ステージの先頭ウェーブから）。
  function beginRun(opts) {
    const mode = (opts && opts.mode === 'endless') ? 'endless' : 'stage';
    const stage = Math.max(1, (opts && opts.stage) | 0 || 1);
    resetState(state);
    applyPlayerConfig(state);
    state.mode = mode;
    state.stage = stage;
    state.mapId = stageDef(stage).mapId;
    state._stageAllCleared = false;
    state.stageBanner = null;
    setupMap(state);
    rebuildFlowField(state);
    startWave(state, (stage - 1) * STAGE_WAVES + 1); // 当該ステージの先頭ウェーブ
    state.runStart = performance.now();
    state.gameOver = false;
    closeAllOverlays(state.ui);
    syncUi();
  }
  // はじめから（mode 指定）/ ステージ選択からの新規ラン開始＋playing へ。
  function startGame(mode) {
    progress.lastMode = (mode === 'endless') ? 'endless' : 'stage';
    writeProgress(progress);
    beginRun({ mode, stage: 1 });
    setPhase('playing');
  }
  function startAtStage(stage) {
    beginRun({ mode: 'stage', stage });
    setPhase('playing');
  }
  // ロード成功後はタイトル/プレイ中いずれからでも playing へ入り、pause を残す
  // （ロード直後の被弾理不尽を防ぐ）。
  function afterLoad() {
    setAppPhase(state, 'playing');
    closeAllOverlays(state.ui);
    pushOverlay(state.ui, 'pause');
    syncUi();
    applyPhase();
  }

  const pauseView = mountPauseMenu(wrapEl, {
    state, uiCtl,
    hooks: {
      onSave: () => uiCtl.push('save'),
      onLoad: () => uiCtl.push('load'),
      onSettings: () => uiCtl.push('settings'),
      onRestartConfirmed: () => bus.emit('game:restart'),
      onTitleConfirmed: () => setPhase('title'),
      // 終了（Native Android のみ表示。F4b）
      isNativeAndroid: () => isNativeAndroid(),
      onQuitConfirmed: () => exitApp(),
    },
  });
  const saveView = mountSaveMenu(wrapEl, {
    state, bus, uiCtl,
    confirm: pauseView.requestConfirm,
    slots: { listSlotMetas, saveToSlot, loadFromSlot, deleteSlot },
    onLoaded: () => afterLoad(),
  });
  const settingsView = mountSettingsPanel({
    rootEl: wrapEl, settings,
    onChange: () => {
      saveSettings(settings);
      input.autoFire = !!settings.autoFire;
      if (touchCtl && touchCtl.applySettings) touchCtl.applySettings(settings);
      applyTouchVisibility(); // forceTouchUi 変更を即時反映
    },
    onClose: () => uiCtl.closeTop(),
  });
  const scoresView = mountScoresMenu(wrapEl, { uiCtl });
  const continueView = mountContinueMenu(wrapEl, {
    uiCtl,
    getProgress: () => progress,
    stages: { STAGES, STAGE_MAX },
    actions: {
      loadFromSave: () => uiCtl.push('load'),
      startStage: (stage) => startAtStage(stage),
      startEndless: () => startGame('endless'),
    },
  });
  const titleView = mountTitleScreen(wrapEl, {
    state,
    getProgress: () => progress,
    hasSaves: () => listSlotMetas().some((m) => !m.empty),
    actions: {
      start: (mode) => startGame(mode),
      continue: () => uiCtl.push('continue'),   // ロード/ステージ選択（REQ-SAVE-2）
      openSettings: () => uiCtl.push('settings'),
      openScores: () => uiCtl.push('scores'),
      onModeChange: (m) => { progress.lastMode = m; writeProgress(progress); },
    },
  });
  uiViews.push(pauseView, saveView, settingsView, scoresView, continueView, titleView);

  // 初期反映
  input.autoFire = !!settings.autoFire;
  syncUi();
  applyPhase(); // 起動時はタイトル表示（HUD/タッチUI非表示）

  // --- 中断/復帰の自動ポーズ（REQ-NATIVE-4・F4a）---
  // バックグラウンド化（タブ非表示 / Native 非アクティブ）で自動ポーズ。
  // 復帰しても自動再開しない（明示的に「再開」が必要）。
  onAppBackground(() => { if (shouldAutoPause(state)) uiCtl.push('pause'); });

  // --- Android 戻るボタン（REQ-NATIVE-2・F4b）---
  // いきなり終了せず overlay を順に閉じ、pause で Back→終了確認→OK で exitApp。
  onAndroidBack(() => {
    switch (androidBackAction(state.ui)) {
      case 'openPause':   uiCtl.push('pause'); break;
      case 'closeTop':    uiCtl.closeTop(); break;
      case 'confirmExit': pauseView.requestConfirm('終了', 'アプリを終了しますか？', () => exitApp()); break;
      case 'noop':        break;
    }
  });

  // --- ネイティブ chrome（ステータスバー/スプラッシュ・REQ-NATIVE-3）---
  initNativeChrome({ background: '#0b0e13' });

  // --- ハプティクス（REQ-NATIVE-1）---
  // 被弾(HP減少)/ボス撃破(killCam)/強化確定。settings.haptics で ON/OFF。Web は no-op。
  function haptic(style) { if (settings.haptics) hapticImpact(style); }
  bus.on('upgrade:chosen', () => haptic('medium'));
  let hapPrevHp = state.player.hp;
  let hapPrevKillCam = false;
  function observeHaptics() {
    if (state.player.hp < hapPrevHp - 0.001 && !state.gameOver) haptic('light'); // 被弾
    const kc = !!state.killCam;
    if (kc && !hapPrevKillCam) haptic(state.killCam.boss ? 'heavy' : 'medium'); // ボス/中ボス撃破
    hapPrevHp = state.player.hp;
    hapPrevKillCam = kc;
  }
  // リスタート/ロードで HP がジャンプしても誤発火しないよう基準を合わせる。
  bus.on('game:restart', () => { hapPrevHp = state.player.hp; hapPrevKillCam = !!state.killCam; });

  // --- ホットキー（保存/読込／Esc）---
  // P/L もスロット overlay を開く（タッチ・キーボード共通の導線に統一）。
  bindHotkeys(state, bus, input, {
    save: () => { if (!state.gameOver) uiCtl.push('save'); },
    load: () => uiCtl.push('load'),
    back: () => uiCtl.back(),
  });

  // --- 初回のユーザー操作で AudioContext を resume（モバイル対策）---
  const resumeAudio = () => {
    try { audio.resume && audio.resume(); } catch (_e) {}
    window.removeEventListener('pointerdown', resumeAudio);
    window.removeEventListener('keydown', resumeAudio);
  };
  window.addEventListener('pointerdown', resumeAudio);
  window.addEventListener('keydown', resumeAudio);

  // --- 回転/リサイズ（REQ-UI-2）---
  // canvas は ResizeObserver で追従し、ズームは毎フレーム computeView で再計算、
  // スティック base は指追従なので再計算不要。回転直後の入力暴発のみ中立化する。
  function onViewportChange() { fitCanvas(); neutralizeGameInput(); }
  addEventListener('orientationchange', onViewportChange);
  addEventListener('resize', onViewportChange);

  // --- エラーをトーストにも表示 ---
  addEventListener('error', (ev) => {
    const msg = 'Error: ' + (ev && ev.message ? ev.message : 'unknown');
    bus.emit('ui:toast', msg);
  });
  addEventListener('unhandledrejection', (ev) => {
    try { console.error('Promise rejection:', ev && ev.reason); } catch (_e) {}
    bus.emit('ui:toast', 'Async Error');
  });

  // 任意：ゲームオーバーイベント受信時にトースト
  bus.on('game:over', ({ reason, timeMs }) => {
    bus.emit('ui:toast', 'Game Over');
  });

  // REQ-STAGE-FX-1: ステージ遷移バナー（"STAGE N — 名前"）。描画は renderer が担当。
  bus.on('stage:enter', ({ stage }) => {
    const d = stageDef(stage);
    state.stageBanner = { text: 'STAGE ' + stage + (d && d.name ? ' — ' + d.name : ''), t: 0, life: 2.0 };
    // 到達ステージを記録（解放は cleared で行う）
    if (stage > progress.bestStage) { progress.bestStage = stage; writeProgress(progress); }
  });
  // REQ-MODE-1: 定義済みステージ踏破でエンドレス解放（永続化）。
  bus.on('stage:cleared', () => {
    if (!progress.endlessUnlocked) {
      progress = markStageReached(progress, STAGE_MAX, STAGE_MAX);
      writeProgress(progress);
      bus.emit('ui:toast', '全ステージ制覇！ エンドレス解放');
    }
  });

  // リスタート：現在のモードのまま、ステージ1の先頭から作り直す。
  bus.on('game:restart', () => {
    beginRun({ mode: state.mode, stage: 1 });
    bus.emit('ui:toast', 'Restart');
  });

  // --- ループ ---
  let last = performance.now();
  let flowTimer = 0.0; // 団子対策の再計算タイマ
  let accumulator = 0; // 固定タイムステップの蓄積
  const MAX_STEPS = 5; // 1フレームでの最大ステップ数（スパイラル防止）

  // REQ-PERF-2: フレーム時間の EMA を見て FX 密度を自動調整（ヒステリシス付き）。
  state.fxDensity = 1;
  let frameMsEMA = 16.7;
  function adaptFxDensity(rawMs) {
    frameMsEMA = frameMsEMA * 0.92 + Math.min(100, rawMs) * 0.08;
    if (frameMsEMA > 30 && state.fxDensity > 0.3) state.fxDensity = 0.3;        // 〜33fps 未満
    else if (frameMsEMA > 23 && state.fxDensity > 0.5) state.fxDensity = 0.5;   // 〜43fps 未満
    else if (frameMsEMA < 18 && state.fxDensity < 1) state.fxDensity = 1;       // 〜55fps 超で復帰
  }

  // 固定ステップ1回ぶんのシミュレーション更新
  function stepSimulation(h) {
    // 補間用に「ステップ前」の位置を記録（描画は prev→cur を alpha で補間）
    const p = state.player;
    p.px0 = p.x; p.py0 = p.y;
    for (let i = 0; i < state.mobs.length; i++) {
      const m = state.mobs[i]; m.px0 = m.x; m.py0 = m.y;
    }
    // 近傍探索グリッドをステップ先頭で構築し、全システムで共有
    state.mobGrid = buildMobGrid(state);
    updateCombat(state, h, bus, input, audio);
    updateTiles(state, h, bus, audio);
    updateSpawner(state, h, bus, audio);
    updateAI(state, h, bus, audio);
    updateItems(state, h, bus, audio);
    updateFX(state, h, bus);

    // フローフィールド定期再計算
    flowTimer -= h;
    if (flowTimer <= 0) { rebuildFlowField(state); flowTimer = 0.35; }

    // HP=0 → 一度だけゲームオーバー
    if (!state.gameOver && state.player.hp <= 0) {
      state.gameOver = true;
      pushOverlay(state.ui, 'gameover'); // 最下位固定。pause を積めなくする
      syncUi();                          // state.paused = true（UI または gameOver）
      const timeMs = Math.max(0, performance.now() - state.runStart);
      state.stats.timeMs = timeMs;
      bus.emit('game:over', { reason: 'death', timeMs });
    }
  }

  function loop(t) {
    try {
      fitCanvas();
      const rawMs = t - last;                       // クランプ前の実フレーム時間（perf 監視用）
      const dt = Math.min(MAX_DT, (t - last) / 1000);
      last = t;
      adaptFxDensity(rawMs);                         // REQ-PERF-2: FX 密度の自動調整

      // 時間スケール（演出）：ヒットストップとスローモーションを掛け合わせる。
      // タイマ自体は実時間で減衰させ、演出が間延びしないようにする。
      let timeScale = 1;
      if (state.hitstop > 0) { state.hitstop -= dt; timeScale *= 0.06; }
      if (state.slowmo && state.slowmo.t > 0) {
        state.slowmo.t -= dt;
        timeScale *= state.slowmo.factor;
        if (state.slowmo.t <= 0) state.slowmo.t = 0;
      }
      // キルカム演出タイマ（描画用・実時間）
      if (state.killCam) { state.killCam.t += dt; if (state.killCam.t >= state.killCam.life) state.killCam = null; }
      // ステージバナー演出タイマ（描画用・実時間）
      if (state.stageBanner) { state.stageBanner.t += dt; if (state.stageBanner.t >= state.stageBanner.life) state.stageBanner = null; }

      // overlay 表示中・タイトル中はゲーム操作入力を破棄（§0.3 / §8.0.1）。
      if (isUiPaused(state.ui) || !isPlaying(state)) neutralizeGameInput();

      // シミュレーションは playing フェーズ かつ 非ポーズ のときだけ進める（§8.0.1）。
      if (isPlaying(state) && !state.paused) {
        // ===== 固定タイムステップ蓄積（決定論・トンネリング抑止）=====
        accumulator += dt * timeScale;
        let steps = 0;
        while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
          stepSimulation(FIXED_DT);
          accumulator -= FIXED_DT;
          steps++;
          if (state.gameOver) { accumulator = 0; break; }
        }
        // 過負荷時（steps 上限到達）は余剰を捨ててスパイラルを防ぐ
        if (steps >= MAX_STEPS) accumulator = 0;
      }
      // 補間係数（0..1）：直近ステップからの経過割合。描画位置を滑らかにする。
      state.alpha = (state.paused || !isPlaying(state)) ? 1 : Math.max(0, Math.min(1, accumulator / FIXED_DT));

      // カメラ（スムーズ追従＋向きの先読み）と画面シェイクの更新（実時間）
      const look = 36;
      let tgX = state.player.x + state.player.facing.x * look;
      let tgY = state.player.y + state.player.facing.y * look;
      // ボス撃破中はカメラを撃破地点へ寄せる（シネマティック）
      if (state.killCam) {
        const ph = 1 - state.killCam.t / state.killCam.life; // 1→0
        const w = Math.min(0.6, ph * 0.6);
        tgX = tgX * (1 - w) + state.killCam.x * w;
        tgY = tgY * (1 - w) + state.killCam.y * w;
      }
      if (!state.cam) state.cam = { x: tgX, y: tgY };
      const k = 1 - Math.pow(0.0001, dt);
      state.cam.x += (tgX - state.cam.x) * k;
      state.cam.y += (tgY - state.cam.y) * k;
      if (state.shake && state.shake.t > 0) {
        state.shake.t -= dt;
        if (state.shake.t <= 0) { state.shake.t = 0; state.shake.mag = 0; }
      }

      // ハプティクス（状態を観測してエッジ検出。Web は no-op）
      observeHaptics();

      // 描画
      renderFrame(ctx2d, canvas, state);
    } catch (e) {
      try { console.error('[LOOP]', e); } catch (_e) {}
      bus.emit('ui:toast', 'Runtime Error');
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
