export interface Key { name: string; label: string; index: number; x: number; y: number; w: number; h: number }
export const keys: Key[] = [];
function key(name: string, label: string, index: number, x: number, y: number, w = 1, h = 1) {
  keys.push({ name, label, index, x, y, w, h });
}
key('esc', 'esc', 0, 0, 0);
for (let i = 1; i <= 12; i++) key(`f${i}`, `F${i}`, i * 6, i + .75 + Math.floor((i - 1) / 4) * .25, 0);
[['insert', 'ins', 90], ['print', 'prt', 96], ['pgup', 'pgup', 102], ['pgdn', 'pgdn', 108]].forEach(([name, label, index], i) => key(String(name), String(label), Number(index), 15.3 + i, 0));
const digits = ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
digits.forEach((name, i) => key(name, name, i * 6 + 1, i, 1.3));
key('backspace', '⌫', 79, 13, 1.3, 2);
key('tab', 'tab ⇥', 2, 0, 2.3, 1.5);
'qwertyuiop[]'.split('').forEach((name, i) => key(name, name.toUpperCase(), (i + 1) * 6 + 2, i + 1.5, 2.3));
key('\\', '\\', 80, 13.5, 2.3, 1.5);
key('caps', 'caps', 3, 0, 3.3, 1.75);
"asdfghjkl;'".split('').forEach((name, i) => key(name, name.toUpperCase(), (i + 1) * 6 + 3, i + 1.75, 3.3));
key('enter', 'return ↵', 81, 12.75, 3.3, 2.25);
key('lshift', 'shift', 4, 0, 4.3, 2.25);
'zxcvbnm,./'.split('').forEach((name, i) => key(name, name.toUpperCase(), (i + 1) * 6 + 4, i + 2.25, 4.3));
key('rshift', 'shift', 82, 12.25, 4.3, 1.75);
key('up', '↑', 88, 14.3, 4.3);
key('lctrl', 'ctrl', 5, 0, 5.3, 1.25);
key('lwin', '⌘', 11, 1.25, 5.3, 1.25);
key('lalt', 'alt', 17, 2.5, 5.3, 1.25);
key('space', '光 序', 35, 3.75, 5.3, 6.25);
key('ralt', 'alt', 53, 10, 5.3);
key('fn', 'fn', 59, 11, 5.3);
key('rctrl', 'ctrl', 65, 12, 5.3);
key('left', '←', 83, 13.3, 5.3);
key('down', '↓', 89, 14.3, 5.3);
key('right', '→', 95, 15.3, 5.3);
[['numlock', 'num', 91], ['kpslash', '/', 97], ['kpstar', '*', 103], ['kpminus', '−', 109]].forEach(([name, label, index], i) => key(String(name), String(label), Number(index), 15.3 + i, 1.3));
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    const digit = 7 - row * 3 + col;
    key(`kp${digit}`, `${digit}`, 92 + row + col * 6, 15.3 + col, 2.3 + row);
  }
}
key('kpplus', '+', 110, 18.3, 2.3, 1, 2);
key('kpenter', 'enter', 112, 18.3, 4.3, 1, 2);
key('kp0', '0', 101, 16.3, 5.3);
key('kpdot', '.', 107, 17.3, 5.3);
