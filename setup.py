#!/usr/bin/env python3
"""
Drift Control / IntuneAssesment - One-Command Setup Script
Run this on a fresh Ubuntu/Debian server:
    python3 setup.py
"""

import os
import subprocess
import sys
import textwrap

REPO_URL = "https://github.com/it5dk/IntuneAssesment.git"
INSTALL_DIR = os.path.expanduser("~/drift-control")

DOMAIN = ""         # e.g. "lab.it5.dk"  — leave empty to skip SSL
EMAIL  = ""         # e.g. "admin@it5.dk" — used for Let's Encrypt

# Azure credentials — fill in before running
TENANT_ID     = ""
CLIENT_ID     = ""
CLIENT_SECRET = ""


# ── helpers ──────────────────────────────────────────────────────────────────

def run(cmd, **kw):
    print(f"\n▶ {cmd}")
    result = subprocess.run(cmd, shell=True, **kw)
    if result.returncode != 0:
        print(f"✗ Command failed (exit {result.returncode})")
        sys.exit(result.returncode)
    return result


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(textwrap.dedent(content).lstrip())
    print(f"  ✓ wrote {path}")


# ── step 1: install prerequisites ────────────────────────────────────────────

def install_prerequisites():
    print("\n══ Step 1: Prerequisites ══")
    run("apt-get update -qq")
    run("apt-get install -y -qq git curl ca-certificates gnupg lsb-release openssl python3")

    # Docker
    if subprocess.run("docker --version", shell=True, capture_output=True).returncode != 0:
        print("Installing Docker...")
        run("curl -fsSL https://get.docker.com | sh")
        run("systemctl enable --now docker")
    else:
        print("  ✓ Docker already installed")

    # Docker Compose plugin
    if subprocess.run("docker compose version", shell=True, capture_output=True).returncode != 0:
        print("Installing Docker Compose plugin...")
        run('apt-get install -y docker-compose-plugin')
    else:
        print("  ✓ Docker Compose already installed")


# ── step 2: clone repo ───────────────────────────────────────────────────────

def clone_repo():
    print("\n══ Step 2: Clone Repository ══")
    if os.path.exists(INSTALL_DIR):
        print(f"  Directory {INSTALL_DIR} already exists — pulling latest...")
        run(f"git -C {INSTALL_DIR} pull")
    else:
        run(f"git clone -b master {REPO_URL} {INSTALL_DIR}")
    print(f"  ✓ Repo at {INSTALL_DIR}")


# ── step 3: write .env ───────────────────────────────────────────────────────

def write_env():
    print("\n══ Step 3: Backend .env ══")
    env_path = f"{INSTALL_DIR}/apps/backend/.env"

    if not TENANT_ID or not CLIENT_ID or not CLIENT_SECRET:
        print("  ⚠ Azure credentials not set in setup.py — using .env.example")
        if not os.path.exists(env_path):
            run(f"cp {INSTALL_DIR}/apps/backend/.env.example {env_path}")
        print("  ✗ Edit apps/backend/.env and add TENANT_ID, CLIENT_ID, CLIENT_SECRET, then re-run.")
        sys.exit(1)

    write(env_path, f"""
        TENANT_ID={TENANT_ID}
        CLIENT_ID={CLIENT_ID}
        CLIENT_SECRET={CLIENT_SECRET}
        DATABASE_URL=postgresql+asyncpg://driftcontrol:driftcontrol@postgres:5432/driftcontrol
        DATABASE_URL_SYNC=postgresql://driftcontrol:driftcontrol@postgres:5432/driftcontrol
        REDIS_URL=redis://redis:6379/0
        CELERY_BROKER_URL=redis://redis:6379/0
        CELERY_RESULT_BACKEND=redis://redis:6379/1
        APP_ENV=production
        LOG_LEVEL=INFO
        BACKEND_CORS_ORIGINS=["{f'https://{DOMAIN}' if DOMAIN else 'http://localhost:3000'}","http://localhost:3000"]
    """)


# ── step 4: patch Dockerfile ─────────────────────────────────────────────────

def patch_dockerfile():
    print("\n══ Step 4: Patch Frontend Dockerfile ══")
    path = f"{INSTALL_DIR}/apps/frontend/Dockerfile"
    with open(path) as f:
        content = f.read()

    if "NEXT_PUBLIC_API_URL" not in content:
        content = content.replace(
            "ENV NEXT_TELEMETRY_DISABLED=1\nRUN npm run build",
            "ENV NEXT_TELEMETRY_DISABLED=1\nARG NEXT_PUBLIC_API_URL=/api\nENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL\nRUN npm run build"
        )

    # Ensure public dir exists
    content = content.replace(
        "COPY --from=builder /app/public ./public",
        "RUN mkdir -p ./public"
    )
    if "RUN mkdir -p ./public" not in content:
        content = content.replace(
            "COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone",
            "RUN mkdir -p ./public\nCOPY --from=builder --chown=nextjs:nodejs /app/.next/standalone"
        )

    with open(path, "w") as f:
        f.write(content)
    print("  ✓ Dockerfile patched")


# ── step 5: write infra files ─────────────────────────────────────────────────

def write_infra():
    print("\n══ Step 5: Infra Files ══")
    infra = f"{INSTALL_DIR}/infra"
    os.makedirs(f"{infra}/nginx/certs", exist_ok=True)
    os.makedirs(f"{infra}/certbot/conf", exist_ok=True)
    os.makedirs(f"{infra}/certbot/www", exist_ok=True)

    # docker-compose.yml
    write(f"{infra}/docker-compose.yml", """
        version: "3.9"

        services:
          postgres:
            image: postgres:16-alpine
            environment:
              POSTGRES_USER: driftcontrol
              POSTGRES_PASSWORD: driftcontrol
              POSTGRES_DB: driftcontrol
            ports:
              - "5432:5432"
            volumes:
              - pgdata:/var/lib/postgresql/data
            healthcheck:
              test: ["CMD-SHELL", "pg_isready -U driftcontrol"]
              interval: 5s
              timeout: 5s
              retries: 5

          redis:
            image: redis:7-alpine
            ports:
              - "6379:6379"
            healthcheck:
              test: ["CMD", "redis-cli", "ping"]
              interval: 5s
              timeout: 5s
              retries: 5

          backend:
            build:
              context: ../apps/backend
              dockerfile: Dockerfile
            ports:
              - "8000:8000"
            env_file:
              - ../apps/backend/.env
            environment:
              DATABASE_URL: postgresql+asyncpg://driftcontrol:driftcontrol@postgres:5432/driftcontrol
              DATABASE_URL_SYNC: postgresql://driftcontrol:driftcontrol@postgres:5432/driftcontrol
              REDIS_URL: redis://redis:6379/0
              CELERY_BROKER_URL: redis://redis:6379/0
              CELERY_RESULT_BACKEND: redis://redis:6379/1
            depends_on:
              postgres:
                condition: service_healthy
              redis:
                condition: service_healthy
            healthcheck:
              test: ["CMD", "python", "-c", "import httpx; httpx.get('http://localhost:8000/health')"]
              interval: 10s
              timeout: 5s
              retries: 5

          celery-worker:
            build:
              context: ../apps/backend
              dockerfile: Dockerfile
            command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
            env_file:
              - ../apps/backend/.env
            environment:
              DATABASE_URL: postgresql+asyncpg://driftcontrol:driftcontrol@postgres:5432/driftcontrol
              DATABASE_URL_SYNC: postgresql://driftcontrol:driftcontrol@postgres:5432/driftcontrol
              REDIS_URL: redis://redis:6379/0
              CELERY_BROKER_URL: redis://redis:6379/0
              CELERY_RESULT_BACKEND: redis://redis:6379/1
            depends_on:
              postgres:
                condition: service_healthy
              redis:
                condition: service_healthy

          celery-beat:
            build:
              context: ../apps/backend
              dockerfile: Dockerfile
            command: celery -A app.tasks.scheduler beat --loglevel=info
            env_file:
              - ../apps/backend/.env
            environment:
              DATABASE_URL: postgresql+asyncpg://driftcontrol:driftcontrol@postgres:5432/driftcontrol
              DATABASE_URL_SYNC: postgresql://driftcontrol:driftcontrol@postgres:5432/driftcontrol
              REDIS_URL: redis://redis:6379/0
              CELERY_BROKER_URL: redis://redis:6379/0
              CELERY_RESULT_BACKEND: redis://redis:6379/1
            depends_on:
              postgres:
                condition: service_healthy
              redis:
                condition: service_healthy

          frontend:
            build:
              context: ../apps/frontend
              dockerfile: Dockerfile
              args:
                NEXT_PUBLIC_API_URL: /api
            expose:
              - "3000"
            depends_on:
              - backend

          nginx:
            image: nginx:alpine
            ports:
              - "80:80"
              - "443:443"
            volumes:
              - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
              - ./certbot/conf:/etc/letsencrypt:ro
              - ./certbot/www:/var/www/certbot:ro
            depends_on:
              - frontend
              - backend
            restart: unless-stopped

          certbot:
            image: certbot/certbot
            volumes:
              - ./certbot/conf:/etc/letsencrypt
              - ./certbot/www:/var/www/certbot
            entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew --quiet; sleep 12h & wait $${!}; done;'"

        volumes:
          pgdata:
    """)

    # nginx.conf — HTTP only initially; will be updated after cert is obtained
    domain_block = f"server_name {DOMAIN};" if DOMAIN else "server_name _;"
    write(f"{infra}/nginx/nginx.conf", f"""
        resolver 127.0.0.11 valid=30s;

        server {{
            listen 80;
            {domain_block}

            location /.well-known/acme-challenge/ {{
                root /var/www/certbot;
            }}

            location / {{
                set $frontend http://frontend:3000;
                proxy_pass $frontend;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
            }}
        }}
    """)


# ── step 6: build and start ───────────────────────────────────────────────────

def build_and_start():
    print("\n══ Step 6: Build & Start ══")
    run(f"docker compose -f {INSTALL_DIR}/infra/docker-compose.yml up --build -d")
    run(f"docker compose -f {INSTALL_DIR}/infra/docker-compose.yml ps")


# ── step 7: ssl (optional) ────────────────────────────────────────────────────

def print_ssl_instructions():
    print("\n══ Step 7: SSL / Let's Encrypt ══")
    if not DOMAIN or not EMAIL:
        print("  ⚠ DOMAIN or EMAIL not set — skipping SSL. Access via http://<server-ip>")
        return

    print(f"""
  Run this to get a free SSL certificate for {DOMAIN}:

    docker run --rm -it \\
      -v {INSTALL_DIR}/infra/certbot/conf:/etc/letsencrypt \\
      -v {INSTALL_DIR}/infra/certbot/www:/var/www/certbot \\
      certbot/certbot certonly \\
      --manual --preferred-challenges dns \\
      --email {EMAIL} --agree-tos --no-eff-email \\
      -d {DOMAIN}

  When it shows the TXT value, add it to your DNS as:
    Name:  _acme-challenge.{DOMAIN}
    Type:  TXT
    Value: <the value shown>

  Then verify propagation:
    nslookup -type=TXT _acme-challenge.{DOMAIN} 8.8.8.8

  Then press Enter in certbot. Once done, update nginx to HTTPS:
    python3 {INSTALL_DIR}/setup.py --enable-ssl
    """)


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Drift Control / IntuneAssesment — Setup")
    print("=" * 60)

    if "--enable-ssl" in sys.argv:
        enable_ssl()
        return

    install_prerequisites()
    clone_repo()
    write_env()
    patch_dockerfile()
    write_infra()
    build_and_start()
    print_ssl_instructions()

    print(f"""
══ Done! ══════════════════════════════════════════════════

  App:     http://<server-ip>
  Backend: http://<server-ip>:8000/health
  Docs:    http://<server-ip>:8000/docs

══════════════════════════════════════════════════════════
""")


def enable_ssl():
    """Switch nginx to HTTPS after cert is obtained."""
    infra = f"{INSTALL_DIR}/infra"
    if not DOMAIN:
        print("Set DOMAIN in setup.py first.")
        sys.exit(1)

    write(f"{infra}/nginx/nginx.conf", f"""
        resolver 127.0.0.11 valid=30s;

        server {{
            listen 80;
            server_name {DOMAIN};
            location /.well-known/acme-challenge/ {{
                root /var/www/certbot;
            }}
            location / {{
                return 301 https://$host$request_uri;
            }}
        }}

        server {{
            listen 443 ssl;
            server_name {DOMAIN};
            ssl_certificate     /etc/letsencrypt/live/{DOMAIN}/fullchain.pem;
            ssl_certificate_key /etc/letsencrypt/live/{DOMAIN}/privkey.pem;
            ssl_protocols       TLSv1.2 TLSv1.3;

            location / {{
                set $frontend http://frontend:3000;
                proxy_pass $frontend;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
            }}
        }}
    """)

    run(f"docker compose -f {infra}/docker-compose.yml exec nginx nginx -s reload")
    print(f"\n✓ HTTPS enabled! Open https://{DOMAIN}")


if __name__ == "__main__":
    main()
