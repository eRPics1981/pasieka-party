#!/usr/bin/env node
/**
 * MCP Server: Codex Bridge
 * Udostępnia funkcje komunikacji z Codex dla Claude Code
 */

import http from 'node:http';
import readline from 'node:readline';

const A2A_HOST = '127.0.0.1';
const A2A_PORT = 41241;
const FROM_AGENT = 'claude';
const TO_AGENT = 'codex';

async function sendMessage(to, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ from: FROM_AGENT, to, text });
    const options = {
      hostname: A2A_HOST, port: A2A_PORT, path: '/messages',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body.trim() ? JSON.parse(body) : {};
          resolve({ success: true, status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getInbox(agent) {
  return new Promise((resolve, reject) => {
    http.get(`http://${A2A_HOST}:${A2A_PORT}/inbox/${agent}?limit=50`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body.trim() ? JSON.parse(body) : [];
          resolve(parsed);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

// MCP Protocol Handler
function processMCPRequest(request) {
  const { jsonrpc, id, method, params } = request;

  if (method === 'initialize') {
    return {
      jsonrpc,
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {}
        },
        serverInfo: {
          name: 'codex-bridge',
          version: '1.0.0'
        }
      }
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc,
      id,
      result: {
        tools: [
          {
            name: 'ask_codex',
            description: 'Wyślij pytanie do Codex i uzyskaj odpowiedź',
            inputSchema: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'Pytanie do Codex'
                }
              },
              required: ['question']
            }
          },
          {
            name: 'get_inbox',
            description: 'Pobierz wiadomości z inbox',
            inputSchema: {
              type: 'object',
              properties: {
                agent: {
                  type: 'string',
                  description: 'Agent: claude, codex, all (default: claude)'
                }
              }
            }
          },
          {
            name: 'get_tasks',
            description: 'Pobierz zadania od Codex',
            inputSchema: {
              type: 'object'
            }
          }
        ]
      }
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;

    if (name === 'ask_codex') {
      return sendMessage(TO_AGENT, args.question).then(result => ({
        jsonrpc,
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      })).catch(e => ({
        jsonrpc,
        id,
        error: { code: -32603, message: e.message }
      }));
    }

    if (name === 'get_inbox') {
      const agent = args?.agent || 'claude';
      return getInbox(agent).then(items => ({
        jsonrpc,
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(items, null, 2)
            }
          ]
        }
      })).catch(e => ({
        jsonrpc,
        id,
        error: { code: -32603, message: e.message }
      }));
    }

    if (name === 'get_tasks') {
      return getInbox('claude').then(items => {
        const tasks = items.filter(i => i.kind === 'task');
        return {
          jsonrpc,
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(tasks, null, 2)
              }
            ]
          }
        };
      }).catch(e => ({
        jsonrpc,
        id,
        error: { code: -32603, message: e.message }
      }));
    }
  }

  return {
    jsonrpc,
    id,
    error: { code: -32601, message: 'Method not found' }
  };
}

// Read line by line from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    const response = await processMCPRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    console.error(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' }
    }));
  }
});

// Info
console.error('🌉 Codex Bridge MCP Server started');
console.error(`   A2A: http://${A2A_HOST}:${A2A_PORT}`);
