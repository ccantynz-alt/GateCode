#!/usr/bin/env node

// GateCode CLI — zero-dependency command-line client for gatecode.sh

import { GateCode, GateCodeError } from "./sdk.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

// ── ANSI Colors ──────────────────────────────────────────────────────────────

const isColorEnabled = process.env.NO_COLOR === undefined && process.stdout.isTTY;

const c = {
  reset: isColorEnabled ? "\x1b[0m" : "",
  bold: isColorEnabled ? "\x1b[1m" : "",
  dim: isColorEnabled ? "\x1b[2m" : "",
  red: isColorEnabled ? "\x1b[31m" : "",
  green: isColorEnabled ? "\x1b[32m" : "",
  yellow: isColorEnabled ? "\x1b[33m" : "",
  blue: isColorEnabled ? "\x1b[34m" : "",
  cyan: isColorEnabled ? "\x1b[36m" : "",
};

// ── Config ───────────────────────────────────────────────────────────────────

interface Config {
  apiKey?: string;
  username?: string;
  baseUrl?: string;
}

const CONFIG_DIR = join(homedir(), ".gatecode");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

function loadConfig(): Config {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as Config;
    }
  } catch {
    // Ignore invalid config
  }
  return {};
}

function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

// ── Arg Parsing ──────────────────────────────────────────────────────────────

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args[0] ?? "help";
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function getApiKey(flags: Record<string, string | boolean>): string {
  const key =
    (typeof flags.key === "string" ? flags.key : undefined) ??
    process.env.GATECODE_API_KEY ??
    loadConfig().apiKey;

  if (!key) {
    error(
      'No API key found. Run "gatecode login" or set GATECODE_API_KEY.'
    );
    process.exit(1);
  }
  return key;
}

function getUsername(flags: Record<string, string | boolean>): string | undefined {
  return (
    (typeof flags.user === "string" ? flags.user : undefined) ??
    process.env.GATECODE_USERNAME ??
    loadConfig().username
  );
}

function getBaseUrl(flags: Record<string, string | boolean>): string | undefined {
  return typeof flags.url === "string" ? flags.url : loadConfig().baseUrl;
}

// ── Output ───────────────────────────────────────────────────────────────────

function error(msg: string): void {
  console.error(`${c.red}${c.bold}error${c.reset}${c.red}: ${msg}${c.reset}`);
}

function success(msg: string): void {
  console.log(`${c.green}${c.bold}${msg}${c.reset}`);
}

function info(msg: string): void {
  console.log(`${c.cyan}${msg}${c.reset}`);
}

function label(key: string, value: string): void {
  console.log(`  ${c.dim}${key}:${c.reset} ${value}`);
}

function jsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// ── Spinner ──────────────────────────────────────────────────────────────────

class Spinner {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private idx = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    if (!process.stdout.isTTY) {
      console.log(this.message);
      return;
    }
    process.stdout.write(`${c.cyan}${this.frames[0]} ${this.message}${c.reset}`);
    this.timer = setInterval(() => {
      this.idx = (this.idx + 1) % this.frames.length;
      process.stdout.write(
        `\r${c.cyan}${this.frames[this.idx]} ${this.message}${c.reset}`
      );
    }, 80);
  }

  stop(finalMessage?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (process.stdout.isTTY) {
      process.stdout.write("\r\x1b[K");
    }
    if (finalMessage) {
      console.log(finalMessage);
    }
  }
}

// ── Prompt ───────────────────────────────────────────────────────────────────

function prompt(question: string, mask = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (mask && process.stdin.isTTY) {
      // For API key input, we don't echo characters
      process.stdout.write(question);
      let input = "";
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf-8");

      const onData = (ch: string) => {
        const char = ch.toString();
        if (char === "\n" || char === "\r") {
          process.stdin.setRawMode(false);
          process.stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (char === "\u0003") {
          // Ctrl+C
          process.stdout.write("\n");
          process.exit(1);
        } else if (char === "\u007f" || char === "\b") {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          input += char;
          process.stdout.write("*");
        }
      };

      process.stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdRequest(
  parsed: ParsedArgs,
  isJson: boolean
): Promise<void> {
  const repo = parsed.positional[0];
  if (!repo) {
    error('Missing required argument: <repo>\nUsage: gatecode request <repo> [--scope read|write] [--reason "..."] [--wait]');
    process.exit(1);
  }

  const scope = (parsed.flags.scope as string) ?? "read";
  if (scope !== "read" && scope !== "write") {
    error('Invalid scope. Must be "read" or "write".');
    process.exit(1);
  }

  const reason = typeof parsed.flags.reason === "string" ? parsed.flags.reason : undefined;
  const wait = parsed.flags.wait === true;

  const apiKey = getApiKey(parsed.flags);
  const client = new GateCode({
    apiKey,
    baseUrl: getBaseUrl(parsed.flags),
    username: getUsername(parsed.flags),
  });

  if (wait) {
    const spinner = new Spinner("Requesting access and waiting for approval...");
    if (!isJson) spinner.start();

    try {
      const result = await client.requestAndWait({
        repo,
        scope: scope as "read" | "write",
        reason,
      });

      spinner.stop();

      if (isJson) {
        jsonOutput(result);
        return;
      }

      if (result.status === "approved") {
        success("Access approved!");
        label("Request ID", String(result.id));
        label("Token", result.token ?? "(none)");
        if (result.expires_at) label("Expires", result.expires_at);
      } else if (result.status === "denied") {
        error("Access denied.");
        label("Request ID", String(result.id));
      } else {
        error("Request timed out. The owner has not responded yet.");
        label("Request ID", String(result.id));
        info('Run "gatecode status ' + result.id + '" to check later.');
      }
    } catch (err) {
      spinner.stop();
      throw err;
    }
  } else {
    const result = await client.request({
      repo,
      scope: scope as "read" | "write",
      reason,
    });

    if (isJson) {
      jsonOutput(result);
      return;
    }

    success("Access request created.");
    label("Request ID", String(result.id));
    label("Status", result.status);
    label("Repo", repo);
    label("Scope", scope);
    if (result.status === "pending") {
      info(
        '\nWaiting for owner approval. Run "gatecode status ' +
          result.id +
          '" to check.'
      );
    }
  }
}

async function cmdStatus(
  parsed: ParsedArgs,
  isJson: boolean
): Promise<void> {
  const idStr = parsed.positional[0];
  if (!idStr) {
    error("Missing required argument: <id>\nUsage: gatecode status <id>");
    process.exit(1);
  }

  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    error("Invalid request ID. Must be a number.");
    process.exit(1);
  }

  const apiKey = getApiKey(parsed.flags);
  const client = new GateCode({
    apiKey,
    baseUrl: getBaseUrl(parsed.flags),
    username: getUsername(parsed.flags),
  });

  const result = await client.status(id);

  if (isJson) {
    jsonOutput(result);
    return;
  }

  const statusColor =
    result.status === "approved"
      ? c.green
      : result.status === "denied"
        ? c.red
        : c.yellow;

  console.log(
    `\n  ${c.bold}Request #${result.id}${c.reset}  ${statusColor}${result.status}${c.reset}\n`
  );
  if (result.token) label("Token", result.token);
  if (result.expires_at) label("Expires", result.expires_at);
  console.log();
}

async function cmdLogin(isJson: boolean): Promise<void> {
  console.log(`\n${c.bold}GateCode Login${c.reset}\n`);
  info("Get your API key at https://gatecode.sh/settings/keys\n");

  const apiKey = await prompt(`${c.bold}API Key: ${c.reset}`, true);
  if (!apiKey) {
    error("No API key provided.");
    process.exit(1);
  }

  const username = await prompt(`${c.bold}Username (optional): ${c.reset}`);

  const config = loadConfig();
  config.apiKey = apiKey;
  if (username) config.username = username;
  saveConfig(config);

  if (isJson) {
    jsonOutput({ ok: true, config_path: CONFIG_PATH });
    return;
  }

  success("\nLogged in! Config saved to " + CONFIG_PATH);
}

async function cmdWhoami(
  parsed: ParsedArgs,
  isJson: boolean
): Promise<void> {
  const config = loadConfig();

  if (isJson) {
    jsonOutput({
      config_path: CONFIG_PATH,
      has_api_key: !!config.apiKey,
      username: config.username ?? null,
      base_url: config.baseUrl ?? "https://gatecode.sh",
    });
    return;
  }

  console.log(`\n${c.bold}GateCode Config${c.reset}\n`);
  label("Config file", CONFIG_PATH);
  label(
    "API Key",
    config.apiKey
      ? config.apiKey.slice(0, 8) + "..." + config.apiKey.slice(-4)
      : `${c.dim}(not set)${c.reset}`
  );
  label("Username", config.username ?? `${c.dim}(not set)${c.reset}`);
  label("Base URL", config.baseUrl ?? "https://gatecode.sh");
  console.log();
}

async function cmdKeys(
  parsed: ParsedArgs,
  isJson: boolean
): Promise<void> {
  const apiKey = getApiKey(parsed.flags);
  const client = new GateCode({
    apiKey,
    baseUrl: getBaseUrl(parsed.flags),
    username: getUsername(parsed.flags),
  });

  const keys = await client.listKeys();

  if (isJson) {
    jsonOutput(keys);
    return;
  }

  if (keys.length === 0) {
    info("No API keys found.");
    return;
  }

  console.log(`\n${c.bold}Your API Keys${c.reset}\n`);
  for (const key of keys) {
    console.log(
      `  ${c.bold}${key.name}${c.reset}  ${c.dim}${key.prefix}...${c.reset}`
    );
    label("    ID", String(key.id));
    label("    Created", key.created_at);
    if (key.last_used_at) label("    Last used", key.last_used_at);
    console.log();
  }
}

function showHelp(): void {
  console.log(`
${c.bold}gatecode${c.reset} — CLI for GateCode, the permission gateway for AI agents

${c.bold}USAGE${c.reset}
  gatecode <command> [options]

${c.bold}COMMANDS${c.reset}
  ${c.cyan}request${c.reset} <repo>     Request access to a repository
    --scope <read|write>   Access scope (default: read)
    --reason <text>        Why access is needed
    --wait                 Wait for owner approval

  ${c.cyan}status${c.reset} <id>         Check the status of an access request

  ${c.cyan}login${c.reset}              Save your API key to ~/.gatecode/config.json
  ${c.cyan}whoami${c.reset}             Show current configuration
  ${c.cyan}keys${c.reset}               List your API keys

${c.bold}GLOBAL OPTIONS${c.reset}
  --key <key>            API key (overrides env/config)
  --user <username>      Username (overrides env/config)
  --json                 Output as JSON
  --help                 Show this help message

${c.bold}ENVIRONMENT${c.reset}
  GATECODE_API_KEY       API key
  GATECODE_USERNAME      Username

${c.dim}https://gatecode.sh${c.reset}
`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);
  const isJson = parsed.flags.json === true;

  if (parsed.flags.help === true || parsed.command === "help") {
    showHelp();
    return;
  }

  try {
    switch (parsed.command) {
      case "request":
        await cmdRequest(parsed, isJson);
        break;
      case "status":
        await cmdStatus(parsed, isJson);
        break;
      case "login":
        await cmdLogin(isJson);
        break;
      case "whoami":
        await cmdWhoami(parsed, isJson);
        break;
      case "keys":
        await cmdKeys(parsed, isJson);
        break;
      default:
        error(`Unknown command: ${parsed.command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof GateCodeError) {
      if (isJson) {
        jsonOutput({
          error: err.message,
          statusCode: err.statusCode ?? null,
        });
      } else {
        error(err.message);
        if (err.statusCode === 401) {
          info('Check your API key. Run "gatecode login" to reconfigure.');
        }
      }
      process.exit(1);
    }
    throw err;
  }
}

main();
