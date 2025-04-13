import type { Edges, Rect, SizeConstraints, Vector2 } from '../rect.js';
import { ConstraintRectLayout, getConstraintRect, type WindowLike } from './constraint.js';

export interface GridConstraints {
  minCols: number;
  maxCols: number;
  minRows: number;
  maxRows: number;
  suggestionCols?: number;
  suggestionRows?: number;
}

export class ConstraintGridRectLayout extends ConstraintRectLayout {
  allowTransitions = true;
  _cols: number;
  _rows: number;
  _colWidth: number;
  _rowHeight: number;
  _constraintRectInPixels: Rect;

  constructor (
    rows: number,
    cols: number,
    constraintRect: Rect | Element | WindowLike,
    { minCols = 1, maxCols = Number.MAX_SAFE_INTEGER, minRows = 1, maxRows = Number.MAX_SAFE_INTEGER, suggestionCols, suggestionRows }: {
      minCols?: number,
      maxCols?: number,
      minRows?: number,
      maxRows?: number,
      suggestionCols?: number,
      suggestionRows?: number,
    } = {},
  ) {
    super({
      x: 0, y: 0,
      width: cols, height: rows,
    }, {
      minWidth: minCols, minHeight: minRows,
      maxWidth: maxCols, maxHeight: maxRows,
      suggestionHeight: suggestionRows, suggestionWidth: suggestionCols,
    });
    const rect = getConstraintRect(constraintRect);
    this._cols = cols;
    this._rows = rows;
    this._colWidth = rect.width / cols;
    this._rowHeight = rect.height / rows;
    this._constraintRectInPixels = rect;
    this.autoBind(constraintRect);
  }

  /**
   * @deprecated use setGridConstraints
   */
  setSizeConstraints (sizeConstraints: SizeConstraints) {
    super.setSizeConstraints(sizeConstraints);
  }

  setGridConstraints ({ minCols, maxCols, maxRows, minRows, suggestionCols, suggestionRows }: GridConstraints) {
    this.setSizeConstraints({
      minWidth: minCols, minHeight: minRows, maxWidth: maxCols, maxHeight: maxRows,
      suggestionHeight: suggestionRows, suggestionWidth: suggestionCols,
    });
  }

  setConstraintRect (rect: Rect, breaking?: boolean) {
    this._colWidth = rect.width / this._cols;
    this._rowHeight = rect.height / this._rows;
    this._constraintRectInPixels = rect;
    super.setConstraintRect({
      x: 0,
      y: 0,
      width: this._cols,
      height: this._rows,
    }, breaking);
  }

  setGridSize (cols: number, rows: number, breaking?: boolean) {
    this._cols = cols;
    this._rows = rows;
    if (breaking) {
      this.emit('break');
    } else {
      this.emit('update');
    }
  }

  move (rect: Rect, offset: Vector2, direction: Vector2): Rect {
    return super.move(rect, { x: Math.round(offset.x / this._colWidth), y: Math.round(offset.y / this._rowHeight) }, direction);
  }

  resize (rect: Rect, edges: Edges): Rect {
    return super.resize(rect, {
      top: Math.round(edges.top / this._rowHeight),
      left: Math.round(edges.left / this._colWidth),
      bottom: Math.round(edges.bottom / this._rowHeight),
      right: Math.round(edges.right / this._colWidth),
    });
  }

  toRectInPixels (rect: Rect): Rect {
    const { x, y } = this._constraintRectInPixels;
    return {
      x: x + rect.x * this._colWidth + this._rectPaddingPixels.left,
      y: y + rect.y * this._rowHeight + this._rectPaddingPixels.top,
      width: rect.width * this._colWidth - this._rectPaddingPixels.left - this._rectPaddingPixels.right,
      height: rect.height * this._rowHeight - this._rectPaddingPixels.top - this._rectPaddingPixels.bottom,
    };
  }

  fitRect ({ x, y, width, height }: Rect): Rect {
    return { x, y, width, height };
  }

  initializeRectByIndex (index: number): Rect {
    const cols = this._sizeConstraints.suggestionWidth || this._sizeConstraints.minWidth;
    const rows = this._sizeConstraints.suggestionHeight || this._sizeConstraints.minHeight;

    const row = Math.floor((index * cols) / this._cols) * rows;
    const column = ((index * cols) % this._cols);

    return {
      x: column,
      y: row,
      width: cols,
      height: rows,
    };
  }
}
