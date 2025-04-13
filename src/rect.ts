export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const UNINITIALIZED_RECT = makeRect({ x: 0, y: 0, width: 0, height: 0 });

export interface Edges {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export interface SizeConstraints {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  suggestionWidth?: number;
  suggestionHeight?: number;
}

export function makeRect (rect: Rect): Rect {
  return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

export function padding (rect: Rect, padding: Edges): Rect {
  return makeRect({
    x: rect.x + padding.left,
    y: rect.y + padding.top,
    width: rect.width - padding.left - padding.right,
    height: rect.height - padding.top - padding.bottom,
  });
}

export function makeEdge (edges: Edges): Edges {
  return Object.freeze({ left: edges.left, top: edges.top, right: edges.right, bottom: edges.bottom });
}

export function makeVector2 (vector: Vector2): Vector2 {
  return Object.freeze({ x: vector.x, y: vector.y });
}

export function cloneMutableEdges (data: Edges) {
  return {
    left: data.left,
    right: data.right,
    top: data.top,
    bottom: data.bottom,
  };
}

export function cloneMutableRect (data: Rect) {
  return {
    x: data.x,
    y: data.y,
    width: data.width,
    height: data.height,
  };
}

export function isSameRect (a: Rect, b: Rect) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
