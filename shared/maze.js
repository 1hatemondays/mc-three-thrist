export const WALL_COUNT = 20;
export const WALL_SIDES = ["top", "right", "bottom", "left"];

export const canonicalWall = ({ x, y, side }, boardSize) => {
  if (side === "bottom" && y + 1 < boardSize) return { x, y: y + 1, side: "top" };
  if (side === "right" && x + 1 < boardSize) return { x: x + 1, y, side: "left" };
  return { x, y, side };
};

export const wallKey = (wall, boardSize) => {
  const item = canonicalWall(wall, boardSize);
  return `${item.x}:${item.y}:${item.side}`;
};

export const uniqueWalls = (walls, boardSize) => {
  const byKey = new Map();
  for (const wall of walls) {
    byKey.set(wallKey(wall, boardSize), canonicalWall(wall, boardSize));
  }
  return [...byKey.values()];
};

export const hasWall = (walls, boardSize, x, y, side) => {
  const key = wallKey({ x, y, side }, boardSize);
  return walls.some((wall) => wallKey(wall, boardSize) === key);
};

export const hasEnclosedCell = (walls, boardSize) => {
  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const enclosed =
        (y === 0 || hasWall(walls, boardSize, x, y, "top")) &&
        (x === boardSize - 1 || hasWall(walls, boardSize, x, y, "right")) &&
        (y === boardSize - 1 || hasWall(walls, boardSize, x, y, "bottom")) &&
        (x === 0 || hasWall(walls, boardSize, x, y, "left"));

      if (enclosed) return true;
    }
  }

  return false;
};