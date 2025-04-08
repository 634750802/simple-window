export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

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