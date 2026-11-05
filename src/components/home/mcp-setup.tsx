import "./mcp-setup.css";

import InlineLink from "fumadocs-core/link";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { DocsBody } from "fumadocs-ui/page";

const MCP_GUIDE_HREF = "/platform/interfaces/mcp";

const EXPORT_TOKEN = "export VOLCANO_PROJECT_TOKEN=pt-your-project-access-token";

// One snippet per client. Keep them in step with the per-client sections of
// the MCP guide, which volcano-hosting's docs/public/interfaces/mcp.md owns.
// Every snippet reads the token from the VOLCANO_PROJECT_TOKEN export above.
const CLIENTS = [
  {
    name: "Claude Code",
    lang: "bash",
    code: `claude mcp add --transport http volcano https://api.volcano.dev/mcp \\
  --header 'Authorization: Bearer \${VOLCANO_PROJECT_TOKEN}'`,
  },
  {
    name: "Cursor",
    title: "~/.cursor/mcp.json",
    lang: "json",
    code: `{
  "mcpServers": {
    "volcano": {
      "url": "https://api.volcano.dev/mcp",
      "headers": {
        "Authorization": "Bearer \${env:VOLCANO_PROJECT_TOKEN}"
      }
    }
  }
}`,
  },
  {
    name: "Codex",
    lang: "bash",
    code: `codex mcp add volcano \\
  --url https://api.volcano.dev/mcp \\
  --bearer-token-env-var VOLCANO_PROJECT_TOKEN`,
  },
  {
    name: "OpenCode",
    title: "~/.config/opencode/opencode.json",
    lang: "json",
    code: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "volcano": {
      "type": "remote",
      "url": "https://api.volcano.dev/mcp",
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:VOLCANO_PROJECT_TOKEN}"
      }
    }
  }
}`,
  },
  {
    name: "Pi",
    lang: "bash",
    code: `pi mcp add volcano \\
  --url https://api.volcano.dev/mcp \\
  --bearer-token-env-var VOLCANO_PROJECT_TOKEN`,
  },
  {
    name: "GitHub Copilot",
    title: "~/.copilot/mcp-config.json",
    lang: "json",
    code: `{
  "mcpServers": {
    "volcano": {
      "type": "http",
      "url": "https://api.volcano.dev/mcp",
      "headers": {
        "Authorization": "Bearer \${VOLCANO_PROJECT_TOKEN}"
      },
      "tools": ["*"]
    }
  }
}`,
  },
  {
    name: "Gemini CLI",
    title: "~/.gemini/settings.json",
    lang: "json",
    code: `{
  "mcpServers": {
    "volcano": {
      "httpUrl": "https://api.volcano.dev/mcp",
      "headers": {
        "Authorization": "Bearer \${VOLCANO_PROJECT_TOKEN}"
      }
    }
  }
}`,
  },
];

const CLIENT_NAMES = CLIENTS.map(function clientName(client) {
  return client.name;
});

// Home page MCP section: export a project access token, then add the server
// to a coding agent. Snippets are highlighted at build time.
export function McpSetup() {
  return (
    <section data-slot="mcp-setup" className="mcp-setup">
      <DocsBody className="mcp-setup-body">
        <p>
          Your coding agent can inspect a project&apos;s functions,
          deployments, and logs, and change it with a full-scope token. Create
          a{" "}
          <InlineLink href={`${MCP_GUIDE_HREF}#create-a-token-for-the-agent`}>
            project access token
          </InlineLink>
          , export it, and add the server to your client.
        </p>
        <ServerCodeBlock code={EXPORT_TOKEN} lang="bash" />
        <p>
          Start your agent from that shell. Editors such as Cursor and VS Code
          read the variable from the environment they were launched in, so quit
          the editor fully and reopen it from the shell, for example with{" "}
          <code>cursor .</code> or <code>code .</code>. Exporting it in the
          editor&apos;s own terminal is not enough.
        </p>
        <Tabs items={CLIENT_NAMES}>
          {CLIENTS.map(function renderClient(client) {
            return (
              <Tab key={client.name} value={client.name}>
                <ServerCodeBlock
                  code={client.code}
                  lang={client.lang}
                  codeblock={{ title: client.title }}
                />
              </Tab>
            );
          })}
        </Tabs>
        <p>
          Project-level config files, token scopes, and the full tool list are
          in the <InlineLink href={MCP_GUIDE_HREF}>MCP server guide</InlineLink>.
        </p>
      </DocsBody>
    </section>
  );
}
