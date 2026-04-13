# CLAUDE.md Best Practices - From Basic to Adaptive

**Source:** https://dev.to/cleverhoods/claudemd-best-practices-from-basic-to-adaptive-9lm  
**Added:** 2026-04-13  
**Tags:** claude, capability-levels, best-practices, agentic-workflows

## Overview

This article introduces a framework for measuring the sophistication of AI instruction files (CLAUDE.md, AGENTS.md, etc.) across six capability levels, from L0 (Absent) to L6 (Adaptive). The framework helps teams systematically improve how they guide AI agents in their projects.

## The Six Capability Levels

### L0: Absent
No instruction file. Claude works from training data and code inference alone. Fine for quick scripts, but missing value for maintained projects.

### L1: Basic
A CLAUDE.md file exists and is tracked in git. Content might be auto-generated boilerplate or a few notes. The key is acknowledgment that context matters.

**What changes:** Claude has something project-specific.  
**What's missing:** Actual rules and constraints.

### L2: Scoped
Explicit constraints using MUST/MUST NOT language (RFC 2119 style):

```markdown
## Project
E-commerce API, Node.js, PostgreSQL.

## Constraints
- MUST use TypeScript strict mode
- MUST NOT use `any` type
- MUST run tests before committing
- NEVER modify migration files directly
```

**What changes:** Claude follows your rules, not generic best practices.  
**What's missing:** Scale. Long files lose important details in the noise.

### L3: Structured
External references and modular content:

```markdown
# CLAUDE.md

See @docs/architecture.md for system overview.
See @docs/api-conventions.md for API patterns.

## Constraints
...
```

**What changes:** Separation of concerns. Easier maintenance and team collaboration.  
**What's missing:** All files load regardless of context, wasting tokens.

### L4: Abstracted
Path-scoped loading where different rules apply to different codebase regions:

```
your-project/
├── CLAUDE.md
└── .claude/
    └── rules/
        ├── api-rules.md      # paths: src/api/**
        ├── frontend-rules.md # paths: src/components/**
        └── test-rules.md     # paths: tests/**
```

**What changes:** Claude adapts to what you're working on. Context efficiency improves dramatically.  
**What's missing:** Maintenance discipline. Structures rot over time.

### L5: Maintained
L4 with habits to keep structure current:
- Backbone file mapping the codebase, updated on changes
- Tracking system for stale rules
- Regular reviews

**What changes:** Reliability over time. Setup doesn't quietly rot.  
**What's missing:** Dynamic capabilities.

### L6: Adaptive
Skills that load based on task + MCP servers for external integrations:

```
your-project/
├── CLAUDE.md
├── .claude/
│   ├── rules/
│   └── skills/
│       ├── database-migrations/
│       │   └── SKILL.md
│       └── api-testing/
│           └── SKILL.md
└── mcp.json
```

**What changes:** Claude extends its abilities based on detected tasks.  
**Note:** Very few setups are here yet; patterns still emerging.

## Quick Self-Check

| Question | If yes... |
|----------|-----------|
| Do you have any instruction file? | At least L1 |
| Does it have explicit constraints (MUST/MUST NOT)? | At least L2 |
| Do you use @imports or multiple files? | At least L3 |
| Do different paths load different rules? | At least L4 |
| Do you actively maintain the structure? | At least L5 |
| Do you use skills or MCP? | L6 |

**Observation:** Most setups are L1 or L2. Some reach L3. L4+ is rare—not because it's hard, but because patterns aren't widely known yet.

## Why Bother with Levels?

It's not about chasing a high score. It's about having words for things:

> "I'm at L2 (Scoped) and wondering if L4 (abstracted) is worth the effort" is a conversation you can actually have. "My CLAUDE.md is pretty good" isn't.

The right level depends on your project. A weekend hack doesn't need path scoping. A complex system with multiple domains probably does.

## Author's Project

The author is building a validator at [github.com/reporails/cli](https://github.com/reporails/cli) that detects your level, checks structure, and scores your setup.

## Links

- [Capability levels docs](https://github.com/reporails/rules/blob/main/docs/ccapability-levels.md)
- [Rules repo](https://github.com/reporails/rules)
