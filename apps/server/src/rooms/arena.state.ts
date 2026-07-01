import { ArraySchema, Schema, type } from "@colyseus/schema";

class ArenaTileState extends Schema {
  @type("string")
  regionId = "";

  @type("number")
  cellX = 0;

  @type("number")
  cellY = 0;

  @type("string")
  shape = "";

  @type("string")
  color = "";
}

class ArenaBondState extends Schema {
  @type("string")
  bondId = "";

  @type("string")
  regionId = "";

  @type("number")
  fromCellX = 0;

  @type("number")
  fromCellY = 0;

  @type("number")
  toCellX = 0;

  @type("number")
  toCellY = 0;

  @type("string")
  bondType = "";

  @type("string")
  color = "";
}

export class ArenaState extends Schema {
  @type([ArenaTileState])
  tiles = new ArraySchema<ArenaTileState>();

  @type([ArenaBondState])
  bonds = new ArraySchema<ArenaBondState>();

  @type("number")
  tick = 0;

  @type("number")
  playerAHealth = 100;

  @type("number")
  playerBHealth = 100;
}