import { makeVector2, type Vector2 } from './rect.js';
import { getEventButton, getEventOffset } from './utils.js';

export interface IDisposable {
  (): void;
}

type DraggableEventsMap = {
  'mousedown': MouseEvent;
  'mouseenter': MouseEvent;
  'mouseleave': MouseEvent;
  'mousemove': MouseEvent;
  'mouseout': MouseEvent;
  'mouseover': MouseEvent;
  'mouseup': MouseEvent;
  'touchcancel': TouchEvent;
  'touchend': TouchEvent;
  'touchmove': TouchEvent;
  'touchstart': TouchEvent;
}

export interface DraggableTarget {
  readonly dataset?: DOMStringMap;

  addEventListener<K extends keyof DraggableEventsMap> (type: K, listener: (event: DraggableEventsMap[K]) => void): void;

  removeEventListener<K extends keyof DraggableEventsMap> (type: K, listener: (event: DraggableEventsMap[K]) => void): void;
}

export function bindDraggable (
  target: DraggableTarget,
  eventConstraint: DraggableTarget,
  cursor: CSSStyleDeclaration['cursor'],
  allow: () => boolean,
  onStart: () => void,
  onOffset: (offset: Vector2, delta: Vector2) => void,
  onEnd: () => void,
): IDisposable {
  const disposables: IDisposable[] = [];

  let animationFrameHandler = 0;
  let start: Vector2 = { x: 0, y: 0 };
  let uncommittedDelta: Vector2 = { x: 0, y: 0 };
  let last: Vector2 = { x: 0, y: 0 };
  let currentDisposable: IDisposable | null = null;

  const handleMouseStart = (event: MouseEvent | TouchEvent) => {
    if (!allow()) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }

    const button = getEventButton(event);

    if (button !== 0 && button != null) {
      return;
    }

    const eventOffset = getEventOffset(event);
    if (!eventOffset) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    start = makeVector2(eventOffset);

    last = start;

    eventConstraint.addEventListener('mousemove', handleMouseMove);
    eventConstraint.addEventListener('mouseup', handleMouseUp);
    eventConstraint.addEventListener('touchmove', handleMouseMove);
    eventConstraint.addEventListener('touchend', handleMouseUp);
    eventConstraint.addEventListener('touchcancel', handleMouseUp);
    currentDisposable = () => {
      eventConstraint.removeEventListener('mousemove', handleMouseMove);
      eventConstraint.removeEventListener('mouseup', handleMouseUp);
      eventConstraint.removeEventListener('touchmove', handleMouseMove);
      eventConstraint.removeEventListener('touchend', handleMouseUp);
      eventConstraint.removeEventListener('touchcancel', handleMouseUp);
      currentDisposable = null;
    };

    if (target.dataset) {
      target.dataset.dragging = 'true';
    }

    document.documentElement.style.cursor = `${cursor}`;
    document.documentElement.style.setProperty('cursor', cursor, 'important');
    onStart();
  };

  const handleMouseMove = (event: MouseEvent | TouchEvent) => {
    const eventOffset = getEventOffset(event);
    if (!eventOffset) {
      return;
    }

    uncommittedDelta = makeVector2({
      x: eventOffset.x - last.x + uncommittedDelta.x,
      y: eventOffset.y - last.y + uncommittedDelta.y,
    });
    const offset = makeVector2({
      x: eventOffset.x - start.x,
      y: eventOffset.y - start.y,
    });
    last = makeVector2({
      x: eventOffset.x,
      y: eventOffset.y,
    });

    cancelAnimationFrame(animationFrameHandler);
    animationFrameHandler = requestAnimationFrame(() => {
      onOffset(offset, uncommittedDelta);
      uncommittedDelta = makeVector2({ x: 0, y: 0 });
    });
  };

  const handleMouseUp = () => {
    eventConstraint.removeEventListener('mousemove', handleMouseMove);
    eventConstraint.removeEventListener('mouseup', handleMouseUp);
    eventConstraint.removeEventListener('touchmove', handleMouseMove);
    eventConstraint.removeEventListener('touchend', handleMouseUp);
    currentDisposable = null;
    if (target.dataset) {
      delete target.dataset.dragging;
    }
    document.documentElement.style.cursor = '';
    onEnd();
  };

  target.addEventListener('mousedown', handleMouseStart);
  target.addEventListener('touchstart', handleMouseStart);

  disposables.push(() => {
    target.removeEventListener('mousedown', handleMouseStart);
    target.removeEventListener('touchstart', handleMouseStart);
  });

  return () => {
    cancelAnimationFrame(animationFrameHandler);
    disposables.forEach(dispose => dispose());
    currentDisposable?.();
  };
}
