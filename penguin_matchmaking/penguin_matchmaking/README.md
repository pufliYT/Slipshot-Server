# Penguin matchmaking service

Minimal party-code lookup for a Godot 4 game using ENet. This service maps a short code to the public IP observed by the HTTP service and a UDP port.

## Deploy

Deploy this folder as a Node web service on a host that supports Node.js. Use `npm start` as the start command. The host should provide an HTTPS URL such as `https://your-service.example.com`.

## API

- `GET /health` — health check
- `POST /host` with JSON `{ "port": 7000 }` — creates a room; returns `{ "code": "...", "port": 7000 }`
- `GET /join/CODE` — returns `{ "ip": "...", "port": 7000 }`
- `DELETE /room/CODE` — removes a room

Rooms expire after two hours and are stored in memory, so a service restart clears them.

## Important limitation

This is matchmaking/discovery, not a relay. ENet traffic still goes directly from guest to host over UDP. The host generally needs UDP port forwarding on port 7000 and a reachable public IP. CGNAT or restrictive networks may prevent direct connections. To work without port forwarding, a UDP relay or a more advanced NAT-traversal setup is required.

For a public release, add room ownership tokens, rate limits, and abuse protection before relying on DELETE or room creation.
