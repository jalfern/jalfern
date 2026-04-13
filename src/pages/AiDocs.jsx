import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

// Embedded document content
const CLAUDE_SKILLS_CONTENT = `# The Complete Guide to Building Skills for Claude

## Introduction

A **skill** is a set of instructions - packaged as a simple folder - that teaches Claude how to handle specific tasks or workflows. Skills are one of the most powerful ways to customize Claude for your specific needs.

This guide covers:
* Technical requirements and best practices for skill structure
* Patterns for standalone skills and MCP-enhanced workflows
* How to test, iterate, and distribute your skills

---

## Chapter 1: Fundamentals

### What is a skill?

A skill is a folder containing:
* **SKILL.md** (required): Instructions in Markdown with YAML frontmatter
* **scripts/** (optional): Executable code (Python, Bash, etc.)
* **references/** (optional): Documentation loaded as needed
* **assets/** (optional): Templates, fonts, icons used in output

### Core design principles

**Progressive Disclosure**
Skills use a three-level system:
1. **First level (YAML frontmatter):** Always loaded in Claude's system prompt
2. **Second level (SKILL.md body):** Loaded when Claude thinks the skill is relevant
3. **Third level (Linked files):** Additional files bundled within the skill directory

**Composability**
Claude can load multiple skills simultaneously.

**Portability**
Skills work identically across Claude.ai, Claude Code, and API.

### For MCP Builders: Skills + Connectors

**The kitchen analogy:**
* **MCP provides the professional kitchen:** access to tools, ingredients, and equipment.
* **Skills provide the recipes:** step-by-step instructions on how to create something valuable.

---

## Chapter 2: Planning and design

### Start with use cases

Identify 2-3 concrete use cases your skill should enable.

### Common skill use case categories

**Category 1: Document & Asset Creation**
* Creating consistent, high-quality output (documents, presentations, apps, designs, code)
* Example: frontend-design skill

**Category 2: Workflow Automation**
* Multi-step processes with consistent methodology
* Example: skill-creator skill

**Category 3: MCP Enhancement**
* Workflow guidance to enhance MCP server tool access
* Example: sentry-code-review skill

### Technical requirements

**File structure:**

your-skill-name/
├── SKILL.md       # Required
├── scripts/       # Optional
├── references/    # Optional
└── assets/        # Optional

**Critical rules:**
* **SKILL.md naming**: Must be exactly SKILL.md (case-sensitive)
* **Skill folder naming**: Use kebab-case (e.g., notion-project-setup)
* **No README.md** inside your skill folder

**YAML frontmatter:**

---
name: your-skill-name
description: What it does. Use when user asks to [specific phrases].
---

**Description field requirements:**
* MUST include BOTH: What the skill does AND When to use it
* Under 1024 characters
* No XML tags (< or >)
* Include specific tasks users might say

---

## Chapter 3: Testing and iteration

### Testing approaches

* **Manual testing in Claude.ai**: Fast iteration, no setup
* **Scripted testing in Claude Code**: Automated test cases
* **Programmatic testing via skills API**: Systematic evaluation

### Common signals

**Undertriggering:**
* Skill doesn't load when it should
* **Solution**: Add more detail and nuance to description

**Overtriggering:**
* Skill loads for irrelevant queries
* **Solution**: Add negative triggers, be more specific

---

## Chapter 4: Distribution and sharing

**Current distribution model:**
1. Download the skill folder
2. Zip if needed
3. Upload to Claude.ai via Settings > Capabilities > Skills
4. Or place in Claude Code skills directory (~/.claude/skills/)

**Recommended approach:**
* Host on GitHub with public repo and README
* Document in your MCP repo with installation guide
* Link from your MCP documentation

---

## Chapter 5: Patterns and troubleshooting

### Common patterns

**Pattern 1: The "Onboarding" skill**
* Step-by-step checklist with validation

**Pattern 2: The "Quality Gate" skill**
* Create > Review > Fix > Finalize loop

**Pattern 3: The "MCP Orchestrator" skill**
* Plan > Execute parallel calls > Aggregate results > Format output

### Troubleshooting

**Issue: Skill doesn't trigger**
* **Cause**: Description missing trigger phrases
* **Fix**: Add specific user phrases to description

**Issue: Inconsistent results**
* **Cause**: Instructions too vague
* **Fix**: Add more specific steps and error handling

---

## Chapter 6: Resources and references

### Official resources
* Anthropic Skills Documentation: https://docs.anthropic.com/skills
* MCP Specification: https://modelcontextprotocol.io
* Claude API Reference: https://docs.anthropic.com/api

### Community examples
* Search claude-skills on GitHub
* Join the Anthropic Discord #skills channel

*This guide was extracted from Anthropic's official documentation on building Skills for Claude.*`;

const DOCUMENTS = [
  {
    id: "claude-skills-guide",
    title: "The Complete Guide to Building Skills for Claude",
    description: "Official Anthropic guide covering fundamentals, planning, testing, and distribution of AI skills.",
    added: "2026-04-13T19:30:00Z",
    tags: ["claude", "skills", "ai", "mcp"],
    content: CLAUDE_SKILLS_CONTENT
  }
];

const AiDocs = () => {
  const { docId } = useParams();
  const [currentDoc, setCurrentDoc] = useState(null);

  React.useEffect(() => {
    if (docId) {
      const selected = DOCUMENTS.find(d => d.id === docId);
      setCurrentDoc(selected || null);
    } else {
      setCurrentDoc(null);
    }
  }, [docId]);

  if (docId && currentDoc) {
    return (
      <div className="min-h-screen bg-black text-white font-mono">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Link to="/ai-docs" className="text-blue-400 hover:text-blue-300 text-sm">
              ← Back to all documents
            </Link>
          </div>
          
          <article className="text-sm leading-relaxed">
            <h1 className="text-3xl font-bold mb-2">{currentDoc.title}</h1>
            {currentDoc.description && (
              <p className="text-gray-400 mb-6">{currentDoc.description}</p>
            )}
            <div className="text-xs text-gray-500 mb-8">
              Added: {new Date(currentDoc.added).toLocaleDateString()}
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-200 bg-zinc-900/50 p-6 rounded-sm border border-zinc-800">
              {currentDoc.content}
            </pre>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold tracking-tighter">AI Document Repository</h1>
          <p className="text-gray-400 mt-2">Curated guides and resources for AI development</p>
        </header>

        {DOCUMENTS.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-sm">
            <p className="text-gray-400">No documents yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {DOCUMENTS.map(doc => (
              <Link
                key={doc.id}
                to={`/ai-docs/${doc.id}`}
                className="block bg-zinc-900/50 border border-zinc-800 p-6 rounded-sm hover:border-zinc-600 transition-colors"
              >
                <h2 className="text-xl font-bold mb-2">{doc.title}</h2>
                {doc.description && (
                  <p className="text-gray-400 text-sm mb-3">{doc.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Added: {new Date(doc.added).toLocaleDateString()}</span>
                  {doc.tags && doc.tags.length > 0 && (
                    <span className="flex gap-2">
                      {doc.tags.map(tag => (
                        <span key={tag} className="text-blue-400">#{tag}</span>
                      ))}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiDocs;
