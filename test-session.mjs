import { createSession, store } from "./apps/backend/src/services/mockStore.ts";

console.log("Creating session...");
const session = createSession("testuser");
console.log("Session created:", session);

console.log("Checking if session exists in store...");
const found = store.sessions.get(session.token);
console.log("Found session:", found);

console.log("All sessions in store:", Array.from(store.sessions.entries()));
