# CLI

`mcphubctl` talks only to the API.

```sh
mcphubctl login --api-url http://localhost:4000 --token dev-admin-token
mcphubctl whoami
mcphubctl server list
mcphubctl server register -f server.yaml
mcphubctl server sync <server-id-or-slug>
mcphubctl server sync-stdio <server-id-or-slug> -f server.yaml
mcphubctl snapshot get <server-id-or-slug>
mcphubctl audit list --server <server-id-or-slug>
```

Tokens are stored at `~/.config/mcphubctl/config.json` with `0600` permissions. `MCPHUB_TOKEN` overrides the config token.
