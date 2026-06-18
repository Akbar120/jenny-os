# AGENTS.md

# JENNY OS

Universal Architecture & Development Rules

Version: 1.0

---

## Mission

Jenny OS is a modular AI automation platform.

The purpose of Jenny OS is to solve business problems using autonomous and semi-autonomous agents.

Agents may be added, removed, upgraded, or replaced without requiring major architectural changes.

The system must remain modular, scalable, explainable, and maintainable.

---

# Core Principles

1. Build small.
2. Build modular.
3. Build reusable.
4. Build explainable.
5. Build reliable.
6. Build for future agents.

Never create speculative features.

Never over-engineer.

Every component must have a clear business purpose.

---

# Architecture Philosophy

Jenny OS consists of:

1. UI Layer
2. Agent Layer
3. Orchestration Layer
4. Service Layer
5. Memory Layer
6. Data Layer
7. Integration Layer

Agents should never bypass architecture rules.

---

# Agent Rules

Every agent is a self-contained module.

Required structure:

agent/
config/
prompts/
schemas/
services/
tests/

Every agent must expose:

* Input Schema
* Output Schema
* Status
* Logs

Agents communicate only through structured outputs.

Never through free-form text.

---

# Agent Communication

Allowed:

JSON

Example:

{
"status": "qualified",
"lead_score": 9
}

Not Allowed:

"Looks like a good lead maybe contact them."

All agent-to-agent communication must be structured.

---

# Single Responsibility Rule

One agent = One responsibility.

Good:

Lead Hunter
Scheduler
Outreach
Research

Bad:

Mega Agent that does everything.

Avoid agent bloat.

---

# Orchestrator Rules

The orchestrator coordinates agents.

The orchestrator does not perform business tasks.

Responsibilities:

* Route tasks
* Manage state
* Handle retries
* Track progress
* Monitor failures

---

# Human Approval Rule

Agents may recommend actions.

Agents must not perform irreversible actions without approval.

Examples:

Allowed:

* Draft message
* Analyze lead
* Create summary

Approval Required:

* Send email
* Contact client
* Delete records
* Spend money

---

# Reliability Rules

Every workflow must support:

* Logging
* Retry logic
* Failure recovery

No silent failures.

All failures must be traceable.

---

# Logging Rules

Every important action creates logs.

Example:

Lead Found

Lead Scored

Meeting Scheduled

API Failed

Agent Restarted

Logs must include timestamps.

---

# State Management

All entities must have state.

Examples:

Lead:
NEW
QUALIFIED
CONTACTED
MEETING_BOOKED
CLOSED

Task:
PENDING
RUNNING
FAILED
COMPLETED

Agents must never operate on unknown state.

---

# Memory Rules

Long-term memory must be stored.

Do not rely on LLM memory.

Store:

Clients

Leads

Tasks

Meetings

Conversations

Preferences

---

# Database Rules

Agents never access database directly.

All database operations go through services.

Benefits:

* Easier maintenance
* Better security
* Easier future migration

---

# API Rules

All external systems are integrations.

Examples:

Discord

LinkedIn

Twitter/X

Instagram

Email

Google Calendar

CRM Systems

Never hardcode integrations.

Use adapters.

---

# Configuration Rules

Behavior should be configurable.

Avoid hardcoded logic.

Bad:

if platform == "UEFN"

Good:

platforms:

* UEFN
* Roblox
* Indie Games

---

# UI Rules

The UI is Jenny OS.

The UI must support:

Dashboard

Agents

Tasks

Leads

Memory

Logs

Orchestrator

Settings

Future agents must fit inside existing UI architecture.

Do not redesign UI unless necessary.

---

# Security Rules

Never expose:

API keys

Secrets

Tokens

Passwords

Store secrets securely.

Never log secrets.

---

# Cost Rules

Track:

Model Costs

API Costs

Infrastructure Costs

Token Usage

Systems should justify their operating cost.

---

# Scalability Rules

Assume future growth.

Design for:

1 User
10 Users
100 Users
1000 Users

Do not optimize prematurely.

But avoid architecture that blocks scaling.

---

# Development Rules

Before creating new files:

1. Check existing files.
2. Reuse existing modules.
3. Avoid duplication.
4. Follow project structure.

Do not create random folders.

Do not create backup folders.

Do not create duplicate services.

---

# AI Rules

AI is a tool.

AI is not the source of truth.

Validate:

JSON

Schema

Outputs

Decisions

Never trust model output blindly.

---

# Future Vision

Jenny OS will evolve into a business automation operating system.

Possible future agents:

Lead Hunter

Research Agent

Outreach Agent

Scheduler Agent

CRM Agent

Monitoring Agent

Sales Agent

Customer Support Agent

Analytics Agent

Future agents must follow this document.

This file is the source of architectural truth.
