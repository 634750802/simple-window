import { ConstraintGridRectLayout, ConstraintRectLayout, DialogLayout, RectWindowCollection } from './src/index.js';

const collection = new RectWindowCollection({
  defaultConstraintPadding: {
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
  },
  layout: new ConstraintRectLayout({
    x: 8, y: 8, width: window.innerWidth - 16, height: window.innerHeight - 16,
  }, {
    minWidth: 200,
    minHeight: 200,
    maxWidth: 300,
    maxHeight: 300,
  }),
});

collection.watchWindowResize();

let i = 0;
document.querySelector('#add')!.addEventListener('click', () => {
  const window = collection.newWindow({
    props: undefined,
  });
  const div = document.createElement('div');

  div.classList.add(`rect-${window.id}`);

  div.innerHTML = `
  <div data-rect-draggable-handler data-rect-move="allow">
  <button onclick="window.makeDialog(${window.id})">+</button>
  <button onclick="window.removeDialog(${window.id})">-</button>
  <button onclick="window.destroyWindow(${window.id})">x</button>
</div>
  <div style="width: 100%; height: calc(100% - 32px); display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: bold">${++i}</div>
  <div data-rect-draggable-edge="left"></div>
  <div data-rect-draggable-edge="right"></div>
  <div data-rect-draggable-edge="bottom"></div>
  <div data-rect-draggable-corner="bottom-left"></div>
  <div data-rect-draggable-corner="bottom-right"></div>
`;

  window.bind(div);
  window.once('destroy', () => {
    div.remove();
  });
  document.body.appendChild(div);
});

(document.querySelector('#add')! as HTMLButtonElement).click();

let constraint = true;
document.getElementById('layout-switch')!.addEventListener('click', () => {
  if (constraint) {
    constraint = false;
    collection.layout = new ConstraintGridRectLayout(12, 12, collection.getDefaultConstraint(), {
      minCols: 2,
      maxCols: 4,
      minRows: 2,
      maxRows: 4,
      suggestionCols: 3,
      suggestionRows: 3,
    });
    collection.bindConstraintElement(document.getElementById('constraint')!);
  } else {
    constraint = true;
    collection.unbindConstraintElement();
    collection.layout = new ConstraintRectLayout(collection.getDefaultConstraint(), {
      minWidth: 200,
      minHeight: 200,
      maxWidth: 300,
      maxHeight: 300,
    });
  }
});

function makeDialog (id: number) {
  event?.stopPropagation();
  collection.getWindow(id)?.setLayout(new DialogLayout());
}

function removeDialog (id: number) {
  event?.stopPropagation();
  collection.getWindow(id)?.setLayout(undefined);
}

function destroyWindow (id: number) {
  event?.stopPropagation();
  collection.getWindow(id)?.destroy();
}

declare global {
  interface Window {
    collection: RectWindowCollection<any>;
    makeDialog: (id: number) => void;
    removeDialog: (id: number) => void;
    destroyWindow: (id: number) => void;
  }
}

window.collection = collection;
window.makeDialog = makeDialog;
window.removeDialog = removeDialog;
window.destroyWindow = destroyWindow;
