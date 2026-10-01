import useAnimationActivity from '../hooks/useAnimationActivity';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './CubeLatticeAnimation.css';

// Paletas de marca por tema: el cubo pasa de celeste (centro) a violeta (bordes)
const PALETTES = {
    dark: { inner: '#38bdf8', mid: '#6366f1', outer: '#a855f7', accent: '#f0abfc', dust: '#7dd3fc', glowA: '#22d3ee', glowB: '#a855f7' },
    // Tonos luminosos (no oscuros) para que sobre blanco el cubo brille igual que en modo oscuro
    light: { inner: '#06b6d4', mid: '#818cf8', outer: '#a78bfa', accent: '#f472b6', dust: '#0284c7', glowA: '#22d3ee', glowB: '#c084fc' },
};

const GRID = 7;               // cubos por eje (343 en total)
const SPAN = 2.25;            // tamaño del cubo completo en unidades de escena
const INTRO_MS = 2200;        // duración del ensamblaje inicial
const DUST_COUNT = 160;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const currentTheme = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

/**
 * Cubo AMY vivo: los cubos se ensamblan en un gran cubo isométrico (como el logo),
 * respiran y se despliegan en ondas desde el centro, con luces de color que orbitan,
 * polvo de partículas y parallax suave con el puntero.
 */
export default function CubeLatticeAnimation({ className = '', interactive = true }) {
    const containerRef = useRef(null);
    const activeRef = useRef(false);
    const startLoopRef = useRef(null);
    const active = useAnimationActivity(containerRef);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
        } catch {
            container.classList.add('webgl-unavailable');
            return () => container.classList.remove('webgl-unavailable');
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 0, 8);

        // ── Luces: una principal blanca y dos de color que orbitan el cubo ──
        const ambient = new THREE.AmbientLight(0xffffff, 0.55);
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(3, 4, 5);
        const glowA = new THREE.PointLight(0xffffff, 18, 12, 1.6);
        const glowB = new THREE.PointLight(0xffffff, 18, 12, 1.6);
        scene.add(ambient, key, glowA, glowB);

        // ── Rejilla de cubos (InstancedMesh) ──
        const cell = SPAN / GRID;
        const half = (GRID - 1) / 2;
        const count = GRID * GRID * GRID;
        // Cubos con huecos amplios para que se vea el núcleo celeste a través de la rejilla
        const geometry = new THREE.BoxGeometry(cell * 0.62, cell * 0.62, cell * 0.62);
        const material = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.25 });
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const group = new THREE.Group();
        // Orientación isométrica (como el logo): 45° en Y y ~35.26° en X
        group.rotation.set(Math.atan(1 / Math.SQRT2), Math.PI / 4, 0);
        group.add(mesh);
        scene.add(group);

        const cubes = [];
        let maxDist = 0;
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                for (let z = 0; z < GRID; z++) {
                    const home = new THREE.Vector3((x - half) * cell, (y - half) * cell, (z - half) * cell);
                    const dist = home.length();
                    maxDist = Math.max(maxDist, dist);
                    // Posición de partida dispersa para el ensamblaje inicial
                    const dir = home.clone().normalize();
                    if (!Number.isFinite(dir.x)) dir.set(0, 1, 0);
                    const from = dir.multiplyScalar(4 + Math.random() * 3).add(
                        new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)
                    );
                    cubes.push({ home, dist, from, spin: Math.random() * Math.PI * 2, accent: Math.random() < 0.04 });
                }
            }
        }
        cubes.forEach((c) => { c.norm = c.dist / maxDist; });

        // ── Polvo de partículas alrededor ──
        const dustGeo = new THREE.BufferGeometry();
        const dustPos = new Float32Array(DUST_COUNT * 3);
        for (let i = 0; i < DUST_COUNT; i++) {
            const r = 2.6 + Math.random() * 2.4;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            dustPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            dustPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            dustPos[i * 3 + 2] = r * Math.cos(phi);
        }
        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
        const dustMat = new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.7, depthWrite: false });
        const dust = new THREE.Points(dustGeo, dustMat);
        scene.add(dust);

        // ── Colores según tema ──
        const cInner = new THREE.Color();
        const cMid = new THREE.Color();
        const cOuter = new THREE.Color();
        const cAccent = new THREE.Color();
        const cWhite = new THREE.Color('#ffffff');
        const tmpColor = new THREE.Color();
        let theme = '';
        const applyTheme = () => {
            const next = currentTheme();
            if (next === theme) return;
            theme = next;
            const p = PALETTES[theme];
            cInner.set(p.inner); cMid.set(p.mid); cOuter.set(p.outer); cAccent.set(p.accent);
            glowA.color.set(p.glowA);
            glowB.color.set(p.glowB);
            dustMat.color.set(p.dust);
            dustMat.opacity = theme === 'light' ? 0.55 : 0.7;
            ambient.intensity = theme === 'light' ? 1.25 : 0.55;
        };
        applyTheme();
        const themeObserver = new MutationObserver(() => { applyTheme(); if (!activeRef.current) renderFrame(lastT); });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // ── Parallax suavizado ──
        const pointer = { x: 0, y: 0 };
        const smooth = { x: 0, y: 0 };
        const onPointerMove = (e) => {
            const rect = container.getBoundingClientRect();
            pointer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            pointer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        };
        const onPointerLeave = () => { pointer.x = 0; pointer.y = 0; };

        // ── Fotograma ──
        const dummy = new THREE.Object3D();
        const target = new THREE.Vector3();
        const baseRot = { x: group.rotation.x, y: group.rotation.y };
        // Con movimiento reducido se muestra directamente el cubo ya ensamblado
        let lastT = reducedMotion ? INTRO_MS + 1200 : 0;

        const renderFrame = (t) => {
            const seconds = t / 1000;

            for (let i = 0; i < count; i++) {
                const c = cubes[i];
                // Ensamblaje escalonado: primero llegan los cubos del centro
                const k = easeOutCubic(Math.min(1, Math.max(0, (t - c.norm * 900) / INTRO_MS)));

                // Onda que viaja del centro a los bordes: el cubo "respira" y se despliega
                const wave = 0.5 + 0.5 * Math.sin(seconds * 1.6 - c.norm * 5.5);
                target.copy(c.home).multiplyScalar(1 + 0.18 * wave * c.norm * k);

                dummy.position.copy(c.from).lerp(target, k);
                const scale = (0.45 + 0.55 * k) * (0.6 + 0.45 * wave);
                dummy.scale.setScalar(scale);
                dummy.rotation.set(c.spin * (1 - k), c.spin * (1 - k), 0);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);

                // Color: celeste en el centro → índigo → violeta en los bordes; la cresta de la onda brilla
                if (c.norm < 0.5) tmpColor.copy(cInner).lerp(cMid, c.norm / 0.5);
                else tmpColor.copy(cMid).lerp(cOuter, (c.norm - 0.5) / 0.5);
                if (c.accent) tmpColor.lerp(cAccent, 0.7);
                tmpColor.lerp(cWhite, theme === 'light' ? wave * 0.22 : wave * 0.28);
                mesh.setColorAt(i, tmpColor);
            }
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

            // Giro lento + parallax
            smooth.x += (pointer.x - smooth.x) * 0.06;
            smooth.y += (pointer.y - smooth.y) * 0.06;
            group.rotation.y = baseRot.y + seconds * 0.18 + (interactive ? smooth.x * 0.35 : 0);
            group.rotation.x = baseRot.x + Math.sin(seconds * 0.4) * 0.06 + (interactive ? smooth.y * 0.25 : 0);

            // Luces de color orbitando
            glowA.position.set(Math.cos(seconds * 0.7) * 3.4, Math.sin(seconds * 0.9) * 1.6, Math.sin(seconds * 0.7) * 3.4);
            glowB.position.set(Math.cos(seconds * 0.7 + Math.PI) * 3.4, Math.cos(seconds * 0.8) * 1.6, Math.sin(seconds * 0.7 + Math.PI) * 3.4);

            dust.rotation.y = seconds * 0.04;
            dust.rotation.x = seconds * 0.015;

            renderer.render(scene, camera);
        };

        // ── Bucle (solo mientras está visible) ──
        let raf = 0;
        let startAt = 0;
        const loop = (now) => {
            if (!activeRef.current) { raf = 0; return; }
            if (!startAt) startAt = now - lastT;
            lastT = now - startAt;
            renderFrame(lastT);
            raf = requestAnimationFrame(loop);
        };
        startLoopRef.current = () => {
            if (raf || reducedMotion) return;
            startAt = 0;
            raf = requestAnimationFrame(loop);
        };

        // ── Tamaño ──
        const onResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (!w || !h) return;
            camera.aspect = w / h;
            // En paneles estrechos se aleja la cámara para que el cubo siga entrando completo
            camera.position.z = 8 * Math.max(1, (h / w) * 0.85);
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
            renderFrame(lastT);
        };
        const resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(container);
        onResize();

        if (interactive) {
            container.addEventListener('pointermove', onPointerMove, { passive: true });
            container.addEventListener('pointerleave', onPointerLeave);
        }
        if (activeRef.current) startLoopRef.current();

        return () => {
            cancelAnimationFrame(raf);
            startLoopRef.current = null;
            themeObserver.disconnect();
            resizeObserver.disconnect();
            if (interactive) {
                container.removeEventListener('pointermove', onPointerMove);
                container.removeEventListener('pointerleave', onPointerLeave);
            }
            geometry.dispose();
            material.dispose();
            dustGeo.dispose();
            dustMat.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
    }, [interactive]);

    // Pausa/reanuda según visibilidad de la página y preferencias de movimiento
    useEffect(() => {
        activeRef.current = active;
        if (active) startLoopRef.current?.();
    }, [active]);

    return (
        <div ref={containerRef} className={`full-container anime-cube-lattice ${className}`} aria-hidden="true">
            <div className="cube-lattice-glow" />
        </div>
    );
}
