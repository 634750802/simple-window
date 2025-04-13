import type { RectLayoutVirtualProperties } from './layouts/base.js';
import type { Rect } from './rect.js';

export type CaptureKeyframeScaleMutation = {
  type: 'scale'
  scale: number
  origin?: [number, number]
};

export type CaptureKeyframeMatrixMutation = DOMMatrix;

export type CaptureKeyframeMutation = CaptureKeyframeScaleMutation | CaptureKeyframeMatrixMutation;

export function applyCaptureKeyframeMutations (virtual: RectLayoutVirtualProperties, mutation: CaptureKeyframeMutation | undefined): Keyframe {
  let m = virtual.transform;
  if (mutation) {
    if (!(mutation instanceof DOMMatrix)) {
      switch (mutation.type) {
        case 'scale':
          mutation = new DOMMatrix()
            .scaleSelf(mutation.scale, mutation.scale, 1, virtual.width.value / 2, virtual.height.value / 2, 0);
      }
    }
    m = m.multiply(mutation);
  }

  return {
    left: virtual.left.toString(),
    top: virtual.top.toString(),
    transform: m.toString(),
    width: virtual.width.toString(),
    height: virtual.height.toString(),
    transformOrigin: virtual.transformOrigin.join(' '),
  };
}

function sizeToMatrix (size: Pick<Rect, 'width' | 'height'>): DOMMatrix {
  return new DOMMatrix([
    size.width, 0, 0, 0,
    0, size.height, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 0,
  ]);
}