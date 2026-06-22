export function createEventBus() {
  var m = new Map();

  function on(type, fn) {
    var arr = m.get(type);
    if (!arr) {
      arr = [];
      m.set(type, arr);
    }
    arr.push(fn);

    // 解除用の関数を返す（thisに依存しない）
    return function unsubscribe() {
      var list = m.get(type);
      if (!list) return;
      var i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    };
  }

  function off(type, fn) {
    var arr = m.get(type);
    if (!arr) return;
    var i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }

  function emit(type, payload) {
    var arr = m.get(type);
    if (!arr) return;
    // ループ中に off されても安全なようにコピーしてから実行
    var snapshot = arr.slice();
    for (var i = 0; i < snapshot.length; i++) {
      try { snapshot[i](payload); } catch (e) { /* ここでログしてもOK */ }
    }
  }

  return { on: on, off: off, emit: emit };
}