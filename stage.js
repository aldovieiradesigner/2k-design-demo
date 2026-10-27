/* 2K DESIGN — the original mark, lit as a small stage. */
(() => {
  'use strict';

  const source = document.currentScript?.src || document.baseURI;
  let changeScene = null;
  let changeProgress = null;
  let requestedScene = 'palco';
  let requestedProgress = 0;
  const sceneNames = ['palco'];

  window.k2Stage = {
    setScene(name) {
      if (!sceneNames.includes(name)) return;
      requestedScene = name;
      if (changeScene) changeScene(name);
    },
    setProgress(value) {
      if (!Number.isFinite(value)) return;
      requestedProgress = Math.max(0, Math.min(1, value));
      if (changeProgress) changeProgress(requestedProgress);
    }
  };

  async function start() {
    const field = document.getElementById('hero-stage');
    const hero = document.querySelector('.hero') || document.getElementById('inicio') || field;
    if (!field || !window.THREE) return;
    const objectRegion = hero.querySelector('.hero-object') || hero;
    const header = document.querySelector('.site-header');

    let renderer;
    let response;
    try {
      // Curves rebuilt from the supplied mark keep the bevel free of raster steps.
      response = await fetch(new URL('assets/logo-shapes.json', source));
      if (!response.ok) response = await fetch(new URL('assets/logo-contours.json', source));
      if (!response.ok) return;
      response = await response.json();
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: true
      });
    } catch (_) {
      return; // The supplied logo remains visible as the static fallback.
    }

    const T = window.THREE;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    let active = true;
    let inView = hero.getBoundingClientRect().bottom > 0;
    let frame = 0;
    let viewWidth = 0;
    let viewHeight = 0;
    let scrollTarget = 0;
    let scrollCurrent = 0;
    let lastTime = 0;
    let pulse = 0;
    let drag = null;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const impulse = { x: 0, y: 0, vx: 0, vy: 0 };
    const lightLevels = {};
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const smoothstep = (min, max, value) => {
      const x = clamp((value - min) / (max - min), 0, 1);
      return x * x * (3 - 2 * x);
    };

    const canvas = renderer.domElement;
    canvas.className = 'stage-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Símbolo 2K vermelho em três dimensões com iluminação de palco interativa');
    canvas.style.cssText = 'display:block;width:100%;height:100%;position:absolute;inset:0;pointer-events:none;';
    field.appendChild(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fine.matches ? 2 : 1.5));
    renderer.setClearColor(0x080809, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = fine.matches;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    const scene = new T.Scene();
    // A screen-space camera keeps the complete mark inside the visible stage,
    // including its bevel, at every rotation and every point in the scroll.
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
    camera.position.z = 35;
    const piece = new T.Group();
    scene.add(piece);

    const front = new T.MeshPhysicalMaterial({
      color: 0xe7110c,
      metalness: 0.47,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.09,
      envMapIntensity: 0.88,
      transparent: true
    });
    const edges = new T.MeshPhysicalMaterial({
      color: 0xa70b08,
      metalness: 0.66,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.05,
      transparent: true
    });
    const geometryList = [];

    // ExtrudeGeometry duplicates vertices. Smooth only coincident side vertices:
    // the broad red faces retain exact planar normals, with no diagonal dimples.
    function finishNormals(geometry) {
      geometry.computeVertexNormals();
      const positions = geometry.attributes.position;
      const normals = geometry.attributes.normal;
      const original = normals.array.slice();
      const buckets = new Map();
      const sideGroups = geometry.groups.filter(group => group.materialIndex === 1);
      sideGroups.forEach(group => {
        for (let index = group.start; index < group.start + group.count; index++) {
          const key = [positions.getX(index), positions.getY(index), positions.getZ(index)]
            .map(value => Math.round(value * 100000)).join(',');
          const list = buckets.get(key) || [];
          list.push(index);
          buckets.set(key, list);
        }
      });
      const crease = Math.cos(T.MathUtils.degToRad(58));
      buckets.forEach(indices => indices.forEach(index => {
        const at = index * 3;
        const normal = new T.Vector3(original[at], original[at + 1], original[at + 2]);
        const sum = new T.Vector3();
        indices.forEach(otherIndex => {
          const otherAt = otherIndex * 3;
          const other = new T.Vector3(original[otherAt], original[otherAt + 1], original[otherAt + 2]);
          if (normal.dot(other) > crease) sum.add(other);
        });
        sum.normalize();
        normals.setXYZ(index, sum.x, sum.y, sum.z);
      }));
      normals.needsUpdate = true;
    }

    const shapes = Array.isArray(response) ? response.map(points =>
      new T.Shape(points.map(p => new T.Vector2(p[0], p[1])))
    ) : response.shapes.map(data => {
      const shape = new T.Shape();
      shape.moveTo(data.start[0], data.start[1]);
      data.commands.forEach(command => {
        if (command[0] === 'L') shape.lineTo(command[1], command[2]);
        else if (command[0] === 'Q') shape.quadraticCurveTo(...command.slice(1));
        else if (command[0] === 'C') shape.bezierCurveTo(...command.slice(1));
      });
      shape.closePath();
      return shape;
    });
    shapes.forEach(shape => {
      const geometry = new T.ExtrudeGeometry(shape, {
        depth: 0.52,
        bevelEnabled: true,
        bevelThickness: 0.07,
        bevelSize: 0.035,
        bevelSegments: 8,
        curveSegments: 24,
        steps: 1
      });
      geometry.translate(0, 0, -0.26);
      finishNormals(geometry);
      geometryList.push(geometry);
      const mesh = new T.Mesh(geometry, [front, edges]);
      mesh.castShadow = true;
      piece.add(mesh);
    });
    const localBounds = new T.Box3();
    geometryList.forEach(geometry => {
      geometry.computeBoundingBox();
      localBounds.union(geometry.boundingBox);
    });
    const localCorners = [];
    for (const x of [localBounds.min.x, localBounds.max.x]) {
      for (const y of [localBounds.min.y, localBounds.max.y]) {
        for (const z of [localBounds.min.z, localBounds.max.z]) {
          localCorners.push(new T.Vector3(x, y, z));
        }
      }
    }
    const worldBounds = new T.Box3();
    const boundsCorner = new T.Vector3();
    piece.position.y = 0.13;
    piece.rotation.set(0.05, -0.15, -0.018);

    // A short, fading reflection anchors the object without becoming a second logo.
    const floorY = -1.62;
    const reflected = new T.Group();
    reflected.scale.y = -1;
    reflected.position.y = floorY * 2 - piece.position.y;
    const reflectionMaterial = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      uniforms: {
        tint: { value: new T.Color(0xe51b12) },
        opacity: { value: 0.07 },
        floorHeight: { value: floorY }
      },
      vertexShader: 'varying float vFade; uniform float floorHeight; void main(){ vec4 world = modelMatrix * vec4(position, 1.0); vFade = pow(clamp(1.0 - (floorHeight - world.y) / 1.7, 0.0, 1.0), 2.0); gl_Position = projectionMatrix * viewMatrix * world; }',
      fragmentShader: 'varying float vFade; uniform vec3 tint; uniform float opacity; void main(){ gl_FragColor = vec4(tint, opacity * vFade); }'
    });
    geometryList.forEach(geometry => reflected.add(new T.Mesh(geometry, reflectionMaterial)));
    reflected.renderOrder = 2;
    scene.add(reflected);

    const floorMaterial = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      uniforms: { opacity: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 vUv; uniform float opacity; void main(){float d=length((vUv-.5)*2.0); float a=(1.0-smoothstep(.12,1.0,d))*.32*opacity; gl_FragColor=vec4(.023,.016,.017,a);}'
    });
    const floorGeometry = new T.PlaneGeometry(20, 12);
    const floor = new T.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, floorY, 0);
    scene.add(floor);

    const ambient = new T.HemisphereLight(0xffe9df, 0x270205, 0.52);
    scene.add(ambient);
    const key = new T.SpotLight(0xffdfd1, 63, 35, 0.48, 1, 2);
    key.position.set(-2, 5.8, 6.5);
    key.target.position.set(0, 0, 0);
    key.castShadow = fine.matches;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.02;
    scene.add(key, key.target);
    const red = new T.PointLight(0xff1808, 14, 22, 2);
    red.position.set(-4.3, 1.3, 2.5);
    scene.add(red);
    const rim = new T.DirectionalLight(0xff7258, 2.1);
    rim.position.set(3.5, 2.5, -3.5);
    scene.add(rim);
    const fill = new T.DirectionalLight(0xffe6d9, 0.45);
    fill.position.set(2, 3, 5);
    scene.add(fill);

    // A miniature softbox environment gives the rounded lacquer real highlights.
    const environmentCanvas = document.createElement('canvas');
    environmentCanvas.width = 1024;
    environmentCanvas.height = 512;
    const envContext = environmentCanvas.getContext('2d');
    envContext.fillStyle = '#090405';
    envContext.fillRect(0, 0, 1024, 512);
    const softbox = (x, y, width, height, color, blur) => {
      envContext.save();
      envContext.shadowColor = color;
      envContext.shadowBlur = blur;
      envContext.fillStyle = color;
      envContext.fillRect(x, y, width, height);
      envContext.restore();
    };
    softbox(90, 80, 105, 290, '#e5d9d3', 35);
    softbox(240, 55, 25, 340, '#fff4e9', 15);
    softbox(490, 25, 215, 90, '#a69d97', 35);
    softbox(660, 105, 90, 265, '#fe3321', 45);
    softbox(890, 90, 30, 255, '#d2d8df', 20);
    const environmentTexture = new T.CanvasTexture(environmentCanvas);
    environmentTexture.mapping = T.EquirectangularReflectionMapping;
    const pmrem = new T.PMREMGenerator(renderer);
    const environmentTarget = pmrem.fromEquirectangular(environmentTexture);
    scene.environment = environmentTarget.texture;
    environmentTexture.dispose();
    pmrem.dispose();

    // Stage beams sit behind the symbol and fade softly across their width.
    const beamCanvas = document.createElement('canvas');
    beamCanvas.width = 128;
    beamCanvas.height = 256;
    const beamContext = beamCanvas.getContext('2d');
    const pixels = beamContext.createImageData(128, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 128; x++) {
        const offset = (y * 128 + x) * 4;
        const widthFade = Math.pow(Math.max(0, 1 - Math.abs(x - 63.5) / 63.5), 1.9);
        const lengthFade = Math.pow(y / 255, 0.85);
        pixels.data[offset] = 255;
        pixels.data[offset + 1] = 255;
        pixels.data[offset + 2] = 255;
        pixels.data[offset + 3] = Math.round(widthFade * lengthFade * 170);
      }
    }
    beamContext.putImageData(pixels, 0, 0);
    const beamTexture = new T.CanvasTexture(beamCanvas);
    const beams = [-1, 1].map(sign => {
      const beamGeometry = new T.BufferGeometry();
      beamGeometry.setAttribute('position', new T.BufferAttribute(new Float32Array([
        sign * 4.5, 4.5, -2.6,
        sign * 0.1, -2.1, -2.4,
        sign * 3.7, -2.1, -2.4
      ]), 3));
      beamGeometry.setAttribute('uv', new T.BufferAttribute(new Float32Array([0.5, 1, 0, 0, 1, 0]), 2));
      const material = new T.MeshBasicMaterial({
        color: 0xff3924,
        map: beamTexture,
        transparent: true,
        opacity: 0.12,
        side: T.DoubleSide,
        depthWrite: false,
        blending: T.AdditiveBlending
      });
      const beam = new T.Mesh(beamGeometry, material);
      scene.add(beam);
      return beam;
    });

    function canDraw() {
      return active && inView && !document.hidden && viewWidth > 0 && viewHeight > 0;
    }
    function request() {
      if (!frame && canDraw()) frame = requestAnimationFrame(draw);
    }
    function fitVisibleStage(progress) {
      const fieldRect = field.getBoundingClientRect();
      const objectRect = objectRegion.getBoundingClientRect();
      const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const pad = viewWidth <= 760 ? 18 : 28;

      // The hero starts to leave before the scroll sequence ends. Intersect
      // its canvas with the actual viewport so its moving lower edge can never
      // crop the logo, and reserve space below the fixed navigation.
      const safe = {
        left: Math.max(pad, pad - fieldRect.left),
        right: Math.min(viewWidth - pad, viewportWidth - fieldRect.left - pad),
        top: Math.max(pad, headerBottom + 14 - fieldRect.top),
        bottom: Math.min(viewHeight - 24, viewportHeight - fieldRect.top - 24)
      };
      const safeWidth = safe.right - safe.left;
      const safeHeight = safe.bottom - safe.top;
      if (safeWidth <= 1 || safeHeight <= 1) return 0;

      const initial = {
        left: clamp(objectRect.left - fieldRect.left, safe.left, safe.right),
        right: clamp(objectRect.right - fieldRect.left, safe.left, safe.right),
        top: clamp(objectRect.top - fieldRect.top + 32, safe.top, safe.bottom),
        bottom: clamp(objectRect.bottom - fieldRect.top - 28, safe.top, safe.bottom)
      };
      // When its original column leaves the screen, use the available stage.
      if (initial.right - initial.left < 30 || initial.bottom - initial.top < 30) {
        Object.assign(initial, safe);
      }
      const transition = reduced.matches ? 0 : smoothstep(0.04, 0.5, progress);
      const lerp = (from, to) => from + (to - from) * transition;
      const frame = {
        left: lerp(initial.left, safe.left),
        right: lerp(initial.right, safe.right),
        top: lerp(initial.top, safe.top),
        bottom: lerp(initial.bottom, safe.bottom)
      };
      // Leave a real perimeter around the outermost bevel; pointer/drag
      // movement changes the measured box rather than consuming that margin.
      const frameWidth = (frame.right - frame.left) * 0.92;
      const frameHeight = (frame.bottom - frame.top) * 0.9;
      const pointerDrift = reduced.matches ? 0 : 1 - transition * 0.6;
      const centerX = (frame.left + frame.right) * 0.5 + current.x * frameWidth * 0.018 * pointerDrift;
      const centerY = (frame.top + frame.bottom) * 0.5 - current.y * frameHeight * 0.02 * pointerDrift;

      piece.updateMatrixWorld(true);
      worldBounds.makeEmpty();
      localCorners.forEach(corner => {
        worldBounds.expandByPoint(boundsCorner.copy(corner).applyMatrix4(piece.matrixWorld));
      });
      const pixelsPerUnit = Math.min(
        frameWidth / Math.max(0.001, worldBounds.max.x - worldBounds.min.x),
        frameHeight / Math.max(0.001, worldBounds.max.y - worldBounds.min.y)
      );
      camera.left = -viewWidth / (2 * pixelsPerUnit);
      camera.right = -camera.left;
      camera.top = viewHeight / (2 * pixelsPerUnit);
      camera.bottom = -camera.top;
      camera.position.x = (worldBounds.min.x + worldBounds.max.x) * 0.5 - (centerX - viewWidth * 0.5) / pixelsPerUnit;
      camera.position.y = (worldBounds.min.y + worldBounds.max.y) * 0.5 - (viewHeight * 0.5 - centerY) / pixelsPerUnit;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      // Fade while there is still space for the complete symbol. Never let
      // the last few visible pixels become a cropped remnant under the header.
      return smoothstep(70, 150, safeHeight);
    }
    function draw(timestamp) {
      frame = 0;
      if (!canDraw()) return;
      const dt = lastTime ? clamp((timestamp - lastTime) / 1000, 0.008, 0.04) : 1 / 60;
      lastTime = timestamp;
      const step = dt * 60;
      const smoothing = reduced.matches ? 1 : 1 - Math.exp(-10 * dt);
      current.x += (target.x - current.x) * smoothing;
      current.y += (target.y - current.y) * smoothing;
      scrollCurrent += (scrollTarget - scrollCurrent) * (reduced.matches ? 1 : 1 - Math.exp(-13 * dt));
      const motion = reduced.matches ? 0 : 1;
      const exit = smoothstep(0, 1, scrollCurrent) * motion;
      let fade = 1 - smoothstep(0.7, 0.92, scrollCurrent) * motion;
      const pointerWeight = (1 - exit * 0.72) * motion;
      pulse *= Math.pow(0.92, step);
      if (pulse < 0.001 || reduced.matches) pulse = 0;
      if (!drag) {
        impulse.vx += -impulse.x * 0.065 * step;
        impulse.vy += -impulse.y * 0.065 * step;
        impulse.vx *= Math.pow(0.8, step);
        impulse.vy *= Math.pow(0.8, step);
        impulse.x += impulse.vx * step;
        impulse.y += impulse.vy * step;
      }
      piece.rotation.y = -0.15 + (current.x * 0.55 + impulse.y) * pointerWeight + exit * 1.3;
      piece.rotation.x = 0.05 - (current.y * 0.32 - impulse.x) * pointerWeight - exit * 0.22;
      piece.rotation.z = -0.018 + current.x * 0.055 * pointerWeight + exit * 0.08;
      piece.position.set(current.x * 0.29 * pointerWeight - exit * 0.12,
        0.13 + current.y * 0.19 * pointerWeight + exit * 0.48, exit * 1.25);
      piece.scale.setScalar(1 + exit * 0.9 + pulse * 0.014 * motion);
      fade *= fitVisibleStage(scrollCurrent);
      front.opacity = fade;
      edges.opacity = fade;
      piece.visible = fade > 0.001;
      reflected.rotation.set(-piece.rotation.x, piece.rotation.y, -piece.rotation.z);
      reflected.position.set(piece.position.x, floorY * 2 - piece.position.y, piece.position.z);
      reflected.scale.set(piece.scale.x, -piece.scale.y, piece.scale.z);
      reflectionMaterial.uniforms.opacity.value = lightLevels.reflection * (1 - smoothstep(0, 0.5, exit)) * fade;
      floorMaterial.uniforms.opacity.value = (1 - exit) * fade;
      key.position.set(-2 + current.x * 3.8 * pointerWeight, 5.8 + current.y * 2.6 * pointerWeight + exit * 3, 6.5 - exit * 0.6);
      key.target.position.set(current.x * 1.1 * pointerWeight, current.y * 0.6 * pointerWeight + exit * 0.8, exit * 0.5);
      key.angle = 0.48 + exit * 0.18;
      key.intensity = lightLevels.key * (1 + pulse * 0.65 + exit * 0.32);
      red.position.set(-4.3 + current.x * 2.8 * pointerWeight, 1.3 + current.y * 1.2 * pointerWeight, 2.5);
      red.intensity = lightLevels.red * (1 + pulse * 0.35);
      rim.position.set(3.5 - current.x * 2 * pointerWeight, 2.5 + current.y * 1.5 * pointerWeight, -3.5);
      rim.intensity = lightLevels.rim * (1 + pulse * 0.7 + exit * 0.5);
      fill.position.set(2 + current.x * 1.6 * pointerWeight, 3 - current.y * pointerWeight, 5);
      beams.forEach((beam, index) => {
        const sign = index ? -1 : 1;
        beam.rotation.z = sign * (current.x * 0.085 * pointerWeight + exit * 0.24);
        beam.position.y = exit * 1.3;
        beam.material.opacity = lightLevels.beam * (1 + pulse * 0.65) * fade;
      });
      renderer.render(scene, camera);
      field.dataset.ready = 'true';
      const distance = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) + Math.abs(scrollTarget - scrollCurrent)
        + Math.abs(impulse.x) + Math.abs(impulse.y) + Math.abs(impulse.vx) + Math.abs(impulse.vy) + pulse;
      if (distance > 0.001) request();
      else lastTime = 0;
    }
    function resize() {
      const width = Math.round(field.clientWidth);
      const height = Math.round(field.clientHeight);
      if (!width || !height) return;
      if (width === viewWidth && height === viewHeight) {
        request(); // The viewport/header may change while the hero stays at its min-height.
        return;
      }
      viewWidth = width;
      viewHeight = height;
      renderer.setSize(width, height, false);
      request();
    }
    function input(event) {
      if ((!fine.matches && !drag) || reduced.matches || !inView) return;
      const bounds = objectRegion.getBoundingClientRect();
      target.x = clamp((event.clientX - bounds.left - bounds.width * 0.5) / (bounds.width * 0.43), -1, 1);
      target.y = clamp((bounds.top + bounds.height * 0.5 - event.clientY) / (bounds.height * 0.4), -1, 1);
      if (drag && drag.id === event.pointerId) {
        const dx = clamp(event.clientX - drag.x, -35, 35);
        const dy = clamp(event.clientY - drag.y, -35, 35);
        impulse.y = clamp(impulse.y + dx * 0.005, -0.46, 0.46);
        impulse.x = clamp(impulse.x + dy * 0.004, -0.32, 0.32);
        impulse.vy = dx * 0.0009;
        impulse.vx = dy * 0.0008;
        drag.x = event.clientX;
        drag.y = event.clientY;
      }
      request();
    }
    function pointerDown(event) {
      if (reduced.matches || !inView || (event.button !== undefined && event.button !== 0)) return;
      if (event.target.closest('a, button, input, textarea, select')) return;
      const bounds = objectRegion.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      if (x < 0.08 || x > 0.92 || y < 0.16 || y > 0.8) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      pulse = 1;
      impulse.vx += 0.018;
      impulse.vy += (x - 0.5) * 0.045;
      field.dataset.dragging = 'true';
      input(event);
      request();
    }
    function pointerUp(event) {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      field.dataset.dragging = 'false';
      if (!fine.matches) resetPointer();
      request();
    }
    function resetPointer() {
      target.x = 0;
      target.y = 0;
      drag = null;
      field.dataset.dragging = 'false';
      request();
    }
    function onPreference() {
      resetPointer();
      pulse = 0;
      impulse.x = impulse.y = impulse.vx = impulse.vy = 0;
      scrollTarget = reduced.matches ? 0 : requestedProgress;
      request();
    }
    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
      } else request();
    }

    changeScene = name => {
      if (name !== 'palco') return;
      field.dataset.scene = 'palco';
      ambient.intensity = 0.52;
      lightLevels.key = 67;
      lightLevels.red = 16;
      lightLevels.rim = 2.3;
      lightLevels.reflection = 0.075;
      lightLevels.beam = 0.11;
      rim.color.set(0xff7258);
      fill.intensity = 0.45;
      front.roughness = 0.2;
      front.envMapIntensity = 0.88;
      request();
    };
    changeProgress = value => {
      scrollTarget = reduced.matches ? 0 : value;
      request();
    };
    changeScene(requestedScene);
    changeProgress(requestedProgress);

    hero.addEventListener('pointermove', input, { passive: true });
    hero.addEventListener('pointerleave', resetPointer, { passive: true });
    hero.addEventListener('pointerdown', pointerDown, { passive: true });
    window.addEventListener('pointerup', pointerUp, { passive: true });
    window.addEventListener('pointercancel', pointerUp, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onPreference);
    fine.addEventListener('change', onPreference);
    const observer = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) {
        request();
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        resetPointer();
      }
    }, { rootMargin: '50px 0px', threshold: 0 });
    observer.observe(hero);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(field);

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      field.dataset.ready = 'false';
      active = false;
      cancelAnimationFrame(frame);
      frame = 0;
      canvas.style.visibility = 'hidden';
    });
    canvas.addEventListener('webglcontextrestored', () => {
      active = true;
      canvas.style.visibility = 'visible';
      request();
    });
    window.addEventListener('pagehide', event => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (event.persisted) return;
      active = false;
      observer.disconnect();
      resizeObserver.disconnect();
      hero.removeEventListener('pointermove', input);
      hero.removeEventListener('pointerleave', resetPointer);
      hero.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onPreference);
      fine.removeEventListener('change', onPreference);
      changeScene = null;
      changeProgress = null;
      geometryList.forEach(geometry => geometry.dispose());
      beams.forEach(beam => { beam.geometry.dispose(); beam.material.dispose(); });
      beamTexture.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      reflectionMaterial.dispose();
      front.dispose();
      edges.dispose();
      environmentTarget.dispose();
      renderer.dispose();
    });
    window.addEventListener('pageshow', request);
    resize();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
