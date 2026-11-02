export const MODULE_ID = "mist-age-transformations";

// Token fields a transformation replaces. A look stores the same keys; a null value leaves that field as it is.
const FIELDS = {
	img: "texture.src",
	ringImg: "ring.subject.texture",
	name: "name",
	width: "width",
	height: "height",
	scaleX: "texture.scaleX",
	scaleY: "texture.scaleY"
};

/**
 * An effect marked "Transformation" in its sheet. Marked on a domain card's effect, it stays marked on the copy
 * that the card's action puts on the actor, since the system copies effects with their flags.
 */
export function isTransformation(effect) {
	return effect.parent instanceof Actor && !!effect.getFlag(MODULE_ID, "transform");
}

/** The looks saved on an actor: [{id, label, img, ringImg, name, width, height, scaleX, scaleY}]. */
export function getLooks(actor) {
	return actor?.getFlag(MODULE_ID, "looks") ?? [];
}

export async function saveLooks(actor, looks) {
	await actor.setFlag(MODULE_ID, "looks", looks);
}

/** How the token looked before its first transformation, or null while it shows its own look. */
export function getOriginal(token) {
	return token.getFlag(MODULE_ID, "original") ?? null;
}

export function isDisguised(token) {
	return !!getOriginal(token);
}

/** The id of the saved look the token wears now, if it wears one. */
export function getCurrentLookId(token) {
	return token.getFlag(MODULE_ID, "current") ?? null;
}

/** The current look of a token, in the shape of a saved look. */
export function captureLook(token) {
	const look = {};
	for (const [key, path] of Object.entries(FIELDS)) {
		look[key] = foundry.utils.getProperty(token._source, path) ?? null;
	}
	return look;
}

/** A look made only of an image: the token keeps its name and size. */
export function imageLook(img) {
	return { id: foundry.utils.randomID(), label: imageLabel(img), img, ringImg: null, name: null, width: null, height: null, scaleX: null, scaleY: null };
}

/** A look copied from another token: its image, ring image, name, size and scale. */
export function tokenLook(token, { withName = true } = {}) {
	const look = { ...captureLook(token), id: foundry.utils.randomID(), label: token.name };
	if (!withName) {
		look.name = null;
	}
	return look;
}

function imageLabel(img) {
	const file = decodeURIComponent(img.split("/").pop() ?? img);
	return file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || img;
}

function lookUpdate(look) {
	const update = {};
	for (const [key, path] of Object.entries(FIELDS)) {
		if (look[key] !== null && look[key] !== undefined) {
			update[path] = look[key];
		}
	}
	// A ring keeps showing its own subject image over texture.src, so an image-only look clears it.
	if (look.img && !look.ringImg) {
		update[FIELDS.ringImg] = null;
	}
	return update;
}

/** Puts a look on the token. Its own look is kept once, on the first transformation, so the next ones swap freely. */
export async function applyLook(token, look) {
	const update = lookUpdate(look);
	update[`flags.${MODULE_ID}.current`] = look.id ?? null;
	if (!isDisguised(token)) {
		update[`flags.${MODULE_ID}.original`] = captureLook(token);
	}
	await token.update(update, { animate: false });
}

/** Returns the token to the look it had before its first transformation. */
export async function dropTransformation(token) {
	const original = getOriginal(token);
	if (!original) {
		return;
	}
	const update = lookUpdate(original);
	// The original keeps its own ring image, even an empty one.
	update[FIELDS.ringImg] = original.ringImg;
	update[`flags.${MODULE_ID}.original`] = null;
	update[`flags.${MODULE_ID}.current`] = null;
	await token.update(update, { animate: false });
}

/** The actor's tokens on the viewed scene. The sheet of an unlinked token belongs to that token alone. */
export function getSceneTokens(actor) {
	return actor?.getActiveTokens(false, true) ?? [];
}

/** Puts a look on every token of the actor on the viewed scene. Returns false when it has none there. */
export async function transformActor(actor, look) {
	const tokens = getSceneTokens(actor);
	for (const token of tokens) {
		await applyLook(token, look);
	}
	return tokens.length > 0;
}

/** Returns every transformed token of the actor to its own look, on every scene. */
export async function restoreActor(actor) {
	// Foundry collections have no flatMap, so the scenes are taken as an array.
	const tokens = actor.isToken ? [actor.token] : game.scenes.contents.flatMap(scene => scene.tokens.filter(t => t.actorLink && t.actorId === actor.id));
	for (const token of tokens.filter(t => t && isDisguised(t))) {
		await dropTransformation(token);
	}
}
