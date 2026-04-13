# The Complete Guide to Building Skills for Claude

## Contents
- Introduction
- Fundamentals
- Planning and design
- Testing and iteration
- Distribution and sharing
- Patterns and troubleshooting
- Resources and references

---

## Introduction

A **skill** is a set of instructions - packaged as a simple folder - that teaches Claude how to handle specific tasks or workflows. Skills are one of the most powerful ways to customize Claude for your specific needs. Instead of re-explaining your preferences, processes, and domain expertise in every conversation, skills let you teach Claude once and benefit every time.

Skills are powerful when you have repeatable workflows: generating frontend designs from specs, conducting research with consistent methodology, creating documents that follow your team's style guide, or orchestrating multi-step processes. They work well with Claude's built-in capabilities like code execution and document creation. For those building MCP integrations, skills add another powerful layer helping turn raw tool access into reliable, optimized workflows.

This guide covers everything you need to know to build effective skills - from planning and structure to testing and distribution. Whether you're building a skill for yourself, your team, or for the community, you'll find practical patterns and real-world examples throughout.

**What you'll learn:**
* Technical requirements and best practices for skill structure
* Patterns for standalone skills and MCP-enhanced workflows
* Patterns we've seen work well across different use cases
* How to test, iterate, and distribute your skills

**Who this is for:**
* Developers who want Claude to follow specific workflows consistently
* Power users who want Claude to follow specific workflows
* Teams looking to standardize how Claude works across their organization

**Two Paths Through This Guide**
* **Building standalone skills?** Focus on Fundamentals, Planning and Design, and category 1-2.
* **Enhancing an MCP integration?** The "Skills + MCP" section and category 3 are for you.

Both paths share the same technical requirements, but you choose what's relevant to your use case.

**What you'll get out of this guide:**
By the end, you'll be able to build a functional skill in a single sitting. Expect about 15-30 minutes to build and test your first working skill using the skill-creator.

Let's get started.

---

## Chapter 1: Fundamentals

### What is a skill?
A skill is a folder containing:
* **`SKILL.md`** (required): Instructions in Markdown with YAML frontmatter
* **`scripts/`** (optional): Executable code (Python, Bash, etc.)
* **`references/`** (optional): Documentation loaded as needed
* **`assets/`** (optional): Templates, fonts, icons used in output

### Core design principles

**Progressive Disclosure**
Skills use a three-level system:
1. **First level (YAML frontmatter):** Always loaded in Claude's system prompt. Provides just enough information for Claude to know when each skill should be used without loading all of it into context.
2. **Second level (`SKILL.md` body):** Loaded when Claude thinks the skill is relevant to the current task. Contains the full instructions and guidance.
3. **Third level (Linked files):** Additional files bundled within the skill directory that Claude can choose to navigate and discover only as needed. This progressive disclosure minimizes token usage while maintaining specialized expertise.

**Composability**
Claude can load multiple skills simultaneously. Your skill should work well alongside others, not assume it's the only capability available.

**Portability**
Skills work identically across Claude.ai, Claude Code, and API. Create a skill once and it works across all surfaces without modification, provided the environment supports any dependencies the skill requires.

### For MCP Builders: Skills + Connectors

> 💡 **Building standalone skills without MCP?** Skip to Planning and Design - you can always return here later.

If you already have a working MCP server, you've done the hard part. Skills are the knowledge layer on top - capturing the workflows and best practices you already know, so Claude can apply them consistently.

**The kitchen analogy**
* **MCP provides the professional kitchen:** access to tools, ingredients, and equipment.
* **Skills provide the recipes:** step-by-step instructions on how to create something valuable.

Together, they enable users to accomplish complex tasks without needing to figure out every step themselves.

**How they work together:**

| MCP (Connectivity) | Skills (Knowledge) |
| :--- | :--- |
| Connects Claude to your service (Notion, Asana, Linear, etc.) | Teaches Claude how to use your service effectively |
| Provides real-time data access and tool invocation | Capturing workflows and best practices |

**What Claude can do**
* **Without skills:**
    * Users connect your MCP but don't know what to do next
    * Support tickets asking "how do I do X with your integration"
    * Each conversation starts from scratch
    * Inconsistent results because users prompt differently each time
    * Users blame your connector when the real issue is workflow guidance
* **With skills:**
    * Pre-built workflows activate automatically when needed
    * Consistent, reliable tool usage
    * Best practices embedded in every interaction
    * Lower learning curve for your integration

---

## Chapter 2: Planning and design

### Start with use cases
Before writing any code, identify 2-3 concrete use cases your skill should enable.

**Good use case definition:**
* **Use Case:** Project Sprint Planning
* **Trigger:** User says "help me plan this sprint" or "create sprint tasks"
* **Steps:**
    1. Fetch current project status from Linear (via MCP)
    2. Analyze team velocity and capacity
    3. Suggest task prioritization
    4. Create tasks in Linear with proper labels and estimates
* **Result:** Fully planned sprint with tasks created

**Ask yourself:**
* What does a user want to accomplish?
* What multi-step workflows does this require?
* Which tools are needed (built-in or MCP?)
* What domain knowledge or best practices should be embedded?

### Common skill use case categories
At Anthropic, we've observed three common use cases:

**Category 1: Document & Asset Creation**
* **Used for:** Creating consistent, high-quality output including documents, presentations, apps, designs, code, etc.
* **Real example:** `frontend-design` skill
* **Key techniques:**
    * Embedded style guides and brand standards
    * Template structures for consistent output
    * Quality checklists before finalizing
    * No external tools required - uses Claude's built-in capabilities

**Category 2: Workflow Automation**
* **Used for:** Multi-step processes that benefit from consistent methodology, including coordination across multiple MCP servers.
* **Real example:** `skill-creator` skill
* **Key techniques:**
    * Step-by-step workflow with validation gates
    * Templates for common structures
    * Built-in review and improvement suggestions
    * Iterative refinement loops

**Category 3: MCP Enhancement**
* **Used for:** Workflow guidance to enhance the tool access an MCP server provides.
* **Real example:** `sentry-code-review` skill (from Sentry)
* **Key techniques:**
    * Coordinates multiple MCP calls in sequence
    * Embeds domain expertise
    * Provides context users would otherwise need to specify
    * Error handling for common MCP issues

### Define success criteria
How will you know your skill is working? Aim for rigor but accept that there will be an element of vibes-based assessment.

**Quantitative metrics:**
* **Skill triggers on 90% of relevant queries**
    * *How to measure:* Run 10-20 test queries that should trigger your skill. Track how many times it loads automatically vs. requires explicit invocation.
* **Completes workflow in X tool calls**
    * *How to measure:* Compare the same task with and without the skill enabled. Count tool calls and total tokens consumed.
* **0 failed API calls per workflow**
    * *How to measure:* Monitor MCP server logs during test runs. Track retry rates and error codes.

**Qualitative metrics:**
* **Users don't need to prompt Claude about next steps**
    * *How to assess:* During testing, note how often you need to redirect or clarify. Ask beta users for feedback.
* **Workflows complete without user correction**
    * *How to assess:* Run the same request 3-5 times. Compare outputs for structural consistency and quality.
* **Consistent results across sessions**
    * *How to assess:* Can a new user accomplish the task on first try with minimal guidance?

### Technical requirements

**File structure**
```text
your-skill-name/
├── SKILL.md       # Required - main skill file
├── scripts/       # Optional - executable code
│   ├── process_data.py  # Example
│   └── validate.sh      # Example
├── references/    # Optional - documentation
│   ├── api-guide.md     # Example
│   └── examples/        # Example
└── assets/        # Optional - templates, etc.
    └── report-template.md  # Example
```

**Critical rules**
* **`SKILL.md` naming:**
    * Must be exactly `SKILL.md` (case-sensitive)
    * No variations accepted (`SKILL.MD`, `skill.md`, etc.)
* **Skill folder naming:**
    * Use kebab-case: `notion-project-setup` ✅
    * No spaces: `Notion Project Setup` ❌
    * No underscores: `notion_project_setup` ❌
    * No capitals: `NotionProjectSetup` ❌
* **No `README.md`:**
    * Don't include `README.md` inside your skill folder.
    * All documentation goes in `SKILL.md` or `references/`.
    * *Note:* When distributing via GitHub, you'll still want a repo-level README for human users.

**YAML frontmatter: The most important part**
The YAML frontmatter is how Claude decides whether to load your skill. Get this right.

**Minimal required format:**
```yaml
---
name: your-skill-name
description: What it does. Use when user asks to [specific phrases].
---
```

**Field requirements:**
* **`name` (required):**
    * kebab-case only
    * No spaces or capitals
    * Should match folder name
* **`description` (required):**
    * MUST include BOTH: What the skill does AND When to use it (trigger conditions)
    * Under 1024 characters
    * No XML tags (`<` or `>`)
    * Include specific tasks users might say
    * Mention file types if relevant
* **`license` (optional):**
    * Use if making skill open source (e.g., MIT, Apache-2.0)
* **`compatibility` (optional):**
    * 1-500 characters. Indicates environment requirements (e.g., intended product, required system packages, etc.)
* **`metadata` (optional):**
    * Any custom key-annotated pairs (e.g., author, version, mcp-server)

**Security restrictions**
**Forbidden in frontmatter:**
* XML angle brackets (`<` `>`)
* Skills with "claude" or "anthropic" in name (reserved)

**Writing effective skills**

**The description field**
According to Anthropic's engineering blog: *"This metadata...provides just enough information for Claude to know when each skill should be used without loading all of it into context."*

**Structure:** `[What it does] + [When to use it] + [Key capabilities]`

**Examples of good descriptions:**
* **Specific and actionable:** `Analyzes Figma design files and generates developer handoff documentation. Use when user uploads .fig files, asks for "design specs", "component documentation", or "design-to-code handoff".`
* **Includes trigger phrases:** `Manages Linear project workflows including sprint planning, task creation, and status tracking. Use when user mentions "sprint", "Linear tasks", "project planning", or asks to "create tickets".`
* **Clear value proposition:** `End-to-end customer onboarding workflow for PayFlow. Handles account creation, payment setup, and subscription management. Use when user says "onboard new customer", "set up subscription", or "create PayFlow account".`

**Examples of bad descriptions:**
* **Too vague:** `Helps with projects.`
* **Missing triggers:** `Creates sophisticated multi-page documentation systems.`
* **Too technical, no user triggers:** `Implements the Project entity model with hierarchical relationships.`

**Writing the main instructions**
After the frontmatter, write the actual instructions in Markdown. Use this template:

```markdown
---
name: your-skill
description: [ -- .]
---

# Your Skill Name

## Instructions

### Step 1: [First Major Step]
Clear explanation of what happens.
Example:
```bash
python scripts/fetch_data.py --project-id PROJECT_ID
```
Expected output: [describe what success looks like]

(Add more steps as needed)

## Examples
**Example 1: [common scenario]**
**User says:** "Set up a new marketing campaign"
**Actions:**
1. Fetch existing campaigns via MCP
2. Create new campaign with provided parameters
**Result:** Campaign created with confirmation link

(Add more examples as needed)

## Troubleshooting
**Error:** [Common error message]
**Cause:** [Why it happens]
**Solution:** [How to fix]
(Add more error cases as needed)
```

**Best Practices for Instructions**
* **Be Specific and Actionable ✅**
    * **Good:** `Run python scripts/validate.py --input {filename} to check data format. If validation fails, common issues include: - Missing required fields (add them to the CSV) - Invalid date formats (use YYYY-MM-DD)`
    * **❌ Bad:** `Validate the data before proceeding. Include error handling`
* **Include error handling**
    * `# Common Issues`
    * `--`
    * `# MCP Connection Failed`
    * `If you see "Connection refused":`
    * `1. Verify MCP server is running: Check Settings > Extensions`
    * `2. Confirm API key is ...`
* **Reference bundled resources clearly**
    * Before writing any queries, consult `references/api-patterns.md` for rate limiting, pagination, etc.
* **Use progressive disclosure**
    * Keep `SKILL.md` focused on core instructions. Move detailed documentation to `references/`.

---

## Chapter 3: Testing and iteration

Skills can be tested at varying levels of rigor:
* **Manual testing in Claude.ai:** Run queries directly and observe behavior. Fast iteration, no setup required.
* **Scripted testing in Claude Code:** Automate test cases for repeatable validation across changes.
* **Programmatic testing via skills API:** Build evaluation suites that run systematically against defined test sets.

Choose the approach that matches your quality requirements and the visibility of your skill. A skill used internally by a small team has different testing needs than one deployed to thousands of enterprise users.

**Pro Tip: Iterate on a single task before expanding**
We've found that the most effective skill creators iterate on a single challenging task until Claude succeeds, then extract the winning approach into a skill. This leverages Claude's in-context learning and provides faster signal than broad testing. Once you have a working foundation, expand to multiple test cases for coverage.

**Recommended Testing Approach**
Based on early experience, effective skills testing typically covers three areas:

**1. Triggering tests**
Goal: Ensure your skill loads at the right times.
Test cases:
* ✅ Triggers on obvious tasks
* ✅ Triggers on paraphrased requests
* ❌ Doesn't trigger on unrelated topics

Example test suite:
* **Should trigger:**
    * "Help me set up a new ProjectHub workspace"
    * "I need to create a project in ProjectHub"
    * "Initialize a ProjectHub project for Q4 planning"
* **Should NOT trigger:**
    * "What's the weather in San Francisco?"
    * "Help me write Python code"
    * "Create a spreadsheet" (unless ProjectHub skill handles sheets)

**2. Functional tests**
Goal: Verify the skill produces correct outputs.
Test cases:
* ✅ Valid outputs generated
* ✅ API calls succeed
* ✅ Error handling works
* ✅ Edge cases covered

Example:
* **Test:** Create project with 5 tasks
* **Given:** Project name "Q4 Planning", 5 task descriptions
* **When:** Skill executes workflow
* **Then:**
    * Project created in Project Hub
    * 5 tasks created with correct properties
    * All tasks linked to project
    * No API errors

**3. Performance comparison**
Goal: Prove the skill improves results vs. baseline. Use the metrics from "Define Success Criteria".

Here's what a comparison might look like:
| Feature | Without skill | With skill |
| :--- | :--- | :--- |
| **User Effort** | User provides instructions each time | Automatic workflow execution |
| **Interaction** | 15 back-and-forth messages | 2 clarifying questions only |
| **Reliability** | 3 failed API calls requiring retry | 0 failed API calls |
| **Efficiency** | 12,000 tokens consumed | 6,000 tokens consumed |

**Using the skill-creator skill**
The `skill-creator` skill — available in Claude.ai via plugin directory or download for Claude Code — can help you build and iterate on skills. If you have an MCP server and know your top 2–3 workflows, you can build and test a functional skill in a single sitting — often in 15–30 minutes.

Creating skills:
* Generate skills from natural language descriptions
* Produce properly formatted `SKILL.md` with frontmatter
* Suggest trigger phrases and structure

Reviewing skills:
* Flag common issues (vague descriptions, missing triggers, structural problems)
* Identify potential over/under-triggering risks
* Suggest test cases based on the skill's stated purpose

Iterative improvement:
* After using your skill and encountering edge cases or failures, bring those examples back to `skill-creator`.
* Example: "Use the issues & solution identified in this chat to improve how the skill handles [specific edge case]"

**Note:** `skill-creator` helps you design and refine skills but does not execute automated test suites or produce quantitative evaluation results.

**Iteration based on feedback**
Skills are living documents. Plan to iterate based on:

**Undertriggering signals:**
* Skill doesn't load when it should
* Users manually enabling it
* Support questions about when to use it
* **Solution:** Add more detail and nuance to the description - this may include keywords particularly for technical terms

**Overtriggering signals:**
* Skill loads for irrelevant queries
* Users disabling it
* Confusion about purpose
* **Solution:** Add negative triggers, be more specific

**Execution issues:**
* Inconsistent results
* API call failures
* User corrections needed
* **Solution:** Improve instructions, add error handling

---

## Chapter 4: Distribution and sharing

Skills make your MCP integration more complete. As users compare connectors, those with skills offer a faster path to value, giving you an edge over MCP-only alternatives.

**Current distribution model (January 2026)**
How individual users get skills:
1. Download the skill folder
2. Zip the folder (if needed)
3. Upload to Claude.ai via `Settings > Capabilities > Skills`
4. Or place in Claude Code skills directory

Organization-level skills:
* Admins can deploy skills workspace-wide (shipped December 18, 2025)
* Automatic updates
* Centralized management

**An open standard**
We've published Agent Skills as an open standard. Like MCP, we believe skills should be portable across tools and platforms - the same skill should work whether you're using Claude or other AI platforms. That said, some skills are designed to take full advantage of a specific platform's capabilities; authors can note this in the skill's `compatibility` field. We've been collaborating with members of the ecosystem on the standard, and we're excited by early adoption.

**Using skills via API**
For programmatic use cases — such as building applications, agents, or automated workflows that leverage skills — the API provides direct control over skill management and execution.

Key capabilities:
* `/v1/skills` endpoint for listing and managing skills
* Add skills to Messages API requests via the `container.skills` parameter
* Version control and management through the Claude Console
* Works with the Claude Agent SDK for building custom agents

**When to use skills via the API vs. Claude.ai:**

| Use Case | Best Surface |
| :--- | :--- |
| End users interacting with skills directly | Claude.ai / Claude Code |
| Manual testing and iteration during development | Claude.ai / Claude Code |
| Individual, ad-hoc workflows | Claude.ai / Claude Code |
| Applications using skills programmatically | API |
| Production deployments at scale | API |
| Automated pipelines and agent systems | API |

**Note:** Skills in the API require the Code Execution Tool beta, which provides the secure environment skills need to run. For implementation details, see:
* Skills API Quickstart
* Create Custom skills
* Skills in the Agent SDK

**Recommended approach today**
Start by hosting your skill on GitHub with a public repo, clear `README` (for human visitors — this is separate from your skill folder, which should not contain a `README.md`), and example usage with screenshots. Then add a section to your MCP documentation that links to the skill, explains why using both together is valuable, and provides a quick-start guide.

1. **Host on GitHub**
   * Public repo for open-source skills
   * Clear `README` with installation instructions
   * Example usage and screenshots
2. **Document in Your MCP Repo**
   * Link to skills from MCP documentation
   * Explain the value of using both together
   * Provide quick-start guide
3. **Create an Installation Guide**
   * **# Installing the [Your Service] skill**
   * **1. Download** the skill folder
   * **2. Zip** the folder (if needed)
   * **3. Upload** to Claude.ai via Settings > Capabilities > Skills
   * **4. Or** place in Claude Code skills directory (~/.claude/skills/)

---

## Chapter 5: Patterns and troubleshooting

### Common patterns

**Pattern 1: The "Onboarding" skill**
* **Use case:** First-time users need guidance
* **Structure:** Step-by-step checklist with validation
* **Example:** `stripe-onboarding` walks through account setup, webhook configuration, and test transactions

**Pattern 2: The "Quality Gate" skill**
* **Use case:** Ensure consistency before final output
* **Structure:** Create → Review → Fix → Finalize loop
* **Example:** `docs-quality-check` validates style, links, and formatting before publishing

**Pattern 3: The "MCP Orchestrator" skill**
* **Use case:** Coordinate multiple tools in sequence
* **Structure:** Plan → Execute parallel calls → Aggregate results → Format output
* **Example:** `github-code-review` fetches PR, analyzes diff, comments inline

### Common troubleshooting

**Issue: Skill doesn't trigger**
* **Cause:** Description missing trigger phrases
* **Fix:** Add specific user phrases to the description field

**Issue: Skill triggers too often**
* **Cause:** Description too broad
* **Fix:** Add negative triggers, be more specific about use cases

**Issue: Inconsistent results**
* **Cause:** Instructions too vague or missing edge cases
* **Fix:** Add more specific steps, error handling, and examples

**Issue: API calls failing**
* **Cause:** Missing error handling or incorrect tool usage
* **Fix:** Add retry logic, validate inputs, check MCP connection

---

## Chapter 6: Resources and references

### Official resources
* [Anthropic Skills Documentation](https://docs.anthropic.com/skills)
* [MCP Specification](https://modelcontextprotocol.io)
* [Claude API Reference](https://docs.anthropic.com/api)

### Community examples
* Search `claude-skills` on GitHub
* Join the Anthropic Discord #skills channel
* Check the Plugin Directory in Claude.ai

### Tools and utilities
* **skill-creator:** AI assistant for building skills
* **skill-validator:** CLI tool to validate skill structure
* **skill-tester:** Automated testing framework (beta)

---

*This guide was extracted from Anthropic's official documentation on building Skills for Claude.*
