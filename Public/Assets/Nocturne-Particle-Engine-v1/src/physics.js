import { Fn, Loop, If, instanceIndex, vec2, vec3, float, max, min, dot, sqrt, smoothstep, mix, select } from 'three/tsl';

export function createPhysicsSimulation({ origins, positions, appearance, offsets, velocities, lastHit, elapsed, frameDelta, capacity, controls: c, pointer }) {
  const simulate = Fn(() => {
    const origin = origins.element(instanceIndex);
    const phase = appearance.element(instanceIndex).z;
    const offset = offsets.element(instanceIndex).toVar();
    const velocity = velocities.element(instanceIndex).toVar();
    const hit = lastHit.element(instanceIndex).toVar();
    const dt = frameDelta.mul(0.5);
    const cursorSpeed = pointer.velocity.length();
    const normalizedSpeed = cursorSpeed.mul(c.mouseVelocityMultiplier).mul(c.sensitivity).div(20);
    const response = min(normalizedSpeed.pow(c.velocityCurve), 1);
    const force = mix(min(c.baseForce, c.maxForce), c.maxForce, response)
      .mul(smoothstep(0, 0.04, normalizedSpeed)).mul(pointer.active)
      .mul(c.forceMultiplier).mul(c.displacementScale).mul(c.particleVelocityMultiplier);
    const swipe = pointer.end.sub(pointer.start);
    const swipeLengthSquared = max(dot(swipe, swipe), 0.000001);
    const direction = vec3(pointer.velocity.div(max(cursorSpeed, 0.0001)), 0);

    // Two bounded semi-implicit integration steps keep the spring stable even
    // when the frame rate falls. No particle state is read back during animation.
    Loop(2, () => {
      const current = origin.add(offset);
      // Project each depth layer onto the cursor's reference plane (z = -16).
      // This makes the visible radius consistent across the perspective view.
      const depthScale = max(pointer.cameraZ.sub(current.z), 0.5).div(pointer.cameraZ.add(16));
      const projected = vec2(current.x, current.y).div(depthScale);
      const along = dot(projected.sub(pointer.start), swipe).div(swipeLengthSquared).clamp(0, 1);
      const nearest = pointer.start.add(swipe.mul(along));
      const delta = projected.sub(nearest);
      const depthDistance = current.z.add(16).div(c.depth);
      const normalizedDistance = sqrt(dot(delta, delta).div(c.radius.mul(c.radius)).add(depthDistance.mul(depthDistance)));
      const falloff = float(1).sub(smoothstep(0, 1, normalizedDistance)).pow(c.falloff);
      const localForce = force.mul(falloff);
      If(localForce.greaterThan(0.001), () => { hit.assign(elapsed); });
      const radial = vec3(delta.mul(depthScale), current.z.add(16).mul(0.18))
        .add(vec3(phase.sin(), phase.cos(), 0.2).mul(0.0001));
      const push = radial.div(max(radial.length(), 0.0001)).mul(c.radialPush)
        .add(direction.mul(c.directionalPush)).mul(localForce);

      const returnMix = smoothstep(c.returnDelay, c.returnDelay.add(0.6), elapsed.sub(hit));
      const spring = c.returnStrength.mul(returnMix);
      const distance = offset.length();
      const outward = offset.div(max(distance, 0.0001));
      // A soft travel limit brakes and pulls excess displacement back instead
      // of teleporting particles when the limit is reduced in the editor.
      const excess = select(c.maxDisplacement.greaterThan(0), max(distance.sub(c.maxDisplacement), 0), float(0));
      const limitForce = outward.mul(excess).mul(18);
      const p = current.mul(c.turbulenceScale);
      const time = elapsed.mul(c.turbulenceSpeed);
      const turbulence = vec3(
        p.y.add(time).add(phase).sin().mul(p.z.mul(0.7).sub(time.mul(0.6)).cos()),
        p.z.add(time.mul(0.8)).add(phase.mul(1.3)).sin().mul(p.x.mul(0.6).sub(time).cos()),
        p.x.add(time.mul(0.7)).add(phase.mul(0.8)).sin().mul(p.y.mul(0.8).sub(time.mul(0.5)).cos()),
      ).mul(c.turbulenceStrength).mul(smoothstep(0.02, 1, distance));
      velocity.addAssign(push.sub(offset.mul(spring)).sub(limitForce).add(turbulence).mul(dt));
      const drag = c.drag.add(float(1).sub(c.momentum).mul(4))
        .add(sqrt(c.returnStrength).mul(2).mul(c.returnDamping).mul(returnMix))
        .add(smoothstep(0, 1, excess).mul(5));
      velocity.mulAssign(drag.mul(dt).negate().exp());
      velocity.mulAssign(min(float(1), c.maxVelocity.div(max(velocity.length(), 0.0001))));
      offset.addAssign(velocity.mul(dt));
    });
    offsets.element(instanceIndex).assign(offset);
    velocities.element(instanceIndex).assign(velocity);
    lastHit.element(instanceIndex).assign(hit);
    // Gentle phase-offset 3D drift remains visible without cursor input.
    // It is layered over the persistent physics state, so spring return and
    // mouse forces still act on the same home positions.
    const t = elapsed.mul(0.22);
    const drift = vec3(
      t.add(phase).sin().mul(0.22),
      t.mul(0.73).add(phase.mul(1.7)).sin().mul(0.17),
      t.mul(0.51).add(phase.mul(2.3)).sin().mul(0.23),
    );
    positions.element(instanceIndex).assign(origin.add(drift).add(offset));
  })().compute(capacity);
  simulate.name = 'GPU cursor forces, velocity, drag and spring return';
  return simulate;
}
