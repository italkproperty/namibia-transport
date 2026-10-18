import assert from "node:assert/strict";
import { searchNodes } from "../lib/network/nodes";

const luderitz = searchNodes("Luderitz");
assert.ok(luderitz.some((node) => node.slug === "luderitz"), "accent-free spelling finds Lüderitz");

const airport = searchNodes("WDH airport");
assert.ok(airport.some((node) => node.slug === "hosea-kutako"), "airport codes and aliases are searchable");

const etosha = searchNodes("Etosha");
assert.ok(etosha.some((node) => node.slug === "etosha-okaukuejo"));
assert.ok(etosha.some((node) => node.slug === "etosha-namutoni"), "similarly named gates remain distinct");

assert.deepEqual(searchNodes("place that does not exist"), [], "unknown places are not mapped to a guessed node");

console.log("Journey place search tests passed.");
