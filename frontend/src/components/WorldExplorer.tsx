import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SparkControls, SparkRenderer, SplatLoader, SplatMesh } from '@sparkjsdev/spark';
import { useAppStore } from '../store';
import './WorldExplorer.css';

const DEBUG = true;

function disposeObject3D(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
    } else if (mesh.material) {
      mesh.material.dispose();
    }
  });
}

export default function WorldExplorer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldAssets = useAppStore((s) => s.worldAssets);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const splatCandidates = useMemo(() => {
    if (!worldAssets) return [];

    const urls: string[] = [];
    const push = (value: string | null | undefined) => {
      if (!value) return;
      if (!urls.includes(value)) urls.push(value);
    };

    push(worldAssets.defaultSpzUrl);
    push(worldAssets.spzUrls.full_res);
    push(worldAssets.spzUrls['500k']);
    push(worldAssets.spzUrls['100k']);
    for (const url of Object.values(worldAssets.spzUrls)) {
      push(url);
    }
    return urls;
  }, [worldAssets]);

  const panoUrl = worldAssets?.panoUrl ?? null;
  const colliderMeshUrl = worldAssets?.colliderMeshUrl ?? null;

  useEffect(() => {
    const mount = mountRef.current;
    console.log('[WORLD-RENDER] mount:', {
      hasMount: Boolean(mount),
      candidateCount: splatCandidates.length,
      candidates: splatCandidates,
      panoUrl,
      colliderMeshUrl,
    });
    if (!mount || splatCandidates.length === 0) {
      setError('No renderable splat URL returned by backend.');
      setIsLoading(false);
      console.error('[WORLD-RENDER] aborted: missing mount or splat URL candidates');
      return;
    }

    setError(null);
    setIsLoading(true);
    setProgress(0);

    let disposed = false;
    let worldMesh: SplatMesh | null = null;
    let colliderRoot: THREE.Object3D | null = null;
    let panoTexture: THREE.Texture | null = null;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010409);
    const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 1000);
    camera.position.set(0, 1.5, 4);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const resize = () => {
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;
      if (width <= 0 || height <= 0) {
        console.warn('[WORLD-RENDER] resize produced non-positive canvas size', { width, height });
      }
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, true);
    };
    window.addEventListener('resize', resize);
    resize();

    const controls = new SparkControls({ canvas });
    // Guided viewing only: allow look/rotate, disable free movement/translation.
    controls.fpsMovement.enable = false;
    controls.pointerControls.slideSpeed = 0;
    controls.pointerControls.scrollSpeed = 0;
    // Keep inertia > 0. A zero value causes NaN on first frame (deltaTime=0).
    controls.pointerControls.moveInertia = 0.15;

    const splatLoader = new SplatLoader();
    const textureLoader = new THREE.TextureLoader();
    const gltfLoader = new GLTFLoader();

    const findSparkRenderer = (): SparkRenderer | null => {
      let found: SparkRenderer | null = null;
      scene.traverse((node) => {
        if (!found && node instanceof SparkRenderer) {
          found = node;
        }
      });
      return found;
    };

    const sampleCenterPixel = (): number[] | null => {
      try {
        const gl = renderer.getContext();
        const width = renderer.domElement.width;
        const height = renderer.domElement.height;
        if (width <= 0 || height <= 0) return null;
        if ('PIXEL_PACK_BUFFER_BINDING' in gl) {
          const gl2 = gl as WebGL2RenderingContext;
          const pixelPackBinding = gl2.getParameter(gl2.PIXEL_PACK_BUFFER_BINDING);
          if (pixelPackBinding) {
            return null;
          }
        }
        const pixel = new Uint8Array(4);
        gl.readPixels(
          Math.floor(width / 2),
          Math.floor(height / 2),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        );
        return [pixel[0], pixel[1], pixel[2], pixel[3]];
      } catch {
        return null;
      }
    };

    const debugWindow = window as Window & {
      __worldDebug?: Record<string, unknown>;
    };
    debugWindow.__worldDebug = {
      scene,
      camera,
      renderer,
      worldMesh: null,
      getSpark: () => findSparkRenderer(),
      sampleCenterPixel,
    };

    const to3 = (v: THREE.Vector3) => [
      Number(v.x.toFixed(4)),
      Number(v.y.toFixed(4)),
      Number(v.z.toFixed(4)),
    ];

    const ensureFiniteCamera = () => {
      const finite =
        Number.isFinite(camera.position.x) &&
        Number.isFinite(camera.position.y) &&
        Number.isFinite(camera.position.z) &&
        Number.isFinite(camera.quaternion.x) &&
        Number.isFinite(camera.quaternion.y) &&
        Number.isFinite(camera.quaternion.z) &&
        Number.isFinite(camera.quaternion.w);

      if (finite) return;

      console.warn('[WORLD-RENDER] camera became non-finite; resetting pose');
      camera.position.set(0, 1.5, 4);
      camera.quaternion.set(0, 0, 0, 1);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    };

    const logSparkState = (tag: string) => {
      const spark = findSparkRenderer();
      const activeSplats = spark?.active?.splats?.numSplats ?? 'n/a';
      const uniformSplats = spark?.uniforms?.numSplats?.value ?? 'n/a';
      const viewpointSplats = spark?.viewpoint?.display?.accumulator?.splats?.numSplats ?? 'n/a';
      const displayGeometry = spark?.viewpoint?.display?.geometry;
      const instanceCount = displayGeometry?.instanceCount ?? null;
      const orderingHead = displayGeometry?.ordering
        ? Array.from(displayGeometry.ordering.slice(0, 8))
        : null;
      const renderToViewPos = spark?.uniforms?.renderToViewPos?.value as THREE.Vector3 | undefined;
      const renderToViewQuat = spark?.uniforms?.renderToViewQuat?.value as THREE.Quaternion | undefined;
      const payload = {
        sceneChildren: scene.children.map((child) => child.type),
        sparkDetected: Boolean(spark),
        sparkVisible: spark?.visible ?? null,
        sparkFrustumCulled: spark?.frustumCulled ?? null,
        sparkPosition: spark ? to3(spark.position) : null,
        sparkNear: spark?.uniforms?.near?.value ?? null,
        sparkFar: spark?.uniforms?.far?.value ?? null,
        renderToViewPos: renderToViewPos ? to3(renderToViewPos) : null,
        renderToViewQuat: renderToViewQuat
          ? [
              Number(renderToViewQuat.x.toFixed(4)),
              Number(renderToViewQuat.y.toFixed(4)),
              Number(renderToViewQuat.z.toFixed(4)),
              Number(renderToViewQuat.w.toFixed(4)),
            ]
          : null,
        worldMeshVisible: worldMesh?.visible ?? null,
        worldMeshSplats: worldMesh?.numSplats ?? null,
        activeSplats,
        uniformSplats,
        viewpointSplats,
        instanceCount,
        orderingHead,
        centerPixel: sampleCenterPixel(),
        cameraPosition: to3(camera.position),
      };
      console.log(`[WORLD-RENDER] ${tag} ${JSON.stringify(payload)}`);
    };

    const frameCameraToWorld = (mesh: SplatMesh) => {
      const bounds = mesh.getBoundingBox(true);
      if (bounds.isEmpty()) {
        console.warn('[WORLD-RENDER] mesh bounds are empty; using default camera pose');
        return;
      }

      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z, 0.01) * 0.5;
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const distance = (radius / Math.tan(fov / 2)) * 1.25;

      camera.position.set(center.x, center.y + radius * 0.12, center.z + distance);
      camera.near = Math.max(0.01, distance / 1000);
      camera.far = Math.max(1000, distance + radius * 30);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      console.log('[WORLD-RENDER] camera framed:', {
        boundsMin: to3(bounds.min),
        boundsMax: to3(bounds.max),
        center: to3(center),
        radius: Number(radius.toFixed(4)),
        distance: Number(distance.toFixed(4)),
        cameraPosition: to3(camera.position),
        near: Number(camera.near.toFixed(5)),
        far: Number(camera.far.toFixed(3)),
      });
    };

    const analyzeSplatFacing = (mesh: SplatMesh, sampleTarget = 4000) => {
      const total = mesh.numSplats ?? 0;
      if (total <= 0) {
        console.warn('[WORLD-RENDER] analyzeSplatFacing skipped: no splats');
        return;
      }

      camera.updateMatrixWorld(true);
      mesh.updateMatrixWorld(true);
      const worldToCamera = camera.matrixWorld.clone().invert();
      const step = Math.max(1, Math.floor(total / sampleTarget));
      let sampled = 0;
      let inFront = 0;
      let behind = 0;
      const worldPos = new THREE.Vector3();
      const viewPos = new THREE.Vector3();

      mesh.forEachSplat((index, center) => {
        if (index % step !== 0) return;
        sampled += 1;
        worldPos.copy(center).applyMatrix4(mesh.matrixWorld);
        viewPos.copy(worldPos).applyMatrix4(worldToCamera);
        if (viewPos.z < 0) inFront += 1;
        else behind += 1;
      });

      console.log('[WORLD-RENDER] splat facing sample:', {
        totalSplats: total,
        sampled,
        inFront,
        behind,
        frontRatio: sampled > 0 ? Number((inFront / sampled).toFixed(4)) : 0,
      });
    };

    const loadWorld = async () => {
      try {
        if (panoUrl) {
          try {
            panoTexture = await textureLoader.loadAsync(panoUrl);
            if (!disposed) {
              panoTexture.colorSpace = THREE.SRGBColorSpace;
              panoTexture.mapping = THREE.EquirectangularReflectionMapping;
              scene.background = panoTexture;
            }
          } catch {
            // Non-blocking: pano is optional.
          }
        }

        let packedSplats: Awaited<ReturnType<SplatLoader['loadAsync']>> | null = null;
        let lastError: unknown = null;
        for (const candidateUrl of splatCandidates) {
          if (disposed) return;
          console.log('[WORLD-RENDER] loading splat candidate:', candidateUrl);
          try {
            const loadedSplats = await splatLoader.loadAsync(
              candidateUrl,
              (event: { loaded?: number; total?: number }) => {
                if (disposed) return;
                const loaded = event.loaded ?? 0;
                const total = event.total ?? 0;
                if (total > 0) {
                  setProgress(Math.max(0, Math.min(0.95, loaded / total)));
                }
              },
            );
            packedSplats = loadedSplats;
            console.log('[WORLD-RENDER] loaded splat candidate OK:', {
              candidateUrl,
              numSplats: (loadedSplats as { numSplats?: number }).numSplats ?? 'unknown',
            });
            if (candidateUrl !== splatCandidates[0]) {
              console.warn('[WORLD] Falling back to alternate splat URL:', candidateUrl);
            }
            break;
          } catch (err) {
            lastError = err;
            console.warn('[WORLD] Failed to load splat URL:', candidateUrl, err);
          }
        }

        if (!packedSplats) {
          throw (lastError instanceof Error ? lastError : new Error('Unable to load any splat URL'));
        }
        if (disposed) return;

        worldMesh = new SplatMesh({ packedSplats, editable: false });
        worldMesh.quaternion.set(1, 0, 0, 0);  // 180° X rotation: OpenCV→OpenGL coord flip
        worldMesh.frustumCulled = false;
        scene.add(worldMesh);
        debugWindow.__worldDebug = { ...debugWindow.__worldDebug, worldMesh };
        logSparkState('world mesh added');
        await worldMesh.initialized;
        if (disposed) return;
        console.log('[WORLD-RENDER] SplatMesh initialized');
        frameCameraToWorld(worldMesh);
        analyzeSplatFacing(worldMesh);
        logSparkState('after world mesh init');

        if (colliderMeshUrl) {
          try {
            const gltf = await gltfLoader.loadAsync(colliderMeshUrl);
            if (!disposed) {
              colliderRoot = gltf.scene;
              // Collider mesh is for physics/raycasting only — hide it visually
              // to prevent rendering artifacts (visible "bulb" overlapping splats).
              colliderRoot.traverse((child) => {
                child.visible = false;
              });
              scene.add(colliderRoot);
              console.log('[WORLD-RENDER] collider mesh loaded (hidden):', colliderMeshUrl);
            }
          } catch {
            // Non-blocking: mesh is optional.
            console.warn('[WORLD-RENDER] collider mesh failed to load:', colliderMeshUrl);
          }
        }

        setProgress(1);
        setIsLoading(false);
        console.log('[WORLD-RENDER] world render initialization complete');
        logSparkState('post init');
      } catch (err) {
        if (disposed) return;
        const message = err instanceof Error ? err.message : 'Failed to load world assets';
        setError(message);
        setIsLoading(false);
        console.error('[WORLD-RENDER] initialization failed:', err);
      }
    };

    void loadWorld();

    let frameCount = 0;
    let sparkWasDetected = false;
    let sparkConfigured = false;
    renderer.setAnimationLoop(() => {
      frameCount += 1;
      controls.update(camera);
      ensureFiniteCamera();
      renderer.render(scene, camera);
      const spark = findSparkRenderer();
      if (spark && !sparkWasDetected) {
        sparkWasDetected = true;
        console.log('[WORLD-RENDER] SparkRenderer auto-detected in scene');
      }
      if (spark && !sparkConfigured) {
        sparkConfigured = true;
        // Spark is a fullscreen pass mesh; keep it out of frustum culling.
        spark.frustumCulled = false;
        spark.renderOrder = 999;
        // Use production-safe Spark settings to suppress low-alpha/outlier artifacts.
        spark.minAlpha = 0.5 * (1 / 255);
        spark.clipXY = 1.4;
        spark.maxStdDev = Math.sqrt(8);
        spark.maxPixelRadius = 64;
        spark.defaultView.sort360 = false;
        spark.defaultView.sortRadial = false;
        spark.defaultView.sort32 = true;
        spark.defaultView.stochastic = false;
        spark.needsUpdate = true;
        const configPayload = {
          frustumCulled: spark.frustumCulled,
          renderOrder: spark.renderOrder,
          minAlpha: spark.minAlpha,
          clipXY: spark.clipXY,
          maxStdDev: spark.maxStdDev,
          maxPixelRadius: spark.maxPixelRadius,
          sort360: spark.defaultView.sort360,
          sortRadial: spark.defaultView.sortRadial,
          sort32: spark.defaultView.sort32,
          stochastic: spark.defaultView.stochastic,
          position: to3(spark.position),
        };
        console.log(`[WORLD-RENDER] SparkRenderer configured ${JSON.stringify(configPayload)}`);
      }
      if (frameCount === 1 || frameCount === 60 || frameCount % 240 === 0) {
        const heartbeatPayload = {
          frameCount,
          canvasWidth: renderer.domElement.width,
          canvasHeight: renderer.domElement.height,
          webglPrograms: renderer.info.programs?.length ?? 'n/a',
          sceneChildren: scene.children.length,
          sparkDetected: Boolean(spark),
          centerPixel: sampleCenterPixel(),
          cameraFinite:
            Number.isFinite(camera.position.x) &&
            Number.isFinite(camera.position.y) &&
            Number.isFinite(camera.position.z),
          cameraPosition: to3(camera.position),
        };
        console.log(`[WORLD-RENDER] render loop heartbeat ${JSON.stringify(heartbeatPayload)}`);
        if (DEBUG) {
          logSparkState(`heartbeat#${frameCount}`);
        }
      }
    });

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      renderer.setAnimationLoop(null);

      if (colliderRoot) {
        scene.remove(colliderRoot);
        disposeObject3D(colliderRoot);
      }
      if (worldMesh) {
        scene.remove(worldMesh);
        worldMesh.dispose();
      }
      if (panoTexture) {
        panoTexture.dispose();
      }

      renderer.dispose();
      renderer.forceContextLoss();
      mount.removeChild(canvas);
      if (debugWindow.__worldDebug?.renderer === renderer) {
        delete debugWindow.__worldDebug;
      }
    };
  }, [colliderMeshUrl, panoUrl, splatCandidates]);

  return (
    <div className="world-explorer">
      <div ref={mountRef} className="world-explorer__canvas" />

      {isLoading && (
        <div className="world-explorer__overlay">
          <div className="world-explorer__status">Rendering World</div>
          <div className="world-explorer__bar">
            <div className="world-explorer__bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="world-explorer__error">{error}</div>
      )}
    </div>
  );
}
