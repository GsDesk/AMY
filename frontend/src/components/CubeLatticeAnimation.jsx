import useAnimationActivity from '../hooks/useAnimationActivity';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { animate, createTimer, stagger, utils } from 'animejs';
import { getInstances, commitChanges } from 'animejs/adapters/three';
import './CubeLatticeAnimation.css';

const DEFAULT_HEX = {
    red: '#f43f5e',
    orange: '#fb923c',
    yellow: '#facc15',
    green: '#4ade80',
    sky: '#38bdf8',
    purple: '#a855f7',
    pink: '#f472b6',
};

/**
 * CubeLatticeAnimation
 * Official Anime.js v4 + Three.js 3D Instanced Mesh Lattice Demo
 */
export default function CubeLatticeAnimation({
    className = '',
    interactive = true
}) {
    const containerRef = useRef(null);
    const controlsRef = useRef(null);
    const active = useAnimationActivity(containerRef);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Container dimensions
        let width = container.clientWidth || window.innerWidth;
        let height = container.clientHeight || window.innerHeight;

        // 1. Three.js setup
        let renderer;
        try { renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'low-power'
        }); } catch { container.classList.add('webgl-unavailable'); return () => container.classList.remove('webgl-unavailable'); }
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 100);
        camera.position.set(0, 0, 4.5);
        scene.add(camera);

        scene.add(new THREE.AmbientLight(0xffffff, 0.35));
        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(2, 3, 4);
        scene.add(light);

        // 2. Geometry & Material (Exact user parameters)
        const gridSize = 6; // cubes per axis
        const cellSize = 2 / gridSize; // size of each cube
        const spread = ((gridSize - 1) / 2) * cellSize; // distance from center to outer cubes
        const geometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize);
        const material = new THREE.MeshLambertMaterial();
        const mesh = new THREE.InstancedMesh(geometry, material, gridSize * gridSize * gridSize);
        scene.add(mesh);

        // 3. Animation with Three.js adapter
        const instances = getInstances(mesh);
        const palette = ['red', 'orange', 'yellow', 'green', 'sky', 'purple', 'pink']
            .map(name => {
                const val = utils?.get ? utils.get(container, `--hex-${name}-1`) : null;
                return (val && val.trim()) || DEFAULT_HEX[name];
            });

        const gridAxis = (axis, span = spread) => stagger([-span, span], { grid: [gridSize, gridSize, gridSize], axis });

        // Slowly rotate the whole mesh
        const meshAnim = animate(mesh, {
            rotateY: 360,
            rotateX: 180,
            duration: 24000,
            loop: true,
            ease: 'linear',
        });

        // Color, scale and spread each instance, staggered from the center
        const instancesAnim = animate(instances, {
            color: palette,
            x: [gridAxis('x', spread * 0.25), gridAxis('x')],
            y: [gridAxis('y', spread * 0.25), gridAxis('y')],
            z: [gridAxis('z', spread * 0.25), gridAxis('z')],
            scale: [0.1, 0.25, 0.1],
            delay: stagger([0, 3000], { grid: [gridSize, gridSize, gridSize], from: 'center', reversed: true }),
            duration: 2000,
            loopDelay: 500,
            loop: true,
            alternate: true,
            ease: 'inOutQuad',
        });

        // 4. Timer loop with commitChanges
        const timer = createTimer({
            onUpdate: () => {
                commitChanges(mesh);
                renderer.render(scene, camera);
            }
        });

        controlsRef.current = [meshAnim, instancesAnim, timer];
        controlsRef.current.forEach(control => control.pause());
        instancesAnim.seek(1800);
        commitChanges(mesh);
        renderer.render(scene, camera);

        // 5. Parallax & Resize listeners
        const onMouseMove = (e) => {
            if (!interactive || timer.paused) return;
            const rect = container.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.35;
            const mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.35;
            camera.position.x = mouseX;
            camera.position.y = -mouseY;
            camera.lookAt(0, 0, 0);
        };

        const onResize = () => {
            if (!container) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w === 0 || h === 0) return;
            camera.aspect = w / h;
            if (w < h) {
                camera.position.z = 4.5 * Math.max(1, h / w);
            } else {
                camera.position.z = 4.5;
            }
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            renderer.render(scene, camera);
        };

        if (interactive) {
            container.addEventListener('pointermove', onMouseMove, { passive: true });
        }
        window.addEventListener('resize', onResize);
        onResize(); // Initial sizing check

        const resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(container);

        // 6. Cleanup
        return () => {
            if (interactive) {
                container.removeEventListener('pointermove', onMouseMove);
            }
            window.removeEventListener('resize', onResize);
            resizeObserver.disconnect();
            controlsRef.current = null;
            meshAnim?.pause?.();
            instancesAnim?.pause?.();
            timer?.pause?.();
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            if (container && renderer.domElement && container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, [interactive]);

    useEffect(() => {
        controlsRef.current?.forEach(control => active ? control.resume() : control.pause());
    }, [active]);

    return (
        <div
            ref={containerRef}
            className={`full-container anime-cube-lattice ${className}`}
            aria-hidden="true"
        />
    );
}
