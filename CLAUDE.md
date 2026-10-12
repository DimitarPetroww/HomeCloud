# Home Cloud — Software Development Plan

## 1. Product Vision

Build a customer-owned Home Cloud appliance that provides the convenience of iCloud/Google Photos while keeping the customer's data on hardware physically located in their home.

Core principle:

> Customer data lives on the customer's Home Cloud. Our cloud provides optional control-plane services, not primary storage.

The first product experience to prove:

**Take a photo on a phone → it automatically backs up to the Home Cloud → the photo is accessible from mobile and desktop.**

Clients are the mobile app and the desktop app only. There is no web app for browsing photos. A public marketing/SEO website will come later and is not part of the product UI.

Do not start with hardware. Build and test the software on a normal development computer first, then move the same software to an N100/N150-class appliance.

---

## 2. Architecture

### High-level

```
Mobile app / Desktop app
        |
        | secure connection
        v
Customer Home Cloud
        |
        +-- Local API
        +-- Photo/File services
        +-- Database
        +-- Device Agent
        +-- Storage
```

The product is **local-first**: users, sign-in, pairing and all data live on the appliance. Everything at home works without our servers or an internet connection.

The control plane is deliberately thin and is assembled from existing tools, not a custom backend:

- **Relay** for remote access: self-hosted open-source **frp or rathole** on a small rented server, with TLS passthrough (it routes by hostname and cannot decrypt traffic). ngrok (TLS passthrough, Node SDK) is acceptable as a temporary stopgap during early testing, not for launch.
- **Device routing:** a wildcard DNS record (e.g. `*.<our-device-domain>`) pointing at the relay, plus relay config/credentials mapping each hostname to its appliance. A real device-registry service only if scale requires it.
- **Software updates:** static files on GitHub Releases, Cloudflare R2 or S3. No update server.
- Optional, later: telemetry/notifications.

Our only custom code here is provisioning each appliance with its relay credential and hostname.

Not allowed as the relay: services that decrypt traffic on their side (Cloudflare Tunnel), or mesh VPNs that require users to install a VPN app/profile (Tailscale, NetBird).

The control plane stores no customer data and no user accounts. It knows appliances, not the people using them.

### Home Cloud layers

1. Linux
2. Storage
3. Database
4. Home Cloud application/API
5. Device Agent
6. Mobile/desktop clients (they talk to the Local API; the Home Cloud does not serve a UI)

### Users and households

One Home Cloud serves one household.

- User limit per Home Cloud, owner included: **6 by default**, configurable per appliance via `MAX_USERS` (set at provisioning, read only through the validated config, never hard-coded). The appliance enforces it. If the limit ever becomes a paid tier, move it to a signed entitlement issued at provisioning, since an env file can be edited by anyone with shell access to the box.
- Each user has their own account and a private library. Nothing is visible to other users unless shared.
- Roles:
  - **Owner**: sets up the device, invites/removes users, resets members' passwords, manages storage and settings. Exactly one per device.
  - **Member**: backs up and sees their own photos plus what is shared with them.
- User accounts live on the appliance, not in our cloud. Passwords are hashed with a mature library (argon2id); sessions/tokens use established libraries — never a custom scheme.
- Each user can pair multiple devices (phone, laptop, tablet). Every paired device has its own revocable credential.
- Invites are local: the owner creates an invite in their app, which shows a QR code / short code; the new member scans it (mobile) or types it (desktop), sets a password and becomes a user. See Pairing under Connectivity.
- Owner recovery (lost owner password) requires physical access to the appliance (e.g. the setup code on the box or a reset button). Design details later.
- The data model is multi-user from day one: every photo, album and paired device belongs to a `user_id`, and every API request is authorized against the requesting user and role — even while the UI only exposes a single user.
- Later: shared albums, a shared family library, per-user storage quotas.

### Connectivity

Clients reach the Home Cloud in two situations: **at home** (same network) and **away** (behind the home router/CGNAT).

- **Discovery (at home):** the appliance advertises itself via mDNS/Bonjour (`_homecloud._tcp`). The client also remembers the last known LAN address. Last resort: manual address in settings.
- **Pairing (mobile and desktop alike):** every new device joins with a short code. Mobile scans it as a QR code; desktop types it. Both then run the same **PAKE** (password-authenticated key exchange, e.g. CPace or SPAKE2) with the appliance: each side proves it knows the code without sending it. Over that verified channel the appliance sends its certificate fingerprint, which the client pins.
  - **First-time setup:** code = the setup code printed on the box (see Provisioning). Completing it creates the owner account. Without the code, nobody else on the network can take over a new box.
  - **Invite a member:** code generated by the owner's app (QR + short code), single use, expires after ~15 minutes.
  - **Add another device for an existing user:** code generated by any of that user's already-paired devices, same rules as invites.
  - The appliance rate-limits pairing attempts; codes cannot be guessed offline.
  - A new device never signs in with only a password and no code: without a trusted code it cannot verify the appliance and could leak the password to an impostor.
  - Use an audited, maintained PAKE implementation; choosing it is a research task before building pairing. Never implement the PAKE ourselves.
- **Auth:** the appliance is the identity provider for its own users. Signing in on a device produces a long-lived, revocable device credential issued by the appliance. The same credential works at home and through the relay; our cloud is never involved in sign-in.
- **TLS:** always encrypted, end to end between client and appliance.
  - Each appliance has a self-signed certificate; its private key never leaves the appliance. Long validity (10–20 years) so it never expires in the field; if it must be replaced, the appliance announces the new fingerprint over the existing trusted connection.
  - Clients pin the certificate's fingerprint and refuse any connection where it does not match (fine because we control all clients; there is no browser app).
  - Clients never pin "whatever answered first": the fingerprint is only accepted over the PAKE-verified pairing channel.
  - The same pinned certificate is used at home and through the relay, since the relay only reads the hostname (SNI). No public certificates or DNS automation unless a browser-facing need appears.
  - Desktop pins in Electron's main process (Node TLS). Mobile needs a native pinning module (Expo has none built in); choose it when mobile starts.
- **DNS (remote only):** each appliance has a hostname `<device-id>.<our-device-domain>`. One wildcard record points all of them at the relay, which routes by SNI. DNS provider must not proxy traffic (e.g. Cloudflare "DNS only"). At home no DNS is used; clients connect to the LAN address from mDNS.
- **Remote access (away):** no port forwarding or UPnP. The appliance keeps an outbound tunnel to the relay (see the control plane above). Build on existing tools; never invent a tunnel/VPN protocol.
- **Client connection manager** (`packages/api-client`): try the LAN address first, fall back to the relay. Same API and credentials on both paths; the rest of the app does not care which is used.
- **Desktop:** all API calls run in Electron's main process. Credentials are stored via `safeStorage`/OS keychain and never reach the renderer. Images reach the UI through a custom protocol (e.g. `homecloud://thumb/<id>`) served by the main process.
- **Mobile:** credentials in the OS secure storage (Keychain/Keystore).

### Provisioning

Before an appliance ships, a provisioning step gives it its identity:

- a **random device ID** (not a serial number, not guessable), which becomes its hostname
- a **TLS key pair and self-signed certificate** (private key stays on the device)
- a **unique setup code**
- later (phase 2): its **relay credential**

The box label shows the setup code twice: as a **QR code** (for mobile) and as **readable text** (for typing on desktop). The code is long enough to resist online guessing combined with rate limiting, and avoids ambiguous characters (0/O, 1/I/l).

During development, `pnpm provision:dev` (package `infrastructure/provisioning`) generates the same identity for a local appliance and prints the label (setup code + QR), so the setup flow can be built and tested before real hardware exists.

- Output goes to `.appliance/` at the repo root: `device.json` (device ID, setup code, fingerprint, `maxUsers`), `tls/key.pem` (mode 0600), `tls/cert.pem`. It is gitignored and dockerignored, since it contains a private key. On the appliance it is mounted into the API container.
- Refuses to overwrite an existing identity without `--force` (re-provisioning = a brand-new box). Options: `--max-users <n>`, `--out <dir>`.
- `src/identity.ts` holds pure generation functions (no file I/O) so the factory step can reuse them.
- Keys are ECDSA P-256; certificates come from `@peculiar/x509` (needs `reflect-metadata` imported first); randomness from `node:crypto`.
- Setup code: 12 characters from a 30-symbol alphabet without look-alikes, shown as `XXXX-XXXX-XXXX`. Device ID: 16 lowercase DNS-safe characters.
- QR content: `homecloud://setup?device=<id>&code=<code>`.
- The certificate fingerprint is the SHA-256 of the public key in SPKI DER form, as colon-separated hex. Clients must compute it the same way: from the peer certificate's DER, not from Node's `getPeerCertificate().pubkey`, which for EC keys is the raw point and gives a different hash. Verify the pin during the TLS handshake, before sending any request data.
- In dev, `device.json` stores the setup code in plain text. What the real appliance stores is decided together with the PAKE library.

Phases:

1. **LAN only (now), no control plane:** dev provisioning script, mDNS discovery, code-based PAKE pairing (setup, invites, extra devices) on desktop and mobile, local users and roles, sign-in and device credentials, pinned self-signed certificate, connection manager. Proves the first milestone at home.
2. **Remote access, thin control plane:** self-hosted frp/rathole relay (ngrok as a stopgap if needed), wildcard DNS and per-device hostnames, relay credential provisioning, update files on static hosting.
3. **Direct peer-to-peer:** NAT traversal with relay fallback to reduce relay bandwidth, using an existing solution.

---

## 3. Recommended Technology Stack

Use one primary programming language initially.

### Core

- TypeScript (pinned to 6.0.x: typescript-eslint does not support 7 yet)
- Node.js 24
- React
- React Native + Expo
- Electron for desktop
- PostgreSQL
- Docker / Docker Compose
- pnpm
- Turborepo
- GitHub

### Clients

Desktop (`apps/desktop`):

- Electron + Vite + React (plain React, not Next.js: no server rendering is needed inside a desktop app)
- electron-vite for dev/build; stay on its stable release (currently Vite 7) rather than betas
- Native work (folder watching/sync, background uploads, thumbnails, tray, keychain) runs in Electron's main process in TypeScript/Node.js. Do not introduce Rust or other native languages for this.
- Security defaults: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. The renderer talks to the main process only through a typed preload API.
- TanStack Router, TanStack Query, TanStack Virtual (large photo grids)
- Tailwind CSS v4
- Own components; headless primitives (Radix Primitives or Base UI) for behavior such as dialogs and menus

Mobile (`apps/mobile`):

- Expo + React Native
- Uniwind (Tailwind v4 for React Native)
- Own components built on React Native primitives

Marketing/SEO site (`apps/site`, later):

- The only place where server rendering matters; choose a framework (e.g. Next.js or Astro) when it is built
- Has its own styling and content; it may import the shared theme but shares no components

### Styling rules

- Tailwind CSS v4 with CSS-first config. There is no `tailwind.config.js`.
- No shadcn/ui or other styled component kits. Each app builds its own components with Tailwind classes; desktop and mobile do not share component code.
- One light theme only. No dark mode, no theme switching, no `dark:` classes.
- `packages/config/tailwind/theme.css` is the single styling config: one `@theme` block (colors, radius, later fonts/spacing). Every app's stylesheet imports it after `tailwindcss` (and `uniwind` on mobile).
- Keep `theme.css` to `@theme` values only: no selectors, base styles or plugins, since Uniwind must be able to read it. Colors are hex because React Native has no oklch.

### Shared tooling

All configuration lives in `packages/config`:

- `@homecloud/config/tsconfig/{base,react,node,library}.json`: every package's tsconfig extends one of these
- `@homecloud/config/eslint`: `node()`, `react()`, `library()` flat-config factories (typescript-eslint strict + stylistic, type-checked)
- `@homecloud/config/prettier`: used by the root `prettier.config.js`
- `@homecloud/config/tailwind/theme.css`: the shared Tailwind theme

Do not add per-package lint or TS rules unless a package genuinely needs an exception.

### Device Agent

Use TypeScript/Node.js.

The Device Agent is responsible for:

- Device identity
- Hardware/system status
- Storage statistics
- Service health
- Updates
- Communication with the control plane
- Receiving authorized device-management commands

### Appliance runtime

Services run as **containers** on a minimal Linux (Docker Compose today; Podman + systemd is an acceptable later switch):

- One image per service: API (`apps/api/Dockerfile`), PostgreSQL (`postgres:18-alpine`), later the Device Agent.
- Images must build and run on **linux/amd64** (N100/N150). Containers run as a non-root user.
- The API applies pending database migrations on every start, so an updated appliance migrates itself.
- On the appliance the API uses `network_mode: host` so mDNS reaches the home network (Docker on macOS cannot do this, so in development the API runs natively).
- The Device Agent needs host access (disks, sensors, system stats); decide between a privileged container and a native service when it is built.
- All host-specific values (storage root, ports, limits) come from validated env config, never hard-coded paths.
- Later: image-based OS updates with automatic rollback (e.g. RAUC or Mender) so a failed update cannot leave a box broken.
- Test on a real Linux machine (any x86 mini PC or a VM) early, not only at the end.

Local commands (repo root):

- `pnpm db:up` / `pnpm db:down`: PostgreSQL only, for development with the API running natively (`pnpm dev`).
- `pnpm appliance:up` / `pnpm appliance:down`: API + PostgreSQL in containers, as on the box.

### Storage

Initially:

- Local filesystem
- PostgreSQL for metadata

Later:

- Evaluate ext4 vs ZFS/other storage architecture
- RAID/mirroring at the appliance level
- External/off-site backup

Do not implement a filesystem.

### Existing technology

Prefer mature components rather than reinventing:

- Photo management where appropriate
- File synchronization where appropriate
- Secure networking/VPN/tunneling
- Authentication primitives
- TLS
- Cryptographic libraries

Never invent custom encryption, VPN protocols, or authentication schemes.

---

## 4. Monorepo

Use a monorepo.

Initial structure:

```
homecloud/
  apps/
    desktop/       Electron desktop app
    mobile/        Expo app
    api/           Home Cloud Local API (runs on the appliance)
    device-agent/
    site/          marketing/SEO site (later)

  packages/
    types/
    api-client/
    config/        shared tsconfig, ESLint, Prettier and Tailwind theme
    auth/

  infrastructure/
    docker/
    provisioning/

  docs/
  tests/

  package.json
  pnpm-workspace.yaml
  turbo.json
```

Do not create every application immediately. Add them when needed.

Shared packages should contain reusable contracts and logic, but do not force all platforms to share code that makes the architecture worse.
