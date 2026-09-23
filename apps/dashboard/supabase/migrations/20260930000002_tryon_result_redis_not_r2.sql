-- Generated try-on results are no longer persisted to R2 -- they're
-- cached transiently in Redis (Upstash) with a short TTL, keyed
-- deterministically as `tryon:result:{generationId}`, so no DB-stored key
-- is needed to find one. This shrinks the real exposure window for a
-- customer's photo/result from "up to 48h" down to "how long generation
-- actually took" (the source upload is now deleted immediately after
-- generation completes) plus a short, self-expiring cache window for the
-- result. No functional loss: the client already tracks generationId for
-- the lifetime of its polling session, which is all a Redis lookup needs.
ALTER TABLE tryon_generations DROP COLUMN result_r2_key;
