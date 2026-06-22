export function createInput(win) {
  const keys = Object.create(null);
  win.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); });
  win.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
  // aim:  タッチの右スティック等による照準オーバーライド（active 時は移動方向より優先）
  // move: タッチの左スティックのアナログ移動ベクトル（active 時はキーボードより優先）
  // autoFire: 自動射撃トグル（最寄りの敵にオート照準して発射）
  const aim  = { x: 0, y: 0, active: false };
  const move = { x: 0, y: 0, active: false };
  return { keys, pressed: k => !!keys[k.toLowerCase()], aim, move, autoFire: false };
}