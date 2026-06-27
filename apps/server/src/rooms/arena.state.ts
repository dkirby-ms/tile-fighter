import { Schema, type } from "@colyseus/schema";

export class ArenaState extends Schema {
  @type("number")
  tick = 0;

  @type("number")
  playerAHealth = 100;

  @type("number")
  playerBHealth = 100;
}