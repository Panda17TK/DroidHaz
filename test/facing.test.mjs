// test/facing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirFromFacing } from '../js/render/facing.js';

// 8コンパス代表ベクトル(45°中心)＋ゼロベクトルの網羅。
// screen座標: +x右,+y下。S=front, SE/SW=frontDiag, E/W=side, NE/NW=backDiag, N=back。
const C = [
  // [name, x, y, row, flipX]
  ['E  (右)',        1,  0, 'side',      false],
  ['SE (右下)',      1,  1, 'frontDiag', false],
  ['S  (下)',        0,  1, 'front',     false],
  ['SW (左下)',     -1,  1, 'frontDiag', true ],
  ['W  (左)',       -1,  0, 'side',      true ],
  ['NW (左上)',     -1, -1, 'backDiag',  true ],
  ['N  (上)',        0, -1, 'back',      false],
  ['NE (右上)',      1, -1, 'backDiag',  false],
];

for (const [name, x, y, row, flipX] of C) {
  test(`dirFromFacing ${name} → ${row}/flip=${flipX}`, () => {
    const r = dirFromFacing({ x, y });
    assert.equal(r.row, row, `row(${name})`);
    assert.equal(r.flipX, flipX, `flipX(${name})`);
  });
}

test('ゼロベクトルは正面・非反転', () => {
  assert.deepEqual(dirFromFacing({ x: 0, y: 0 }), { row: 'front', flipX: false });
});

test('flipX は厳密に facing.x<0 と一致する(正規化されていないベクトルでも)', () => {
  assert.equal(dirFromFacing({ x: 0.01, y: -3 }).flipX, false);
  assert.equal(dirFromFacing({ x: -0.01, y: -3 }).flipX, true);
  assert.equal(dirFromFacing({ x: 5, y: 0 }).flipX, false);
});

// セクター境界付近の安定性。
test('セクター境界付近で row が想定どおり遷移する', () => {
  const near = (x, y) => dirFromFacing({ x, y }).row;
  assert.equal(near(1, 0.2), 'side');       // ほぼ真横よりわずかに下 → side(22.5°未満)
  assert.equal(near(-1, 0.2), 'side');
  assert.equal(near(1, 0.8), 'frontDiag');  // 斜め下が強い → frontDiag
  assert.equal(near(0.2, 1), 'front');      // ほぼ真下 → front
  assert.equal(near(0.2, -1), 'back');      // ほぼ真上 → back
});

// row は左右を区別しない(対称半セット運用の保証): x符号を反転しても row は不変、flipX だけ反転。
test('row は x の符号に不変、flipX のみ反転する(対称運用)', () => {
  for (const y of [-1, -0.5, 0, 0.5, 1]) {
    for (const ax of [0.3, 1, 2.5]) {
      const a = dirFromFacing({ x: ax, y });
      const b = dirFromFacing({ x: -ax, y });
      assert.equal(a.row, b.row, `row 対称(ax=${ax},y=${y})`);
      assert.equal(b.flipX, !a.flipX, 'flipX 反転');
    }
  }
});
