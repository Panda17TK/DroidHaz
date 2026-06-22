import { reload, placeWallFront, switchWeapon, cycleMelee } from '../systems/combat.js';

export function bindHotkeys(state, bus, input, api){
  addEventListener('keydown', e=>{
    const k = e.key.toLowerCase();
    // Escape は overlay stack の共通入口（空＆playing→pause / それ以外→最上位を閉じる）。
    // gameover 中も Esc は無効（requestBack 側で gameover は閉じない）。
    if(k==='escape'){ if(api.back) api.back(); else state.paused = !state.paused; return; }
    // ゲームオーバー中はその他ホットキーを無効化。
    if(state.gameOver) return;
    if(k==='p'){ api.save(); }
    if(k==='l'){ api.load(); }
    if(k==='1') switchWeapon(state, 0);
    if(k==='2') switchWeapon(state, 1);
    if(k==='3') switchWeapon(state, 2);
    if(k==='4') switchWeapon(state, 3);
    if(k==='5') switchWeapon(state, 4);
    if(k==='r') reload(state, bus);
    if(k==='f') placeWallFront(state, bus);
    if(k==='q') cycleMelee(state, bus);   // 近接武器（徒手空拳/刀）の切替
  });
}