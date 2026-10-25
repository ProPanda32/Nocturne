import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

// Only one cursor is tracked on the CPU. Every particle force is evaluated on GPU.
export function createPointerInput(canvas, camera, settings) {
  const start = uniform(new THREE.Vector2());
  const end = uniform(new THREE.Vector2());
  const velocity = uniform(new THREE.Vector2());
  const active = uniform(0);
  const cameraZ = uniform(camera.position.z);
  const point = new THREE.Vector2();
  const previous = new THREE.Vector2();
  const rawVelocity = new THREE.Vector2();
  const smoothVelocity = new THREE.Vector2();
  let inside = false;
  let initialized = false;
  let lastEvent = 0;
  let lastMotion = 0;
  let screenX = 0;
  let screenY = 0;
  let suspended = false;
  const circle = document.createElement('div');
  circle.className = 'interaction-radius';
  circle.hidden = true;
  circle.setAttribute('aria-hidden', 'true');
  document.body.appendChild(circle);
  const project = (event) => {
    const rect = canvas.getBoundingClientRect();
    const halfHeight = (camera.position.z + 16) * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    point.set(((event.clientX - rect.left) / rect.width * 2 - 1) * halfHeight * camera.aspect,
      (1 - (event.clientY - rect.top) / rect.height * 2) * halfHeight);
    screenX = event.clientX; screenY = event.clientY;
  };
  const clear = () => {
    inside = false; initialized = false;
    rawVelocity.set(0, 0); smoothVelocity.set(0, 0);
    velocity.value.set(0, 0); active.value = 0; circle.hidden = true;
  };
  canvas.addEventListener('pointerenter', (event) => {
    project(event); previous.copy(point); end.value.copy(point); start.value.copy(point);
    inside = true; initialized = true; lastEvent = performance.now();
  });
  canvas.addEventListener('pointermove', (event) => {
    const now = performance.now();
    previous.copy(point); project(event);
    if (initialized) {
      const seconds = Math.max((now - lastEvent) / 1000, 0.001);
      rawVelocity.copy(point).sub(previous).divideScalar(seconds);
      if (rawVelocity.lengthSq() > 0.000001) lastMotion = now;
    } else {
      end.value.copy(point); start.value.copy(point);
    }
    initialized = true; inside = true; lastEvent = now;
  });
  canvas.addEventListener('pointerleave', clear);
  canvas.addEventListener('pointercancel', clear);
  window.addEventListener('blur', clear);
  window.addEventListener('resize', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  return {
    uniforms: { start, end, velocity, active, cameraZ },
    setSuspended(value) { suspended = value; clear(); },
    update(dt, now) {
      if (suspended) { active.value = 0; circle.hidden = true; return 0; }
      if (now - lastMotion > 45) rawVelocity.multiplyScalar(Math.exp(-dt * 40));
      const alpha = settings.smoothing <= 0 ? 1 : 1 - Math.exp(-dt / settings.smoothing);
      smoothVelocity.lerp(rawVelocity, alpha);
      start.value.copy(end.value);
      end.value.copy(point);
      velocity.value.copy(smoothVelocity);
      active.value = inside && !settings.frozen && now - lastMotion < 250 ? 1 : 0;
      circle.hidden = !settings.showRadius || !inside || settings.frozen;
      if (!circle.hidden) {
        const diameter = settings.radius / ((camera.position.z + 16) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * canvas.clientHeight;
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${screenX}px`; circle.style.top = `${screenY}px`;
      }
      return smoothVelocity.length();
    },
  };
}
