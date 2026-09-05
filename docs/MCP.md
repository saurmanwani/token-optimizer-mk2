# MCP Integration

Start the local stdio server:

```bash
npm run contextproof -- mcp
```

For an MCP host, configure the repository-local command:

```json
{
  "mcpServers": {
    "contextproof": {
      "command": "npm",
      "args": ["run", "contextproof", "--", "mcp"],
      "cwd": "/absolute/path/to/token-optimizer-mk2"
    }
  }
}
```

The server exposes:

- `contextproof_inspect`
- `contextproof_recommend`
- `contextproof_stats`

Inspection and recommendations accept normalized events in the request. The
server does not read arbitrary paths supplied by an agent, mutate context, or
make network requests.

The implementation uses newline-delimited JSON-RPC over stdio and advertises
MCP protocol version `2025-06-18`. It is intentionally small; production
distribution should add protocol conformance tests and a maintained MCP SDK.
