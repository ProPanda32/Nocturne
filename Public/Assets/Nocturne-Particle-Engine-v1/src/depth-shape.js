import { float, hash, mix, select, smoothstep, vec3 } from 'three/tsl';

// All variation is a pure function of the stable particle seed and its XY home.
// The legacy path is mathematically identical to the previous home position.
export function shapeDepth(raw, seed, family, cuts, scale, legacyDepth, d) {
  const x = raw.x.mul(scale);
  const y = raw.y.mul(scale);
  const legacyZ = raw.z.mul(legacyDepth);
  const u = hash(seed.mul(31).add(17));
  const v = u.mul(2).sub(1);
  const gaussian = hash(seed.mul(37).add(3)).add(hash(seed.mul(41).add(7)))
    .add(hash(seed.mul(43).add(11))).add(hash(seed.mul(47).add(13))).sub(2).mul(0.82);
  const selected = select(d.mode.lessThan(0.5), legacyZ.add(20).div(20),
    select(d.mode.lessThan(1.5), v,
      select(d.mode.lessThan(2.5), v.mul(v.abs()),
        select(d.mode.lessThan(3.5), float(1).sub(float(2).mul(float(1).sub(u).pow(2))),
          select(d.mode.lessThan(4.5), u.pow(2).mul(2).sub(1),
            select(d.mode.lessThan(5.5), v.div(v.abs().add(0.0001)).mul(float(0.7).add(v.abs().mul(0.3))), gaussian))))));
  const isLower = family.lessThan(cuts.lowerRight);
  const isUpper = family.greaterThanEqual(cuts.lowerRight).and(family.lessThan(cuts.upperRight));
  const isLeft = family.lessThan(cuts.lowerLeft)
    .or(family.greaterThanEqual(cuts.lowerRight).and(family.lessThan(cuts.upperLeft)));
  const isRight = family.greaterThanEqual(cuts.lowerLeft).and(family.lessThan(cuts.lowerRight))
    .or(family.greaterThanEqual(cuts.upperLeft).and(family.lessThan(cuts.upperRight)));
  const regionDepth = select(isLower, d.lowerDepth, select(isUpper, d.upperDepth, float(1)));
  const regionOffset = select(isLower, d.lowerZ, select(isUpper, d.upperZ, float(0)))
    .add(select(isLeft, d.leftZ, select(isRight, d.rightZ, float(0))));
  // Coherent, spatially varying depth creates broad waves and clustered pockets.
  const frequency = d.noiseScale.mul(0.13);
  const wave = x.mul(frequency).sin()
    .mul(y.mul(frequency.mul(0.73)).add(1.7).cos());
  const variation = hash(seed.mul(53).add(19)).mul(2).sub(1);
  const scatter = variation.mul(d.randomness.sub(0.5)).mul(16)
    .add(wave.mul(d.clumping).mul(12))
    .add(wave.mul(d.noiseScale.sub(1)).mul(1.4));
  const radial = x.div(24).pow(2).add(y.div(15).pow(2));
  const sculpt = x.div(24).mul(d.horizontal).mul(18)
    .add(y.div(15).mul(d.verticalDepth).mul(18))
    .add(float(1).sub(smoothstep(0, 2, radial)).mul(d.centerEdge).mul(16))
    .add(radial.mul(d.curvature).mul(10));
  const z = float(-20).add(selected.mul(20).add(scatter).mul(d.thickness).mul(regionDepth))
    .add(d.center).add(d.bias.mul(d.thickness).mul(12)).add(regionOffset).add(sculpt);
  const pivot = d.center.sub(20);
  const pz = z.sub(pivot);
  const ax = d.rotationX.mul(Math.PI / 180);
  const ay = d.rotationY.mul(Math.PI / 180);
  const az = d.rotationZ.mul(Math.PI / 180);
  const y1 = y.mul(ax.cos()).sub(pz.mul(ax.sin()));
  const z1 = y.mul(ax.sin()).add(pz.mul(ax.cos()));
  const x2 = x.mul(ay.cos()).add(z1.mul(ay.sin()));
  const z2 = z1.mul(ay.cos()).sub(x.mul(ay.sin()));
  return vec3(x2.mul(az.cos()).sub(y1.mul(az.sin())),
    x2.mul(az.sin()).add(y1.mul(az.cos())), z2.add(pivot));
}
