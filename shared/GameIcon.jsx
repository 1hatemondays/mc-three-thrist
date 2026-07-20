import React from "react";
import { EVENT_TILE_TYPES, SUPPORT_ITEM_TYPES } from "./gameContent.js";
import beartrapIcon from "./assets/beartrap.svg";
import bombIcon from "./assets/bomb.svg";
import jailIcon from "./assets/jail.svg";
import healIcon from "./assets/heal.svg";
import lightbulbIcon from "./assets/lightbulb.svg";
import meteorIcon from "./assets/meteor.svg";
import monsterIcon from "./assets/monster.svg";
import shieldIcon from "./assets/shield.svg";
import snowflakeIcon from "./assets/snowflake.svg";
import switchIcon from "./assets/switch.svg";
import teleportIcon from "./assets/teleport.svg";
import wallIcon from "./assets/wall.svg";
import wiseIcon from "./assets/wise.svg";
import "./gameIcon.css";

export const CUSTOM_ICON_TYPES = {
  WALL: "wall"
};

const IMAGE_ICONS = {
  [EVENT_TILE_TYPES.BOMB]: bombIcon,
  [EVENT_TILE_TYPES.BLESSING]: healIcon,
  [EVENT_TILE_TYPES.KNOWLEDGE]: wiseIcon,
  [EVENT_TILE_TYPES.METEOR_STRIKE]: meteorIcon,
  [EVENT_TILE_TYPES.MONSTER_ATTACK]: monsterIcon,
  [EVENT_TILE_TYPES.POSITION_SWAP]: switchIcon,
  [EVENT_TILE_TYPES.PRISON]: jailIcon,
  [EVENT_TILE_TYPES.TELEPORT]: teleportIcon,
  [CUSTOM_ICON_TYPES.WALL]: wallIcon,
  [SUPPORT_ITEM_TYPES.DIRECTION_HINT]: lightbulbIcon,
  [SUPPORT_ITEM_TYPES.FREEZE_OPPONENT]: snowflakeIcon,
  [SUPPORT_ITEM_TYPES.METEOR_SHOWER]: meteorIcon,
  [SUPPORT_ITEM_TYPES.SHIELD]: shieldIcon,
  [SUPPORT_ITEM_TYPES.TRAP]: beartrapIcon
};

const TEXT_ICONS = {
  [EVENT_TILE_TYPES.DUEL]: "V/S",
  [SUPPORT_ITEM_TYPES.DOUBLE_SCORE]: "x2"
};

export const GameIcon = ({ className = "", color, label = "Biểu tượng", symbol = "?", type }) => {
  const image = IMAGE_ICONS[type];
  const text = TEXT_ICONS[type] || symbol || "?";
  const classes = ["game-icon", image ? "is-image" : "is-text", className].filter(Boolean).join(" ");

  return (
    <span aria-label={label} className={classes} role="img" style={{ "--event-color": color, "--item-color": color }}>
      {image ? <img alt="" aria-hidden="true" src={image} /> : text}
    </span>
  );
};
