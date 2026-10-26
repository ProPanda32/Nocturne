# Nocturne scene configuration

`scene-config.default.json` is the production art-direction baseline. It contains bottle, sphere, floor ripple, particle composition, particle physics, and particle color/lighting values.

The browser stores the latest compatible configuration under `nocturne.scene-config`. Existing stored values take priority over this production file. Missing fields are filled from the production file, so adding a new control must extend the schema without resetting older saved values.

When the schema changes:

1. Keep existing field names whenever their meaning is unchanged.
2. Increment the schema version only when a migration is required.
3. Add the migration before changing the production default.
4. Never replace a compatible saved value with a new code default.

The **Set as Default** control downloads `nocturne-scene-config.default.json`. Review that exported file, then replace the production baseline with it when the art direction is approved.
