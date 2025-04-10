import { IDisposable } from '../draggable.js';
import { cloneMutableEdges, type Edges, type Rect, type SizeConstraints, type Vector2 } from '../rect.js';
import { RectLayout } from './base.js';

export interface IConstraintRectLayout {
  readonly hasConstraintRect: true;

  setConstraintRect (rect: Rect, breaking?: boolean): void;
}

export interface ConstraintEdges extends Edges {
  readonly width: number;
  readonly height: number;
}

export interface ISizeConstrainedRectLayout {
  readonly sizeConstrained: true;

  setSizeConstraints (sizeConstraints: SizeConstraints): void;
}

export function isConstraintLayout (layout: RectLayout): layout is RectLayout & IConstraintRectLayout {
  return (layout as never as IConstraintRectLayout).hasConstraintRect;
}

export interface WindowLike {
  innerWidth: number;
  innerHeight: number;

  addEventListener (type: 'resize', listener: () => void): void;

  removeEventListener (type: 'resize', listener: () => void): void;
}

export class ConstraintRectLayout extends RectLayout implements IConstraintRectLayout, ISizeConstrainedRectLayout {
  readonly hasConstraintRect = true;
  readonly sizeConstrained = true;
  protected _constraint: ConstraintEdges;
  private _bound: IDisposable[] | null = null;

  constructor (
    constraintRect: Rect | Element | WindowLike,
    protected _sizeConstraints: SizeConstraints,
  ) {
    super();
    this._constraint = constraintRectToConstraints(getConstraintRect(constraintRect));
    this.autoBind(constraintRect);
  }

  getConstraint (): ConstraintEdges {
    return this._constraint;
  }

  setConstraintRect (rect: Rect, breaking?: boolean) {
    this._constraint = {
      left: rect.x,
      right: rect.x + rect.width,
      top: rect.y,
      bottom: rect.y + rect.height,
      width: rect.width,
      height: rect.height,
    };
    if (breaking) {
      this.emit('break');
    } else {
      this.emit('update');
    }
  }

  getSizeConstraints (): SizeConstraints {
    return this._sizeConstraints;
  }

  setSizeConstraints (sizeConstraints: SizeConstraints) {
    this._sizeConstraints = sizeConstraints;
    this.emit('update');
  }

  move (rect: Rect, offset: Vector2, direction: Vector2): Rect {
    let { x, y, width, height } = super.move(rect, offset, direction);
    const { left, top, bottom, right } = this._constraint;

    if (direction.x < 0) {
      if (x < left) x -= x - left;
      if (x + width > right) x -= (x + width) - right;
    } else {
      if (x + width > right) x -= (x + width) - right;
      if (x < left) x -= x - left;
    }
    if (direction.y < 0) {
      if (y < top) y -= y - top;
      if (y + height > bottom) y -= (y + height) - bottom;
    } else {
      if (y + height > bottom) y -= (y + height) - bottom;
      if (y < top) y -= y - top;
    }

    return { x, y, width, height };
  }

  resize (rect: Rect, edges: Edges): Rect {
    const { minWidth, maxWidth, minHeight, maxHeight } = this._sizeConstraints;
    const newEdges = cloneMutableEdges(edges);

    // Consider size constraints
    if (rect.width - newEdges.left < minWidth) {
      newEdges.left = rect.width - minWidth;
    }
    if (rect.width - newEdges.left > maxWidth) {
      newEdges.left = rect.width - maxWidth;
    }

    if (rect.width + newEdges.right < minWidth) {
      newEdges.right = minWidth - rect.width;
    }
    if (rect.width + newEdges.right > maxWidth) {
      newEdges.right = maxWidth - rect.width;
    }

    if (rect.height - newEdges.top < minHeight) {
      newEdges.top = rect.height - minWidth;
    }
    if (rect.height - newEdges.top > maxHeight) {
      newEdges.top = rect.height - maxHeight;
    }

    if (rect.height + newEdges.bottom < minHeight) {
      newEdges.bottom = minHeight - rect.height;
    }
    if (rect.height + newEdges.bottom > maxHeight) {
      newEdges.bottom = maxHeight - rect.height;
    }

    let { x, y, width, height } = super.resize(rect, newEdges);
    const { left, top, bottom, right } = this._constraint;

    // Consider constraint edges
    if (x < left) {
      width -= left - x;
      x -= x - left;
    }
    if (x + width > right) {
      width -= (x + width) - right;
    }
    if (y < top) {
      height -= top - y;
      y -= y - top;
    }
    if (y + height > bottom) {
      height -= (y + height) - bottom;
    }

    return { x, y, width, height };
  }

  fitRect ({ x, y, width, height }: Rect): Rect {
    const { left, top, bottom, right, width: cWidth, height: cHeight } = this._constraint;

    if (width > cWidth) {
      width -= width - cWidth;
    }
    if (height > cHeight) {
      height -= height - cHeight;
    }
    if (x < left) {
      x -= x - left;
    }
    if (y < top) {
      y -= y - top;
    }
    if (x + width > right) {
      x -= (x + width) - right;
    }
    if (y + height > bottom) {
      y -= (y + height) - bottom;
    }

    return { x, y, width, height };
  }

  initializeRect (id: number): Rect {
    const width = Math.max(Math.min(this._sizeConstraints.suggestionWidth ?? this._sizeConstraints.minWidth, this._sizeConstraints.maxWidth), this._sizeConstraints.minWidth);
    return this.fitRect({
      x: this._constraint.right - 32 * id - width,
      y: this._constraint.top + 32 * id,
      width,
      height: Math.max(Math.min(this._sizeConstraints.suggestionHeight ?? this._sizeConstraints.minHeight, this._sizeConstraints.maxHeight), this._sizeConstraints.minHeight),
    });
  }

  protected autoBind (target: unknown) {
    if (target == null) return;
    if (typeof target !== 'object') return;
    if (isWindowLike(target)) {
      this.bindWindow(target);
    }
    if (target instanceof Element) {
      this.bindElement(target);
    }
  }

  bindElement (element: Element) {
    this.unbind();
    const onResize = () => {
      this.setConstraintRect(element.getBoundingClientRect());
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(element);
    window.addEventListener('resize', onResize);
    this._bound = [() => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    }];
    this.emit('break');
  }

  bindWindow (window: WindowLike) {
    this.unbind();
    const onResize = () => {
      this.setConstraintRect({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
    };
    onResize();
    window.addEventListener('resize', onResize);
    this._bound = [() => {
      window.removeEventListener('resize', onResize);
    }];
    this.emit('break');
  }

  unbind () {
    if (this._bound) {
      this._bound.forEach(fn => fn());
      this._bound = null;
    }
  }
}

export function isWindowLike (obj: unknown): obj is WindowLike {
  return ((obj as WindowLike).innerWidth != null) && ((obj as WindowLike).addEventListener != null);
}

export function getConstraintRect (rect: Rect | Element | WindowLike): Rect {
  if (isWindowLike(rect)) {
    return { x: 0, y: 0, width: rect.innerWidth, height: rect.innerHeight };
  }
  if (rect instanceof Element) {
    return rect.getBoundingClientRect();
  }
  return rect;
}

export function constraintRectToConstraints (rect: Rect): ConstraintEdges {
  return Object.freeze({
    left: rect.x,
    right: rect.x + rect.width,
    top: rect.y,
    bottom: rect.y + rect.height,
    width: rect.width,
    height: rect.height,
  });
}
