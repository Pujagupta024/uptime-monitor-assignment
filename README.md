# Uptime Monitor MVP

A lightweight, full-stack application to monitor URL uptime. 
Built with FastAPI, SQLite, React (Vite), and Docker.

## 1-Line Setup

Run the following command in the root directory to build and start both the backend and frontend:

```bash
docker compose up --build
```

## Testing Steps

Once the containers are running, navigate to `http://localhost` in your browser.

1. **Testing a Healthy URL:**
   - Enter `https://example.com` into the input field and click "Add URL".
   - Wait up to 60 seconds (or watch the logs) for the background worker to ping the site.
   - The dashboard will display a green **UP** badge and the response time.

2. **Testing an Intentionally Broken URL (DNS Failure):**
   - Enter `https://fake-url-test-1234.local` and click "Add URL".
   - The background worker will fail to resolve this DNS, correctly catching a server unreachability scenario (not just a 404).
   - Wait up to 60 seconds. The dashboard will display a red **DOWN** badge.

# 🧪 Automated & Manual Testing

## Running the Automated Test Suite

We use Pytest to execute the test suite which validates the FastAPI application and mocks the background worker logic asynchronously. To run it inside the container:

```bash
docker compose exec backend pytest
```
*(If you are running the backend locally without Docker, simply `cd backend` and run `pytest`)*

## Running the E2E Verification Script

We provide a zero-dependency bash script to verify end-to-end functionality via CURL. Run it from the root directory:

```bash
chmod +x verify_system.sh
./verify_system.sh
```
This script will:
1. Wait for the API to be ready.
2. Programmatically register a healthy and broken URL.
3. Wait for the background worker to execute.
4. Verify that both `is_up=true` and `is_up=false` states exist in the database.

## Manual UI Inspection

To verify visually as an evaluator:
1. Open your browser to `http://localhost`.
2. Enter `https://example.com` and submit. You'll instantly see it pop up. Within 3-5 seconds, it will light up with a green **UP** badge.
3. Enter `https://fake-broken-url-xyz.com` and submit. Within 3-5 seconds, the worker will detect the DNS failure and light up a red **DOWN** badge.
4. The dashboard polls every 3 seconds, so no page refresh is required to see these state changes in real-time!

## Deployment Sketch

To deploy this architecture to AWS, we would use **Amazon ECS (Elastic Container Service) with AWS Fargate** for serverless container orchestration. The `docker-compose.yml` can be translated into ECS Task Definitions, spinning up the FastAPI backend and Vite frontend containers in a private subnet, with an Application Load Balancer (ALB) routing public traffic to them. 

For the database, instead of local SQLite, we would provision an **Amazon RDS for PostgreSQL** instance in a multi-AZ configuration to ensure high availability. The backend would connect to RDS via securely managed secrets in AWS Secrets Manager. Using a CI/CD pipeline (like GitHub Actions or AWS CodePipeline), any pushes to the main branch would build the Docker images, push them to Amazon ECR, and deploy the new tasks to ECS automatically.
