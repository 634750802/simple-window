import type { DraggableTarget } from './draggable.js';
import type { Vector2 } from './rect.js';
import type { RectWindowVirtualBoundDOMElement } from './window.js';

export function getRequiredElement (root: RectWindowVirtualBoundDOMElement, query: DraggableTarget | string): DraggableTarget | null {
  if (typeof query === 'string') {
    if (root.querySelector) {
      return root.querySelector(query);
    } else {
      console.error('querySelector is not supported on', root);
      return null;
    }
  }
  return query;
}

export function getEventOffset (event: MouseEvent | TouchEvent): Vector2 | null {
  if (isTouchEvent(event)) {
    if (event.touches.length !== 1) {
      return null;
    }
    const { clientX, clientY } = event.touches.item(0)!;
    return { x: clientX, y: clientY };
  } else {
    return { x: event.clientX, y: event.clientY };
  }
}

export function getEventButton (event: MouseEvent | TouchEvent): number | null {
  if (isTouchEvent(event)) {
    return null;
  }
  return event.button;
}

function isTouchEvent (event: MouseEvent | TouchEvent): event is TouchEvent {
  return (event as TouchEvent).touches !== undefined;
}
