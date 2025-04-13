# Simple widow

Simple as the name.

View index.html and dev.ts for examples.


## Layouts

### ConstraintRectLayout

```ts
import { RectWindowCollection, ConstraintRectLayout } from 'simple-window'

const layout = new ConstraintRectLayout(window, {
  minWidth: 200,
  minHeight: 200,
  maxWidth: 300,
  maxHeight: 300,
});

const collection = new RectWindowCollection({
  /* This config was deprecated */
  defaultConstraintPadding: {
    top: NaN,
    left: NaN,
    right: NaN,
    bottom: NaN,
  },
  layout,
});

const window = collection.newWindow({ props: undefined });

window.bind(el)
```

```html
<!-- Standard binding element shape -->
<div>
  <div data-rect-draggable-handler data-rect-move="allow">
    <button onclick="window.makeDialog(${window.id})">+</button>
    <button onclick="window.removeDialog(${window.id})">-</button>
    <button onclick="window.destroyWindow(${window.id})">x</button>
  </div>
  <div
    style="
      width: 100%; 
      height: calc(100% - 32px); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-size: 48px; 
      font-weight: bold;
      word-break: break-word; 
      overflow: hidden
    "
  >
    The content of your window
  </div>
  <div data-rect-draggable-edge="left"></div>
  <div data-rect-draggable-edge="right"></div>
  <div data-rect-draggable-edge="bottom"></div>
  <div data-rect-draggable-corner="bottom-left"></div>
  <div data-rect-draggable-corner="bottom-right"></div>
</div>
```