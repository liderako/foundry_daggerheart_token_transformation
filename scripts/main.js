import { MODULE_ID, applyLook, dropTransformation, getLooks, isDisguised, isTransformation, restoreActor, transformActor } from "./transformation.js";
import { TransformationPicker } from "./transformation-picker.js";

const FLAG = `flags.${MODULE_ID}.transform`;

function hasOtherTransformation(actor, effect) {
	return actor.effects.some(e => e.id !== effect.id && e.active && isTransformation(e));
}

/**
 * Who chooses the look: the user who applied the effect when they own the actor (a character transforming
 * themselves), else an active player who owns it (an ally transformed by the caster), else the one who applied it.
 */
function getChooser(actor, userId) {
	const owns = user => user.active && !user.isGM && actor.testUserPermission(user, "OWNER");
	const applier = game.users.get(userId);
	if (applier && owns(applier)) {
		return applier;
	}
	return game.users.find(user => owns(user) && user.character?.id === actor.id)
		?? game.users.find(owns)
		?? applier
		?? game.users.activeGM;
}

/** One client returns the tokens: the active GM, or without one, the user who ended the effect. */
function isRestorer(userId) {
	const gm = game.users.activeGM;
	return gm ? gm.isSelf : userId === game.user.id;
}

function onEffectStarted(effect, userId) {
	if (getChooser(effect.parent, userId)?.isSelf) {
		TransformationPicker.show(effect.parent, { effect });
	}
}

function onEffectEnded(effect, userId) {
	if (isRestorer(userId) && !hasOtherTransformation(effect.parent, effect)) {
		restoreActor(effect.parent);
	}
}

/** The "Transformation" checkbox on the details tab of an effect sheet, next to "Disabled". */
function addEffectCheckbox(app, html) {
	const details = html.querySelector('section[data-tab="details"]');
	if (!details || details.querySelector(`[name="${FLAG}"]`)) {
		return;
	}
	const group = document.createElement("div");
	group.classList.add("form-group");
	group.innerHTML = `
		<label>${game.i18n.localize("MIST_TRANSFORM.Effect.Name")}</label>
		<div class="form-fields">
			<input type="checkbox" name="${FLAG}" ${app.document.getFlag(MODULE_ID, "transform") ? "checked" : ""} ${app.isEditable ? "" : "disabled"}>
		</div>
		<p class="hint">${game.i18n.localize("MIST_TRANSFORM.Effect.Hint")}</p>`;
	const disabledGroup = details.querySelector('[name="disabled"]')?.closest(".form-group");
	if (disabledGroup) {
		disabledGroup.after(group);
	} else {
		details.append(group);
	}
}

/** A mask button on the left of the token HUD for owners: opens the actor's looks, to add, remove or put one on. */
function addHudButton(hud, html) {
	const token = hud.document;
	if (!token?.isOwner || !token.actor) {
		return;
	}
	const button = document.createElement("button");
	button.type = "button";
	button.classList.add("control-icon", "mist-transform-hud");
	button.classList.toggle("active", isDisguised(token));
	button.dataset.tooltip = game.i18n.localize("MIST_TRANSFORM.Hud.Tooltip");
	button.innerHTML = `<i class="fa-solid fa-masks-theater" inert></i>`;
	button.addEventListener("click", event => {
		event.preventDefault();
		TransformationPicker.show(token.actor);
	});
	html.querySelector(".col.left")?.append(button);
}

Hooks.once("init", () => {
	// For macros: game.modules.get("mist-age-transformations").api.open(actor)
	game.modules.get(MODULE_ID).api = {
		applyLook,
		dropTransformation,
		getLooks,
		isDisguised,
		restoreActor,
		transformActor,
		open: actor => TransformationPicker.show(actor)
	};
});

Hooks.on("createActiveEffect", (effect, options, userId) => {
	if (isTransformation(effect) && effect.active) {
		onEffectStarted(effect, userId);
	}
});
Hooks.on("updateActiveEffect", (effect, changes, options, userId) => {
	if (!isTransformation(effect) || !("disabled" in changes)) {
		return;
	}
	if (effect.active) {
		onEffectStarted(effect, userId);
	} else {
		onEffectEnded(effect, userId);
	}
});
Hooks.on("deleteActiveEffect", (effect, options, userId) => {
	if (isTransformation(effect)) {
		onEffectEnded(effect, userId);
	}
});

Hooks.on("renderActiveEffectConfig", addEffectCheckbox);
Hooks.on("renderTokenHUD", addHudButton);
Hooks.on("updateToken", token => TransformationPicker.refresh(token));
Hooks.on("updateActor", actor => TransformationPicker.refresh(actor));
Hooks.on("targetToken", user => {
	if (user.isSelf) {
		TransformationPicker.refreshAll();
	}
});
