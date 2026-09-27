// blocks.js：块表的插入与分裂
export function insertKey(blocks, key, branch) {
  const limit = branch > 0 ? branch : 4;
  const next = (blocks || []).map((block) => block.slice());
  if (next.length === 0) return [[key]];
  let index = next.length - 1;
  for (let i = 0; i < next.length; i += 1) {
    if (next[i][0] > key) { index = i - 1; break; }
  }
  if (index < 0) index = 0;
  const block = next[index];
  let at = 0;
  while (at < block.length && block[at] < key) at += 1;
  block.splice(at, 0, key);
  if (block.length > limit) {
    const mid = Math.floor(block.length / 2);
    next.splice(index, 1, block.slice(0, mid), block.slice(mid));
  }
  return next;
}

export function blocksOf(blocks) {
  return (blocks || []).map((block) => [block[0], block[block.length - 1], block.length]);
}
