import { MODULE_ID, getCurrentLookId, getLooks, getSceneTokens, imageLook, isDisguised, isTransformation, restoreActor, saveLooks, tokenLook, transformActor } from "./transformation.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A window of the looks saved on an actor. A transformation effect opens it for the actor's owner; a click on a look
 * puts it on the actor's tokens on the viewed scene. The token HUD opens it too, to add and remove looks.
 */
export class TransformationPicker extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		classes: ["mist-transform-picker"],
		window: { title: "MIST_TRANSFORM.Picker.Title", icon: "fa-solid fa-masks-theater", resizable: true },
		position: { width: 420, height: "auto" },
		actions: {
			apply: TransformationPicker.#onApply,
			drop: TransformationPicker.#onDrop,
			remove: TransformationPicker.#onRemove,
			addImage: TransformationPicker.#onAddImage,
			copyTarget: TransformationPicker.#onCopyTarget,
			saveCurrent: TransformationPicker.#onSaveCurrent
		}
	};

	static PARTS = {
		body: { template: `modules/${MODULE_ID}/templates/picker.hbs` }
	};

	/** The open picker of each actor, so a second request brings it forward instead of opening another. */
	static #open = new Map();

	/** Opens the looks of an actor. With an effect, the window closes once a look is put on. */
	static show(actor, { effect = null } = {}) {
		const picker = TransformationPicker.#open.get(actor.uuid) ?? new TransformationPicker({ actor });
		picker.effect = effect ?? picker.effect;
		picker.render({ force: true });
		return picker;
	}

	/** Redraws the open pickers that show this actor or one of its tokens. */
	static refresh(document) {
		const actor = document instanceof Actor ? document : document.actor;
		TransformationPicker.#open.get(actor?.uuid)?.render();
	}

	static refreshAll() {
		for (const picker of TransformationPicker.#open.values()) {
			picker.render();
		}
	}

	constructor({ actor, ...options }) {
		super({ id: `${MODULE_ID}-${actor.uuid.replaceAll(".", "-")}`, ...options });
		this.actor = actor;
		this.effect = null;
		TransformationPicker.#open.set(actor.uuid, this);
	}

	get title() {
		return `${game.i18n.localize(this.options.window.title)}: ${this.actor.name}`;
	}

	/** The first token of the actor on the viewed scene: the one a look is saved from. */
	get token() {
		return getSceneTokens(this.actor)[0] ?? null;
	}

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const token = this.token;
		const currentId = token ? getCurrentLookId(token) : null;
		const target = game.user.targets.first();
		context.effect = this.effect?.name ?? null;
		context.hasToken = !!token;
		context.disguised = getSceneTokens(this.actor).some(isDisguised);
		context.looks = getLooks(this.actor).map(look => ({ ...look, active: look.id === currentId }));
		context.canBrowse = game.user.can("FILES_BROWSE");
		context.target = target && target.document !== token ? target.document.name : null;
		context.copyName = this.copyName ?? true;
		return context;
	}

	async _onRender(context, options) {
		await super._onRender(context, options);
		this.element.querySelector("[name=copyName]")?.addEventListener("change", event => {
			this.copyName = event.currentTarget.checked;
		});
	}

	_onClose(options) {
		super._onClose(options);
		TransformationPicker.#open.delete(this.actor.uuid);
	}

	#findLook(target) {
		const id = target.closest("[data-look-id]")?.dataset.lookId;
		return getLooks(this.actor).find(look => look.id === id);
	}

	async #wear(look) {
		if (!await transformActor(this.actor, look)) {
			ui.notifications.warn("MIST_TRANSFORM.Picker.NoToken", { localize: true });
			return;
		}
		// Opened by an effect, the window has done its job.
		if (this.effect) {
			this.close();
		}
	}

	async #addLook(look, { wear = true } = {}) {
		await saveLooks(this.actor, [...getLooks(this.actor), look]);
		if (wear) {
			await this.#wear(look);
		}
	}

	static async #onApply(event, target) {
		const look = this.#findLook(target);
		if (look) {
			await this.#wear(look);
		}
	}

	/** Ends the transformation effects on the actor along with the look, so the effect does not outlive the illusion. */
	static async #onDrop() {
		const effectIds = this.actor.effects.filter(isTransformation).map(effect => effect.id);
		if (effectIds.length) {
			await this.actor.deleteEmbeddedDocuments("ActiveEffect", effectIds);
		}
		await restoreActor(this.actor);
	}

	static async #onRemove(event, target) {
		event.stopPropagation();
		const look = this.#findLook(target);
		if (!look) {
			return;
		}
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: "MIST_TRANSFORM.Picker.Remove" },
			content: `<p>${game.i18n.format("MIST_TRANSFORM.Picker.RemoveConfirm", { label: foundry.utils.escapeHTML(look.label) })}</p>`
		});
		if (confirmed) {
			await saveLooks(this.actor, getLooks(this.actor).filter(l => l.id !== look.id));
		}
	}

	static #onAddImage() {
		const FilePicker = foundry.applications.apps.FilePicker.implementation;
		new FilePicker({
			type: "image",
			current: this.token?.texture.src ?? this.actor.img,
			callback: path => this.#addLook(imageLook(path), { wear: false })
		}).render({ force: true });
	}

	static async #onCopyTarget() {
		const target = game.user.targets.first();
		if (!target || target.document === this.token) {
			ui.notifications.warn("MIST_TRANSFORM.Picker.NoTarget", { localize: true });
			return;
		}
		await this.#addLook(tokenLook(target.document, { withName: this.copyName ?? true }), { wear: false });
	}

	/** Keeps the look the token has now, such as one the GM set by hand, among the saved looks. */
	static async #onSaveCurrent() {
		const token = this.token;
		if (!token) {
			ui.notifications.warn("MIST_TRANSFORM.Picker.NoToken", { localize: true });
			return;
		}
		const look = tokenLook(token);
		look.label = token.name;
		await this.#addLook(look, { wear: false });
	}
}
