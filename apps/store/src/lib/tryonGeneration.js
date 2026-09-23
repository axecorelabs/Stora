// Calls OpenRouter's Unified Image API (https://openrouter.ai/api/v1/images)
// to composite a product onto a customer's uploaded photo. Follows the
// same fetch/env-var conventions as extractSearchIntent/embedText in
// openrouter.js, but a distinct endpoint (Unified Image API, not chat
// completions) and a much longer timeout -- image generation/editing
// plausibly takes 10-40s+, an order of magnitude slower than the
// text-extraction calls that module makes.
//
// Model chosen empirically (Phase 0 validation against real Stora product
// photos): gemini-2.5-flash-image ("Nano Banana") was 2-4x faster than
// bytedance-seed/seedream-4.5 with comparable composite quality in every
// test run. Env-configurable so a candidate swap is a config change, not
// a code change.
const OPENROUTER_IMAGE_API_URL = 'https://openrouter.ai/api/v1/images';
const TRYON_MODEL = process.env.OPENROUTER_TRYON_MODEL || 'google/gemini-2.5-flash-image';
const REQUEST_TIMEOUT_MS = 60_000;

// Three distinct cases, not one prompt with a guess baked in:
//
// 1. Accessory (single photo, no front/back concept) -- unchanged shape.
// 2. Garment with ONLY a front reference -- single-view result, but the
//    reference is now correctly told to the model as "this is the FRONT"
//    instead of the old approach of handing it whatever photo existed
//    (often a back-view collage) and asking it to "adapt" -- that guess is
//    exactly what put back-only print details on a front-facing result.
// 3. Garment with BOTH front and back tagged -- a single two-panel image,
//    front and back shown side by side, each panel driven by its own
//    correctly-labeled reference. Confirmed empirically (a throwaway
//    OpenRouter test against a real product back-view photo) that the
//    model both keeps the front/back print details correctly separated
//    AND plausibly infers the person's own back view from a front-facing
//    source photo -- hair, skin tone, and worn accessories all carried
//    through consistently between panels.
function buildPrompt({ productName, productCategory, hasBack }) {
  if (productCategory === 'Accessories') {
    return `Edit the first image (a photo of a person) so the person is wearing the exact accessory shown in the second image (${productName}). Position it naturally and correctly on the relevant body part (wrist for a watch/bracelet, face for glasses, neck for a necklace, etc.), matching the item's real color, shape, size, and material as closely as possible. Keep the person's face, expression, body, pose, skin tone, and background exactly the same as the first image -- only add the accessory. Photorealistic, correct scale and perspective for this specific photo.`;
  }

  if (hasBack) {
    return `The first image is a photo of a person (front-facing). The second image shows the FRONT of a garment (${productName}). The third image shows the BACK of the SAME garment. Generate a single image with two side-by-side panels of this person wearing this garment: a LEFT panel labeled "Front" showing them facing the camera with every design element from the front reference (color, fit, prints, logos, text) reproduced exactly, and a RIGHT panel labeled "Back" showing them from behind with every design element from the back reference reproduced exactly, in the correct positions. Keep the person's build, skin tone, hair, and a consistent plain background across both panels -- infer a natural, consistent back-of-head/body view for the right panel since only a front photo of them was provided. Photorealistic, natural fabric folds and lighting.`;
  }

  return `Edit the first image (a photo of a person) so the person is wearing the exact garment shown in the second image (${productName}), which shows the FRONT of the garment. Include every visible design element from the front reference (color, fit, prints, logos, text) exactly as shown. Keep the person's face, expression, body, pose, skin tone, and background exactly the same as the first image -- only change what they are wearing. Photorealistic, natural fabric folds and lighting consistent with the original photo.`;
}

// `personImageUrl`/`frontImageUrl`/`backImageUrl` must each be either a
// data: URI or an HTTP(S) URL OpenRouter can fetch -- both forms are
// accepted by input_references per OpenRouter's own docs. `backImageUrl`
// is optional -- omit it for accessories or a garment with no back tagged.
export async function generateTryOnImage({ personImageUrl, frontImageUrl, backImageUrl, productName, productCategory }) {
  if (!process.env.OPENROUTER_API_KEY) {
    return { success: false, error: 'AI try-on is not configured' };
  }

  const hasBack = productCategory !== 'Accessories' && Boolean(backImageUrl);
  const references = [
    { type: 'image_url', image_url: { url: personImageUrl } },
    { type: 'image_url', image_url: { url: frontImageUrl } }
  ];
  if (hasBack) {
    references.push({ type: 'image_url', image_url: { url: backImageUrl } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(OPENROUTER_IMAGE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: TRYON_MODEL,
        prompt: buildPrompt({ productName, productCategory, hasBack }),
        input_references: references
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('OpenRouter image generation failed:', res.status, body.slice(0, 500));
      return { success: false, error: `Generation request failed (${res.status})` };
    }

    const json = await res.json();
    const item = json?.data?.[0];
    if (!item?.b64_json) {
      console.error('OpenRouter image response missing b64_json:', JSON.stringify(json).slice(0, 500));
      return { success: false, error: 'Generation returned no image' };
    }

    return {
      success: true,
      model: TRYON_MODEL,
      buffer: Buffer.from(item.b64_json, 'base64'),
      contentType: item.media_type || 'image/png'
    };
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    console.error('Error calling OpenRouter image API:', timedOut ? 'timed out' : error.message);
    return { success: false, error: timedOut ? 'Generation timed out' : 'Generation failed' };
  } finally {
    clearTimeout(timeout);
  }
}
