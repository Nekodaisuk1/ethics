declare module 'three' {
  export const Scene: any;
  export type Scene = any;
  export const Mesh: any;
  export type Mesh = any;
  export const Line: any;
  export type Line = any;
  export const PerspectiveCamera: any;
  export type PerspectiveCamera = any;
  export const WebGLRenderer: any;
  export type WebGLRenderer = any;
  export const Points: any;
  export type Points = any;
  export const BufferGeometry: any;
  export type BufferGeometry = any;
  export const BufferAttribute: any;
  export type BufferAttribute = any;
  export const Material: any;
  export type Material = any;
  export const SphereGeometry: any;
  export const RingGeometry: any;
  export const MeshPhongMaterial: any;
  export const MeshBasicMaterial: any;
  export const LineBasicMaterial: any;
  export const Vector3: any;
  export const Color: any;
  export const AmbientLight: any;
  export const DirectionalLight: any;
  export const PointsMaterial: any;
}

declare module 'three/examples/jsm/controls/OrbitControls.js' {
  export class OrbitControls {
    constructor(camera: unknown, domElement?: HTMLElement);
    enableDamping: boolean;
    dampingFactor: number;
    screenSpacePanning: boolean;
    minDistance: number;
    maxDistance: number;
    update(): void;
  }
}
