/**
 * G1: 3D ネットワーク図（Three.js）＋メッセージ粒子
 * ノード＝人間（球）、エッジ＝重要度 I[a][b]（線の太さ）、粒子＝メッセージ
 */
/// <reference path="../three-examples.d.ts" />
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HumanAgent } from '../types';
import type { ImportanceEdge } from '../types';

export interface NodeDatum {
  id: string;
  x?: number;
  y?: number;
  z?: number;
  agent?: HumanAgent;
}

export interface LinkDatum {
  source: string | NodeDatum;
  target: string | NodeDatum;
  value: number;
}

export interface ParticleMessage {
  id: string;
  from: string;
  to: string;
  kindLo: 'DIRECT' | 'DIFFUSE';
  processedBy: 'HUMAN' | 'AI';
  isReply: boolean;
  progress: number;
}

export interface NetworkOptions {
  width: number;
  height: number;
  container: HTMLElement;
  onNodePositions?: (nodes: Map<string, { x: number; y: number; z: number }>) => void;
}

interface Node3D {
  id: string;
  index: number;
  mesh: THREE.Mesh;
  ringOuter?: THREE.Mesh;
  ringInner?: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fixed: boolean;
}

interface Link3D {
  source: Node3D;
  target: Node3D;
  value: number;
  line: THREE.Line;
}

export class NetworkViz {
  private width: number;
  private height: number;
  private container: HTMLElement;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private nodes3d: Node3D[] = [];
  private links3d: Link3D[] = [];
  private particlePoints: THREE.Points | null = null;
  private particleData: { from: string; to: string; progress: number; processedBy: string; isReply: boolean }[] = [];
  private nodePositions = new Map<string, { x: number; y: number; z: number }>();
  private onNodePositions?: (nodes: Map<string, { x: number; y: number; z: number }>) => void;
  private rafId = 0;
  private showOverlay = false;
  private linkDistance = 3.5;
  private linkStrength = 0;
  private chargeStrength = -2.5;
  private chargeInverseDist = false;
  private spreadRadius = 5;
  private spreadStrength = 0.18;
  private readonly maxParticles = 500;
  private readonly maxSpeed = 0.15;
  /** true のときノードは初期配置のまま動かさない（一塊になるのを防ぐ） */
  private fixedLayout = true;

  constructor(options: NetworkOptions) {
    this.width = options.width;
    this.height = options.height;
    this.container = options.container;
    this.onNodePositions = options.onNodePositions;
  }

  setDimensions(w: number, h: number): void {
    this.width = w;
    this.height = h;
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.renderer) this.renderer.setSize(w, h);
  }

  setShowOverlay(show: boolean): void {
    this.showOverlay = show;
  }

  init(nodes: NodeDatum[], links: LinkDatum[]): void {
    this.container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'network-wrap';
    wrap.style.position = 'relative';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    wrap.style.minHeight = '400px';
    this.container.appendChild(wrap);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1810);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 1000);
    camera.position.set(0, 0, 12);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(this.width, this.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    wrap.appendChild(renderer.domElement);
    this.renderer = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 4;
    controls.maxDistance = 40;
    this.controls = controls;

    const ambient = new THREE.AmbientLight(0x404040);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xe8e0c8, 0.8);
    dir.position.set(2, 2, 2);
    scene.add(dir);

    const nodeIdToNode = new Map<string, Node3D>();
    const geom = new THREE.SphereGeometry(0.08, 16, 12);
    const mat = new THREE.MeshPhongMaterial({
      color: 0xc4a035,
      emissive: 0x2a2520,
      shininess: 30,
    });
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const t = (i + 0.5) / nodes.length;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + 5 ** 0.5) * i;
      const r = 4.5;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      const mesh = new THREE.Mesh(geom.clone(), mat.clone());
      mesh.position.set(x, y, z);
      scene.add(mesh);
      const ringOuterGeom = new (THREE as any).RingGeometry(0.10, 0.14, 32);
      const ringInnerGeom = new (THREE as any).RingGeometry(0.06, 0.09, 32);
      const ringMatOuter = new (THREE as any).MeshBasicMaterial({
        color: 0xe8c040,
        transparent: true,
        opacity: 0.5,
        side: 2,
      });
      const ringMatInner = new (THREE as any).MeshBasicMaterial({
        color: 0x70b050,
        transparent: true,
        opacity: 0.5,
        side: 2,
      });
      const ringOuter = new THREE.Mesh(ringOuterGeom, ringMatOuter);
      ringOuter.rotation.x = Math.PI / 2;
      mesh.add(ringOuter);
      const ringInner = new THREE.Mesh(ringInnerGeom, ringMatInner);
      ringInner.rotation.x = Math.PI / 2;
      mesh.add(ringInner);
      const node3: Node3D = {
        id: n.id,
        index: i,
        mesh,
        ringOuter,
        ringInner,
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        fixed: false,
      };
      this.nodes3d.push(node3);
      nodeIdToNode.set(n.id, node3);
    }

    const linkLineMat = new THREE.LineBasicMaterial({
      color: 0xb4a064,
      opacity: 0.7,
      transparent: true,
    });
    for (const l of links) {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      const src = nodeIdToNode.get(srcId);
      const tgt = nodeIdToNode.get(tgtId);
      if (!src || !tgt) continue;
      const points = [
        new THREE.Vector3(src.x, src.y, src.z),
        new THREE.Vector3(tgt.x, tgt.y, tgt.z),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeom, linkLineMat.clone());
      line.visible = false;
      scene.add(line);
      this.links3d.push({ source: src, target: tgt, value: l.value, line });
    }

    const particleGeom = new THREE.BufferGeometry();
    const posArr = new Float32Array(this.maxParticles * 3);
    const colArr = new Float32Array(this.maxParticles * 3);
    particleGeom.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    particleGeom.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    particleGeom.setDrawRange(0, 0);
    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      sizeAttenuation: true,
    });
    const particlePoints = new THREE.Points(particleGeom, particleMat);
    scene.add(particlePoints);
    this.particlePoints = particlePoints;

    this.syncPositions();
    this.onNodePositions?.(new Map(this.nodePositions));

    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      this.tickForces();
      this.updateLinkLines();
      this.updateParticleInstances();
      if (this.controls) this.controls.update();
      if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  private tickForces(): void {
    if (this.fixedLayout) {
      this.syncPositions();
      this.onNodePositions?.(new Map(this.nodePositions));
      return;
    }
    const nodes = this.nodes3d;
    const links = this.links3d;
    const dt = 0.016;
    const d = this.linkDistance;
    const k = this.linkStrength;
    const c = this.chargeStrength;
    const maxSpeed = this.maxSpeed;
    const damping = 0.84;
    const spreadR = this.spreadRadius;
    const spreadK = this.spreadStrength;

    for (const n of nodes) {
      n.vx *= damping;
      n.vy *= damping;
      n.vz *= damping;
      if (n.fixed) continue;
      const distFromCenter = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) + 0.01;
      if (distFromCenter < spreadR) {
        let push = ((spreadR - distFromCenter) / spreadR) * spreadK * dt;
        if (distFromCenter < 1.0) push *= 3;
        let ux: number, uy: number, uz: number;
        if (distFromCenter < 0.5) {
          const t = (n.index + 0.5) / nodes.length;
          const phi = Math.acos(1 - 2 * t);
          const theta = Math.PI * (1 + 5 ** 0.5) * n.index;
          ux = Math.sin(phi) * Math.cos(theta);
          uy = Math.sin(phi) * Math.sin(theta);
          uz = Math.cos(phi);
        } else {
          ux = n.x / distFromCenter;
          uy = n.y / distFromCenter;
          uz = n.z / distFromCenter;
        }
        n.vx += ux * push;
        n.vy += uy * push;
        n.vz += uz * push;
      }
      for (const o of nodes) {
        if (o === n) continue;
        const dx = n.x - o.x;
        const dy = n.y - o.y;
        const dz = n.z - o.z;
        const distSq = dx * dx + dy * dy + dz * dz + 0.04;
        const dist = Math.sqrt(distSq);
        const f = this.chargeInverseDist
          ? (c / (dist + 0.3)) * dt
          : (c / distSq) * dt;
        n.vx += (dx / dist) * f;
        n.vy += (dy / dist) * f;
        n.vz += (dz / dist) * f;
      }
    }
    for (const l of links) {
      const dx = l.target.x - l.source.x;
      const dy = l.target.y - l.source.y;
      const dz = l.target.z - l.source.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
      const force = (dist - d) * k * Math.min(1, l.value * 1.5) * dt;
      const sx = (dx / dist) * force;
      const sy = (dy / dist) * force;
      const sz = (dz / dist) * force;
      if (!l.source.fixed) {
        l.source.vx += sx;
        l.source.vy += sy;
        l.source.vz += sz;
      }
      if (!l.target.fixed) {
        l.target.vx -= sx;
        l.target.vy -= sy;
        l.target.vz -= sz;
      }
    }
    for (const n of nodes) {
      let vx = n.vx;
      let vy = n.vy;
      let vz = n.vz;
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        vx *= scale;
        vy *= scale;
        vz *= scale;
      }
      n.vx = vx;
      n.vy = vy;
      n.vz = vz;
      n.x += vx;
      n.y += vy;
      n.z += vz;
      n.mesh.position.set(n.x, n.y, n.z);
    }
    this.syncPositions();
    this.onNodePositions?.(new Map(this.nodePositions));
  }

  private syncPositions(): void {
    this.nodePositions.clear();
    for (const n of this.nodes3d) {
      this.nodePositions.set(n.id, { x: n.x, y: n.y, z: n.z });
    }
  }

  private updateLinkLines(): void {
    for (const l of this.links3d) {
      const pos = (l.line.geometry as THREE.BufferGeometry).attributes
        .position as THREE.BufferAttribute;
      pos.setXYZ(0, l.source.x, l.source.y, l.source.z);
      pos.setXYZ(1, l.target.x, l.target.y, l.target.z);
      pos.needsUpdate = true;
    }
  }

  updateLinks(edges: ImportanceEdge[]): void {
    if (!this.scene) return;
    const nodeIdToNode = new Map(this.nodes3d.map((n) => [n.id, n]));
    this.links3d.forEach((l) => {
      this.scene!.remove(l.line);
      l.line.geometry.dispose();
      (l.line.material as THREE.Material).dispose();
    });
    this.links3d = [];
    const linkLineMat = new THREE.LineBasicMaterial({
      color: 0xb4a064,
      opacity: 0.7,
      transparent: true,
    });
    for (const e of edges) {
      const src = nodeIdToNode.get(e.from);
      const tgt = nodeIdToNode.get(e.to);
      if (!src || !tgt) continue;
      const points = [
        new THREE.Vector3(src.x, src.y, src.z),
        new THREE.Vector3(tgt.x, tgt.y, tgt.z),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeom, linkLineMat.clone());
      line.visible = false;
      this.scene.add(line);
      this.links3d.push({ source: src, target: tgt, value: e.value, line });
    }
  }

  addParticle(from: string, to: string, _kindLo: 'DIRECT' | 'DIFFUSE', processedBy: 'HUMAN' | 'AI', isReply: boolean): void {
    this.particleData.push({
      from,
      to,
      progress: 0,
      processedBy,
      isReply,
    });
  }

  tickParticles(dt: number): void {
    const speed = 1.2;
    for (const p of this.particleData) p.progress = Math.min(1, p.progress + dt * speed);
    this.particleData = this.particleData.filter((p) => p.progress < 1);
  }

  private updateParticleInstances(): void {
    if (!this.particlePoints) return;
    const geom = this.particlePoints.geometry;
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geom.getAttribute('color') as THREE.BufferAttribute;
    const data = this.particleData.slice(0, this.maxParticles);
    const showOverlay = this.showOverlay;
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      const fromPos = this.nodePositions.get(p.from);
      const toPos = this.nodePositions.get(p.to);
      if (!fromPos || !toPos) continue;
      const x = fromPos.x + (toPos.x - fromPos.x) * p.progress;
      const y = fromPos.y + (toPos.y - fromPos.y) * p.progress;
      const z = fromPos.z + (toPos.z - fromPos.z) * p.progress;
      posAttr.setXYZ(i, x, y, z);
      if (showOverlay) {
        const r = p.processedBy === 'AI' ? 1 : 0.39;
        const g = p.processedBy === 'AI' ? 0.39 : 0.86;
        const b = p.processedBy === 'AI' ? 0.39 : 0.39;
        colAttr.setXYZ(i, r, g, b);
      } else {
        colAttr.setXYZ(i, 0.86, 0.78, 0.47);
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geom.setDrawRange(0, data.length);
  }

  /** ノード行動状態 v2.0：外側リング＝perceived、内側リング＝real */
  updateNodeBehaviors(behavior: Map<string, { perceived_social_health: number; real_social_health: number }>): void {
    for (const n of this.nodes3d) {
      const b = behavior.get(n.id);
      if (!b) continue;
      if (n.ringOuter?.material && 'opacity' in n.ringOuter.material) {
        (n.ringOuter.material as { opacity: number }).opacity = 0.2 + 0.8 * b.perceived_social_health;
      }
      if (n.ringInner?.material && 'opacity' in n.ringInner.material) {
        (n.ringInner.material as { opacity: number }).opacity = 0.2 + 0.8 * b.real_social_health;
      }
    }
  }

  getNodePositions(): Map<string, { x: number; y: number; z: number }> {
    return new Map(this.nodePositions);
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.renderer?.domElement ?? null;
  }

  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.nodes3d = [];
    this.links3d = [];
    this.particleData = [];
    if (this.particlePoints) {
      this.particlePoints.geometry.dispose();
      (this.particlePoints.material as THREE.Material).dispose();
    }
    this.renderer?.dispose();
    this.container.innerHTML = '';
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.particlePoints = null;
  }
}
