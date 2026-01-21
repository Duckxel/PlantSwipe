const iterations = 100000;
const text = "red-orange/yellow_green";

console.time('Inline Regex');
for (let i = 0; i < iterations; i++) {
  text.replace(/[-_/]+/g, ' ').split(/\s+/);
}
console.timeEnd('Inline Regex');

const RE_SPLIT = /[-_/]+/g;
const RE_SPACE = /\s+/;

console.time('Hoisted Regex');
for (let i = 0; i < iterations; i++) {
  text.replace(RE_SPLIT, ' ').split(RE_SPACE);
}
console.timeEnd('Hoisted Regex');
