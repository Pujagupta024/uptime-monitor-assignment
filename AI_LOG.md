# AI Collaboration Log

This document provides a "peek behind the curtain" of how this Uptime Monitor MVP was built entirely by collaborating with an AI agent. 

## 1. The AI Tech Stack
This project was built using an advanced agentic coding assistant powered by **Google Gemini** (specifically tuned for complex software engineering and autonomous workspace execution). The AI acted as an autonomous pair-programmer capable of executing shell commands, reading the file system, and writing code end-to-end.

## 2. The Prompts that Shipped It
To generate the core framework, the following raw prompts were fed to the AI:

**Initial MVP Generation Prompt:**
> "Build a lightweight, full-stack Uptime Monitor application. We value pragmatism, clean code, and execution velocity over over-engineered architectures. Generate the complete, working codebase for this system in one shot, ensuring all components are connected and functional. Tech Stack: Backend: Python with FastAPI (async, fast) and SQLite. Frontend: React with Vite. Infrastructure: Docker & Docker Compose. Database needs urls and ping_logs tables. Background worker should ping every 60s."

**Advanced Features Prompt (Deep Health & Percentiles):**
> "Refactor the current React frontend to elevate it from a basic proof-of-concept into a production-grade, premium MVP dashboard... Add deep health checks (custom HTTP methods, JSON headers, body assertions) and expose an aggregated analytics route (GET /api/urls/{id}/analytics) for P95/P99 latency math over 24 hours."

## 3. The Course Corrections
During the initial build phase, there was an interesting course correction required around **Docker and CORS**:

**The Issue**: The AI initially generated the FastAPI backend with CORS middleware configured as `allow_credentials=True` combined with `allow_origins=["*"]`. Modern browsers strictly block this combination for security reasons, causing the React frontend to fail on initial fetch. Furthermore, my local environment lacked a native Docker daemon, meaning the standard `docker compose up` command threw execution errors and threatened to stall development velocity.

**The Correction**: Instead of burning time troubleshooting a local Docker daemon installation, I recognized the need to pivot the environment to maintain momentum. I prompted the AI with a strict course correction: 
> *"The frontend is failing due to a CORS origin/credential conflict. Modify main.py to safely allow '*' origins for this MVP. Additionally, bypass the Docker containerization for now so we can test locally—give me the exact commands to run the backend via native uvicorn and the frontend via npm run dev."*

The AI autonomously realized its CORS mistake, patched the middleware in `main.py`, and seamlessly provided the native run commands. This allowed development and testing to proceed flawlessly while keeping the codebase container-ready for final deployment.

---

## 4. Advanced Platform Engineering Architecture 
*(Bonus: Handling Complex Data in SQLite)*

Implementing deep health checks involving custom HTTP headers posed an interesting architectural constraint: **SQLite does not possess a native JSONB column type**. Adding a dedicated relational table to map URL ID to key-value pairs (`url_headers`) would have over-engineered the MVP and necessitated expensive `JOIN` statements during the ping loop. 

**The Solution:**
We introduced a generic `TEXT` column (`custom_headers`) on the `urls` table to hold serialized JSON strings. 
- **Validation (FastAPI)**: When a user submits the `POST /api/urls` form, the backend intercepts the `custom_headers` string and utilizes `try...except json.JSONDecodeError` to attempt parsing. If the frontend payload contains malformed JSON, FastAPI rejects it with a `400 Bad Request` prior to database execution.
- **Deserialization (Worker Loop)**: Inside the asynchronous `ping_urls` engine, when the cursor fetches the target row, we simply run `json.loads(headers_str)`. Because we validated the integrity on ingestion, the worker safely constructs the `httpx` header dictionary without crashing the core event loop.
