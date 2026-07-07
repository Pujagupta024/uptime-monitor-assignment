# AI Collaboration Log

## Overview

This document captures how AI was used as an engineering collaborator throughout the development of the **Uptime Monitor MVP**. Rather than generating isolated code snippets, the AI acted as an autonomous pair programmer that accelerated implementation, suggested architectural decisions, generated boilerplate, and assisted in debugging and testing.

The final implementation was not accepted blindly—every generated component was reviewed, validated, refined, and integrated to ensure correctness and maintainability.

---

# Prompt 1 — Initial System Generation

The project was initiated using the following prompt:

> **Role:** You are an expert Full-Stack Developer and DevOps Engineer specializing in high-velocity, early-stage MVP development.
>
> **Task:** Build a lightweight, full-stack Uptime Monitor application. We value pragmatism, clean code, and execution velocity over over-engineered architectures. Generate the complete, working codebase for this system in one shot, ensuring all components are connected and functional.
>
> **Requirements (Summary):**
> - FastAPI + SQLite backend
> - React + Vite frontend
> - Docker & Docker Compose
> - Background worker running every 60 seconds
> - URL registration API
> - Health monitoring
> - SQLite persistence
> - Production-ready project structure
> - README and AI collaboration documentation

This prompt established the initial architecture, generated the backend and frontend scaffolding, Docker configuration, REST APIs, asynchronous monitoring worker, and the overall repository structure.

---

# 1. AI Technology Stack

Development was carried out with the assistance of an advanced coding AI powered by **Google Gemini**, configured for autonomous software engineering workflows.

The AI served as an engineering assistant capable of:

- Designing project architecture
- Generating production-quality FastAPI and React code
- Creating Docker configurations
- Writing database schemas
- Implementing asynchronous background workers
- Assisting with debugging and refactoring
- Producing documentation and testing artifacts

Rather than replacing engineering judgment, AI significantly accelerated implementation while manual validation ensured correctness and code quality.

---

# 2. Major AI Contributions

The AI assisted in developing the following core components:

- FastAPI backend architecture
- SQLite database initialization
- REST API implementation
- Background URL monitoring worker
- HTTP health check logic
- React dashboard UI
- URL registration workflow
- Response-time monitoring
- Docker containerization
- Docker Compose orchestration
- Project documentation
- Testing strategy

---

# 3. Engineering Iterations & Course Corrections

Like any real software project, the first implementation required refinement before reaching a stable MVP.

### Issue 1 — Docker Environment

The original implementation assumed a fully configured local Docker environment. Since Docker was unavailable during development, the application could not be executed using:

```bash
docker compose up
```

### Resolution

Instead of spending development time configuring Docker locally, the workflow was temporarily switched to native execution.

The AI generated platform-specific commands to run:

- FastAPI via Uvicorn
- React via Vite

This allowed feature development and debugging to continue while keeping the project fully containerized for deployment.

---

### Issue 2 — CORS Configuration

The generated backend initially configured:

```python
allow_credentials=True
allow_origins=["*"]
```

Modern browsers reject this configuration because wildcard origins cannot be combined with credentialed requests.

This prevented the React frontend from communicating with the backend.

### Resolution

The issue was identified during integration testing.

After providing feedback, the AI regenerated the middleware configuration with an appropriate CORS policy, restoring communication between frontend and backend while preserving security for the MVP.

---

# 4. Architectural Decision

## Handling Dynamic HTTP Headers in SQLite

One advanced requirement involved allowing users to specify custom HTTP headers for monitored endpoints.

SQLite does not provide a native JSONB data type similar to PostgreSQL.

Several approaches were considered:

- Separate relational table
- Multiple header columns
- Serialized JSON

For an MVP, introducing additional relational tables would have increased complexity without significant benefit.

### Final Design

A serialized JSON string is stored inside a `TEXT` column named:

```
custom_headers
```

### Validation

During URL creation:

- Incoming JSON is validated using

```python
json.loads()
```

- Invalid JSON raises a `400 Bad Request`

This guarantees only valid payloads reach the database.

### Runtime

During monitoring:

- Stored JSON is deserialized
- Converted into an HTTP header dictionary
- Passed directly into HTTPX requests

This approach keeps the schema lightweight while supporting arbitrary request headers.

---

# 5. AI-Assisted Testing

After completing the MVP, AI was also used to design the testing strategy.

Generated assets included:

- Pytest fixtures
- API integration tests
- Background worker unit tests
- Mock HTTP responses
- End-to-end verification script
- README testing documentation

This enabled verification of:

- URL registration
- Duplicate handling
- Invalid URL validation
- Healthy endpoints
- HTTP 404 responses
- Network timeouts
- DNS failures
- Background worker behavior

---

# 6. Reflection

AI significantly reduced the time required to build the MVP by automating repetitive engineering tasks such as scaffolding, API generation, containerization, testing, and documentation.

However, successful delivery still required engineering oversight. Manual debugging, validation, integration testing, and architectural decisions were essential to refining the generated output into a functional and maintainable application.

The project demonstrates AI being used as a productivity multiplier rather than a replacement for software engineering practices.

---

# Prompt 2 — Testing & Quality Assurance

After the core application was completed, the following prompt was used to generate a comprehensive testing strategy:

> **Role:** You are an expert Principal QA Automation Engineer and Lead SDET.
>
> **Objective:** Create a production-grade testing framework for the FastAPI + React + Docker based Uptime Monitor MVP.
>
> **Requirements (Summary):**
> - Pytest fixtures
> - API integration tests
> - Background worker unit tests
> - Mock HTTP responses
> - DNS failure simulation
> - Concurrent ping validation
> - End-to-end verification script
> - README testing documentation

This prompt produced an automated testing suite covering API validation, asynchronous worker behavior, mocked network conditions, edge-case handling, and end-to-end system verification, improving the overall reliability of the project.
