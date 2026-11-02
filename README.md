# The Mist Age - Transformations

A Foundry VTT module for the Daggerheart system. When a character transforms, for example casts an illusion on themselves, a window opens for the player to pick a new look for their token. When the effect ends, the token returns to its own look. No trip to the token settings.

## Requirements

- Foundry VTT 13–14, the Daggerheart system. Nothing else is required.
- [**The Mist Age - Toolkit**](https://github.com/liderako/foundry_daggerheart_toolkit) is optional. Its token name sync leaves transformed tokens alone, so a borrowed name is not written onto the sheet or reset when the world loads.

## Installation

In Foundry, install the module from its manifest URL:

```
https://github.com/liderako/foundry_daggerheart_token_transformation/releases/latest/download/module.json
```

Or put the module folder at `Data/modules/mist-age-transformations`. Then enable **The Mist Age - Transformations** in your world.

## Setting up a card

1. Open the domain card (or any other feature) and the effect its action applies.
2. On the **Details** tab of the effect, check **Transformation**.

The system copies the effect onto the character together with this mark, so using the card's action is enough.

## In play

- When a transformation effect lands on a character, a window with the character's saved looks opens:
  - for the player who used the card, if it is their character;
  - for the character's player, if someone else cast it on them;
  - for the GM, if no player who owns the character is online.
- A click on a look puts it on the character's tokens on the current scene, and the window closes.
- When the effect is deleted, expires or is disabled, the tokens return to their own look. While another transformation effect is still active on the character, the look stays.
- **Drop transformation** in the window returns the look and removes the character's transformation effects.

## Saved looks

Looks are saved on the character (on the token's own sheet for unlinked tokens). The **mask button** on the left of the token HUD opens the same window to manage them. Under **Add looks**:

- **Add image** picks a picture through the file browser; the token keeps its name and size. Players need the *Use File Browser* permission; without it the GM adds images for them.
- **Copy …** takes the look of the targeted token (T): its image, size, scale and, if checked, its name.
- **Save current look** keeps the token's look as it is now.

A look is removed with the cross on its corner.

The token's own look is stored once, on the first transformation, so looks can be swapped any number of times and dropping always returns the real one.

## Macros

```js
const api = game.modules.get("mist-age-transformations").api;
api.open(actor);          // the looks window
api.restoreActor(actor);  // return the actor's tokens to their own look
```

## Releases

Pushing a `vX.Y.Z` tag builds `module.json` and `module.zip` and attaches them to a GitHub release.

## License

[Apache License 2.0](LICENSE)
