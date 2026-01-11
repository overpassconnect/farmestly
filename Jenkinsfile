// Unified Jenkinsfile for both Staging and Production
// Detects environment based on job name or uses parameter

// staging exposed:	 e.g. DOMAIN = 10-10-99-4.staging.overpassconnect.com
// staging private:	 e.g. DOMAIN = 10.10.99.3 (internal ip)
// production:		 e.g. DOMAIN = domain.com

pipeline {
    agent any
    
    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['staging', 'production'],
            description: 'Deployment environment'
        )
        string(
            name: 'TARGET_HOST',
            defaultValue: '',
            description: 'Override target host (optional, uses env default if empty)'
        )
        string(
            name: 'GIT_BRANCH',
            defaultValue: '',
            description: 'Git branch (optional, uses default per environment)'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: true,
            description: 'Skip running tests before deployment'
        )
        booleanParam(
            name: 'REQUIRE_APPROVAL',
            defaultValue: true,
            description: 'Require manual approval before deployment'
        )
    }
    
    environment {
	    SERVICE_NAME = 'farmestly'
        BACKEND_DIR = 'packages/farmestly-service'
        FRONTEND_DIR = 'packages/farmestly-web'
        APP_USER = 'dev'
        APP_PORT = '5000'
        DEPLOY_DIR = "${WORKSPACE}/deploy_temp"
    }
    
    stages {
        stage('Initialize') {
            steps {
                script {
                    env.DEPLOY_ENV = params.ENVIRONMENT ?: (env.JOB_NAME.toLowerCase().contains('production') ? 'production' : 'staging')
                    env.IS_PRODUCTION = env.DEPLOY_ENV == 'production' ? 'true' : 'false'
                    
                    if (env.DEPLOY_ENV != 'production' && env.DEPLOY_ENV != 'staging') {
                        error("Invalid environment: ${env.DEPLOY_ENV}. Must be 'production' or 'staging'")
                    }
                    
                    def envConfigs = [:]
                    
                    if (env.DEPLOY_ENV == 'production') {
                        env.REMOTE_HOST = params.TARGET_HOST ?: 'prod.example.com'
                        env.DEFAULT_BRANCH = params.GIT_BRANCH ?: 'main'
                        env.CRED_PREFIX = 'production'
                        env.SSH_CRED_ID = 'jenkins-production-ssh-key'
                        env.WEB_DOMAIN = 'my.farmestlyprodtest.overpassconnect.com'
                        env.API_DOMAIN = 'api.farmestlyprodtest.overpassconnect.com'

                        envConfigs = [
                            NODE_ENV: env.DEPLOY_ENV,
                            PORT: env.APP_PORT,
                            LOG_LEVEL: 'warn',
                            MAX_REQUESTS_PER_MINUTE: '60',
                            COOKIE_SECURE: 'true',
                            ENABLE_RATE_LIMITING: 'true',
                            MAX_FILE_SIZE: '5242880',
                            SESSION_TIMEOUT: '7200000',
                        ]
                    } else if (env.DEPLOY_ENV == 'staging') {
                        env.REMOTE_HOST = params.TARGET_HOST ?: '10.10.99.1'
                        env.DEFAULT_BRANCH = params.GIT_BRANCH ?: 'main'
                        env.CRED_PREFIX = 'staging'
                        env.SSH_CRED_ID = 'jenkins-staging-ssh-key'
                        env.WEB_DOMAIN = 'my.10-10-99-1.staging.overpassconnect.com'
                        env.API_DOMAIN = 'api.10-10-99-1.staging.overpassconnect.com'

                        envConfigs = [
                            NODE_ENV: env.DEPLOY_ENV,
                            PORT: env.APP_PORT,
                            LOG_LEVEL: 'debug',
                            MAX_REQUESTS_PER_MINUTE: '1000',
                            COOKIE_SECURE: 'false',
                            ENABLE_RATE_LIMITING: 'false',
                            MAX_FILE_SIZE: '10485760',
                            SESSION_TIMEOUT: '3600000',
                        ]
                    } else {
                        error("Environment '${env.DEPLOY_ENV}' configuration not found")
                    }
                    
                    env.ENV_CONFIGS = groovy.json.JsonOutput.toJson(envConfigs)
                    env.REMOTE_DIR = "/home/${APP_USER}/${SERVICE_NAME}"
                    env.WEBROOT = '/var/www/html'
                    env.ENV_FILE = "/etc/${SERVICE_NAME}/env.conf"
                    
                    def envDisplay = env.DEPLOY_ENV.toUpperCase()
                    echo """
========================================
DEPLOYMENT CONFIGURATION
========================================
Environment: ${envDisplay}
Target Host: ${env.REMOTE_HOST}
Branch: ${env.DEFAULT_BRANCH}
Build: ${BUILD_NUMBER}
========================================
"""
                }
            }
        }
        
        stage('Pre-flight Checks') {
            when {
                expression { env.IS_PRODUCTION == 'true' }
            }
            steps {
                script {
                    if (params.REQUIRE_APPROVAL) {
                        timeout(time: 15, unit: 'MINUTES') {
                            input message: "Deploy to PRODUCTION (${env.REMOTE_HOST})?",
                                  ok: 'Deploy',
                                  submitter: 'admin,deploy-team'
                        }
                    }
                }
            }
        }
        
        stage('Checkout') {
            steps {
                echo "Checking out branch: ${env.DEFAULT_BRANCH}"
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${env.DEFAULT_BRANCH}"]],
                    userRemoteConfigs: scm.userRemoteConfigs
                ])
            }
        }

        stage('Setup Build Tools') {
            steps {
                script {
                    echo 'Setting up Node.js build environment...'
                    sh '''
                        # Install nvm if not present
                        if [ ! -d "$HOME/.nvm" ]; then
                            echo "Installing nvm..."
                            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
                        fi

                        # Load nvm
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

                        # Install/use Node.js 20
                        nvm install 20
                        nvm use 20

                        # Verify installation
                        node --version
                        npm --version

                        echo "✓ Node.js build environment ready"
                    '''
                }
            }
        }

        stage('Install Build Dependencies') {
            steps {
                script {
                    echo 'Installing dependencies for backend and frontend...'
                    sh '''
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                        nvm use 20

                        echo "Installing backend dependencies..."
                        cd ${BACKEND_DIR}
                        npm install

                        echo "Installing frontend dependencies..."
                        cd ${WORKSPACE}/${FRONTEND_DIR}
                        npm install

                        echo "✓ All dependencies installed"
                    '''
                }
            }
        }

        stage('Run Tests') {
            when {
                expression { !params.SKIP_TESTS }
            }
            steps {
                script {
                    echo 'Running tests...'
                    dir("${BACKEND_DIR}") {
                        sh '''
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                            nvm use 20
                            npm test || exit 1
                        '''
                    }
                }
            }
        }
        
        stage('Verify Prerequisites') {
            steps {
                sh """
                    if [ ! -d "${BACKEND_DIR}" ] || [ ! -d "${FRONTEND_DIR}" ]; then
                        echo "ERROR: Required directories not found"
                        exit 1
                    fi
                    if [ ! -f "${BACKEND_DIR}/package.json" ]; then
                        echo "ERROR: package.json not found"
                        exit 1
                    fi
                """
            }
        }
        
        stage('Prepare Deployment Package') {
            steps {
                sh """
                    rm -rf ${DEPLOY_DIR}
                    mkdir -p ${DEPLOY_DIR}/backend
                    mkdir -p ${DEPLOY_DIR}/frontend
                    
                    rsync -a \
                        --exclude 'node_modules' \
                        --exclude '.git' \
                        --exclude '.gitignore' \
                        --exclude '.env' \
                        --exclude '.*.env' \
                        --exclude 'tests' \
                        --exclude '*.test.js' \
                        --exclude 'coverage' \
                        ${BACKEND_DIR}/ ${DEPLOY_DIR}/backend/
                """
            }
        }
        
        stage('Build Frontend') {
            steps {
                dir("${FRONTEND_DIR}") {
                    sh '''
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                        nvm use 20

                        rm -rf dist

                        # Build frontend - outputs to dist/ directory by default
                        # The publicPath in webpack.config.js is already set to '/' for absolute paths
                        npm run build

                        if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
                            echo "ERROR: Frontend build failed"
                            exit 1
                        fi
                    '''
                }
                sh "cp -r ${FRONTEND_DIR}/dist/* ${DEPLOY_DIR}/frontend/"
            }
        }
        
        stage('Prepare Environment Config') {
            steps {
                script {
                    echo "Preparing ${env.DEPLOY_ENV} environment configuration..."
                    
                    def configs = new groovy.json.JsonSlurper().parseText(env.ENV_CONFIGS)
                    
                    withCredentials([
                        string(credentialsId: "${env.CRED_PREFIX}-mongodb-uri", variable: 'MONGODB_URI'),
                        string(credentialsId: "${env.CRED_PREFIX}-jwt-secret", variable: 'JWT_SECRET'),
                        string(credentialsId: "${env.CRED_PREFIX}-session-secret", variable: 'SESSION_SECRET'),
                        string(credentialsId: "${env.CRED_PREFIX}-email-password", variable: 'EMAIL_PASSWORD'),
                        string(credentialsId: "${env.CRED_PREFIX}-api-key", variable: 'API_KEY'),
                    ]) {
                        def envLines = "# Generated by Jenkins Build ${BUILD_NUMBER}\n"
                        envLines += "# Environment: ${env.DEPLOY_ENV}\n"
                        envLines += "# Branch: ${env.DEFAULT_BRANCH}\n\n"
                        
                        configs.each { key, value ->
                            envLines += "${key}=${value}\n"
                        }
                        
                        envLines += "\n# Secrets\n"
                        
                        def secrets = [
                            'MONGODB_URI': MONGODB_URI,
                            'JWT_SECRET': JWT_SECRET,
                            'SESSION_SECRET': SESSION_SECRET,
                            'EMAIL_PASSWORD': EMAIL_PASSWORD,
                            'API_KEY': API_KEY,
                        ]
                        
                        secrets.each { key, value ->
                            envLines += "${key}=${value}\n"
                        }
                        
                        writeFile file: "${DEPLOY_DIR}/env.conf", text: envLines
                        echo "✓ Environment file created with ${configs.size()} configs + ${secrets.size()} secrets"
                    }
                }
            }
        }
        
        stage('Stop Service') {
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: env.SSH_CRED_ID,
                        keyFileVariable: 'SSH_KEY'
                    )]) {
                        sh """
                            ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                root@${env.REMOTE_HOST} '
                                if systemctl is-active --quiet ${SERVICE_NAME}; then
                                    echo "Service is running, stopping gracefully..."

                                    # Send SIGTERM for graceful shutdown
                                    systemctl stop ${SERVICE_NAME}

                                    # Wait up to 30 seconds for graceful shutdown
                                    for i in {1..30}; do
                                        if ! systemctl is-active --quiet ${SERVICE_NAME}; then
                                            echo "Service stopped gracefully after \$i seconds"
                                            exit 0
                                        fi
                                        sleep 1
                                    done

                                    # If still running after 30s, force kill
                                    if systemctl is-active --quiet ${SERVICE_NAME}; then
                                        echo "WARNING: Service did not stop gracefully, forcing..."
                                        systemctl kill --signal=SIGKILL ${SERVICE_NAME}
                                        sleep 2
                                    fi
                                else
                                    echo "Service was not running"
                                fi
                            '
                        """
                    }
                }
            }
        }
        
        stage('Backup Current Deployment') {
            steps {
                script {
                    def keepBackups = env.IS_PRODUCTION == 'true' ? 10 : 5
                    withCredentials([sshUserPrivateKey(
                        credentialsId: env.SSH_CRED_ID,
                        keyFileVariable: 'SSH_KEY'
                    )]) {
                        sh """
                            ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                root@${env.REMOTE_HOST} '
                                set -e
                                BACKUP_BASE="/home/${APP_USER}/backups"
                                BACKUP_DIR="\${BACKUP_BASE}/\$(date +%Y%m%d_%H%M%S)"

                                # Create backup directory
                                mkdir -p "\${BACKUP_DIR}"

                                # Backup backend if exists
                                if [ -d "${env.REMOTE_DIR}" ]; then
                                    echo "Backing up backend from ${env.REMOTE_DIR}..."
                                    cp -r "${env.REMOTE_DIR}" "\${BACKUP_DIR}/backend" 2>/dev/null || {
                                        echo "WARNING: Backend backup failed, but continuing..."
                                    }
                                fi

                                # Backup frontend if exists (follow symlink)
                                if [ -L "${env.WEBROOT}" ] || [ -d "${env.WEBROOT}" ]; then
                                    echo "Backing up frontend from ${env.WEBROOT}..."
                                    cp -rL "${env.WEBROOT}" "\${BACKUP_DIR}/frontend" 2>/dev/null || {
                                        echo "WARNING: Frontend backup failed, but continuing..."
                                    }
                                fi

                                # Verify backup was created successfully
                                if [ -d "\${BACKUP_DIR}/backend" ] || [ -d "\${BACKUP_DIR}/frontend" ]; then
                                    echo "✓ Backup created at \${BACKUP_DIR}"

                                    # Clean up old backups (keep only N most recent)
                                    cd "\${BACKUP_BASE}" 2>/dev/null || exit 0
                                    BACKUP_COUNT=\$(ls -1d */ 2>/dev/null | wc -l)
                                    if [ "\${BACKUP_COUNT}" -gt ${keepBackups} ]; then
                                        echo "Cleaning up old backups (keeping ${keepBackups} most recent)..."
                                        ls -1td */ | tail -n +\$((${keepBackups} + 1)) | xargs -r rm -rf
                                        echo "✓ Old backups cleaned up"
                                    fi
                                else
                                    echo "WARNING: No backup created (nothing to backup)"
                                    rmdir "\${BACKUP_DIR}" 2>/dev/null || true
                                fi
                            ' || echo "Backup stage completed with warnings"
                        """
                    }
                }
            }
        }
        
        stage('Deploy Backend') {
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: env.SSH_CRED_ID,
                        keyFileVariable: 'SSH_KEY'
                    )]) {
                        sh """
                            rsync -az --delete \
                                -e "ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no" \
                                --exclude 'node_modules' \
                                --exclude '.git' \
                                --exclude 'uploads' \
                                --exclude 'logs' \
                                --exclude 'tmp' \
                                --exclude '*.log' \
                                --exclude 'data' \
                                --exclude '.env.local' \
                                ${DEPLOY_DIR}/backend/ root@${env.REMOTE_HOST}:${env.REMOTE_DIR}/

                            ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                root@${env.REMOTE_HOST} \
                                "chown -R ${APP_USER}:${APP_USER} ${env.REMOTE_DIR}"
                        """
                    }
                }
            }
        }
        
        stage('Deploy Frontend') {
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: env.SSH_CRED_ID,
                        keyFileVariable: 'SSH_KEY'
                    )]) {
                        sh """
                            # Create releases directory structure
                            RELEASE_DIR="/var/www/releases/\$(date +%Y%m%d_%H%M%S)"

                            ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                root@${env.REMOTE_HOST} \
                                "mkdir -p /var/www/releases"

                            # Deploy to versioned release directory
                            rsync -az \
                                -e "ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no" \
                                ${DEPLOY_DIR}/frontend/ root@${env.REMOTE_HOST}:\${RELEASE_DIR}/

                            # Atomic symlink swap
                            ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                root@${env.REMOTE_HOST} "
                                # Set ownership
                                chown -R www-data:www-data \${RELEASE_DIR}

                                # Create new symlink
                                ln -snf \${RELEASE_DIR} ${env.WEBROOT}.new

                                # Atomic swap (single syscall, no downtime)
                                mv -Tf ${env.WEBROOT}.new ${env.WEBROOT}

                                # Keep only last 5 releases
                                cd /var/www/releases && ls -t | tail -n +6 | xargs -r rm -rf

                                echo 'Frontend deployed to:' \${RELEASE_DIR}
                            "
                        """
                    }
                }
            }
        }
        
        stage('Deploy Nginx Config') {
            steps {
                script {
                    echo 'Deploying nginx configuration...'
                    
                    def nginxDirExists = fileExists('nginx/sites-available')
                    
                    if (nginxDirExists) {
                        withCredentials([sshUserPrivateKey(
                            credentialsId: env.SSH_CRED_ID,
                            keyFileVariable: 'SSH_KEY'
                        )]) {
                            sh """
                                set -e
                                mkdir -p ${DEPLOY_DIR}/nginx/sites-available ${DEPLOY_DIR}/nginx/snippets

                                # Set SSL base path based on environment
                                if [ "${env.IS_PRODUCTION}" = "true" ]; then
                                    SSL_BASE="/etc/letsencrypt/live"
                                else
                                    SSL_BASE="/etc/ssl"
                                fi

                                for template in nginx/sites-available/*.nginx; do
                                    [ ! -f "\$template" ] && continue

                                    filename=\$(basename "\$template" .nginx)

                                    # Determine SSL cert path based on which domain this config uses
                                    # Check if template contains WEB_DOMAIN or API_DOMAIN placeholder
                                    if grep -q '{{WEB_DOMAIN}}' "\$template"; then
                                        domain="${env.WEB_DOMAIN}"
                                    elif grep -q '{{API_DOMAIN}}' "\$template"; then
                                        domain="${env.API_DOMAIN}"
                                    else
                                        # Fallback: extract from existing server_name
                                        domain=\$(grep -m1 'server_name' "\$template" | sed 's/.*server_name\\s*//' | sed 's/;.*//' | awk '{print \$1}')
                                        [ -z "\$domain" ] && domain="${env.REMOTE_HOST}"
                                    fi

                                    if [ "${env.IS_PRODUCTION}" = "true" ]; then
                                        ssl_cert="\${SSL_BASE}/\${domain}/fullchain.pem"
                                        ssl_key="\${SSL_BASE}/\${domain}/privkey.pem"
                                    else
                                        ssl_cert="\${SSL_BASE}/certs/${SERVICE_NAME}-selfsigned.crt"
                                        ssl_key="\${SSL_BASE}/private/${SERVICE_NAME}-selfsigned.key"
                                    fi

                                    sed -e "s|{{WEB_DOMAIN}}|${env.WEB_DOMAIN}|g" \
                                        -e "s|{{API_DOMAIN}}|${env.API_DOMAIN}|g" \
                                        -e "s|{{APP_PORT}}|${env.APP_PORT}|g" \
                                        -e "s|{{SERVICE_NAME}}|${SERVICE_NAME}|g" \
                                        -e "s|{{SSL_CERTIFICATE}}|\${ssl_cert}|g" \
                                        -e "s|{{SSL_CERTIFICATE_KEY}}|\${ssl_key}|g" \
                                        "\$template" > "${DEPLOY_DIR}/nginx/sites-available/\${filename}"
                                done

                                [ -d nginx/snippets ] && cp nginx/snippets/* ${DEPLOY_DIR}/nginx/snippets/ 2>/dev/null || true
                            """
                            
                            sh """
                                # Create unique temp directory for this deployment
                                NGINX_TEMP_DIR="/tmp/nginx-deploy-${BUILD_NUMBER}-\$(date +%s)"

                                # Backup existing configs
                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                    root@${env.REMOTE_HOST} \
                                    "mkdir -p /etc/nginx/backup-\$(date +%Y%m%d_%H%M%S) && \
                                     cp -r /etc/nginx/sites-available/* /etc/nginx/backup-\$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true"

                                # Create unique temp directory on server
                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                    root@${env.REMOTE_HOST} \
                                    "mkdir -p \${NGINX_TEMP_DIR}/sites-available \${NGINX_TEMP_DIR}/snippets"

                                # Copy nginx site configs to unique temp dir
                                scp -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                    ${DEPLOY_DIR}/nginx/sites-available/* \
                                    root@${env.REMOTE_HOST}:\${NGINX_TEMP_DIR}/sites-available/

                                # Move configs to final location (allows updates)
                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                    root@${env.REMOTE_HOST} \
                                    "cp -f \${NGINX_TEMP_DIR}/sites-available/* /etc/nginx/sites-available/"

                                # Handle snippets if they exist
                                if [ -d ${DEPLOY_DIR}/nginx/snippets ] && [ "\$(ls -A ${DEPLOY_DIR}/nginx/snippets)" ]; then
                                    scp -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                        ${DEPLOY_DIR}/nginx/snippets/* \
                                        root@${env.REMOTE_HOST}:\${NGINX_TEMP_DIR}/snippets/

                                    ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                        root@${env.REMOTE_HOST} \
                                        "mkdir -p /etc/nginx/snippets && \
                                         cp -f \${NGINX_TEMP_DIR}/snippets/* /etc/nginx/snippets/"
                                fi

                                # Test nginx config and reload if successful
                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                    root@${env.REMOTE_HOST} \
                                    "nginx -t && systemctl reload nginx || (echo 'Nginx config test failed!' && exit 1)"

                                # Clean up temp directory
                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                    root@${env.REMOTE_HOST} \
                                    "rm -rf \${NGINX_TEMP_DIR}"
                            """
                        }
                    } else {
                        echo 'No nginx directory found, skipping'
                    }
                }
            }
        }

        stage('Setup SSL Certificates') {
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: env.SSH_CRED_ID,
                        keyFileVariable: 'SSH_KEY'
                    )]) {
                        if (env.IS_PRODUCTION == 'true') {
                            echo 'Production: Discovering domains from nginx configs and ensuring SSL certificates...'

                            def domains = sh(
                                script: """
                                    ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                        root@${env.REMOTE_HOST} \
                                        "grep -h 'server_name' /etc/nginx/sites-available/* 2>/dev/null | \
                                         grep -v '#' | \
                                         sed 's/server_name\\s*//' | \
                                         sed 's/;.*//' | \
                                         tr -s ' ' '\\n' | \
                                         grep -v '^\\s*\$' | \
                                         sort -u | \
                                         tr '\\n' ' '"
                                """,
                                returnStdout: true
                            ).trim()

                            if (domains) {
                                echo "Discovered domains: ${domains}"

                                domains.split(/\s+/).each { domain ->
                                    domain = domain.trim()
                                    if (domain && !domain.startsWith('_') && domain != 'localhost') {
                                        echo "Checking SSL certificate for: ${domain}"

                                        def certExists = sh(
                                            script: """
                                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                                    root@${env.REMOTE_HOST} \
                                                    "[ -f /etc/letsencrypt/live/${domain}/fullchain.pem ] && echo 'exists' || echo 'missing'"
                                            """,
                                            returnStdout: true
                                        ).trim()

                                        if (certExists == 'missing') {
                                            echo "Obtaining Let's Encrypt certificate for ${domain}..."
                                            sh """
                                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                                    root@${env.REMOTE_HOST} \
                                                    "certbot certonly --nginx -d ${domain} --non-interactive --agree-tos --email admin@example.com" || \
                                                    echo "WARNING: Failed to obtain certificate for ${domain}"
                                            """
                                        } else {
                                            echo "✓ Certificate already exists for ${domain}"
                                        }
                                    }
                                }

                                echo "Checking certificate renewal status..."
                                sh """
                                    ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                        root@${env.REMOTE_HOST} \
                                        "certbot renew --dry-run" || echo "Certbot renewal check completed"
                                """
                            } else {
                                echo "No domains found in nginx configs, skipping SSL setup"
                            }
                        } else {
                            echo 'Staging: Ensuring self-signed SSL certificate exists...'
                            sh """
                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                    root@${env.REMOTE_HOST} '
                                    if [ ! -f /etc/ssl/certs/${SERVICE_NAME}-selfsigned.crt ]; then
                                        echo "Creating self-signed certificate for ${env.REMOTE_HOST}..."

                                        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                                            -keyout /etc/ssl/private/${SERVICE_NAME}-selfsigned.key \
                                            -out /etc/ssl/certs/${SERVICE_NAME}-selfsigned.crt \
                                            -subj "/C=US/ST=State/L=City/O=Organization/CN=${env.REMOTE_HOST}"

                                        chmod 600 /etc/ssl/private/${SERVICE_NAME}-selfsigned.key
                                        chmod 644 /etc/ssl/certs/${SERVICE_NAME}-selfsigned.crt

                                        echo "✓ Self-signed certificate generated"
                                    else
                                        echo "✓ Self-signed certificate already exists"
                                    fi
                                '
                            """
                        }
                    }
                }
            }
        }

        stage('Update Environment Config') {
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: env.SSH_CRED_ID,
                        keyFileVariable: 'SSH_KEY'
                    )]) {
                        sh """
                            scp -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                ${DEPLOY_DIR}/env.conf root@${env.REMOTE_HOST}:${env.ENV_FILE}

                            ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                root@${env.REMOTE_HOST} \
                                "chmod 600 ${env.ENV_FILE} && chown root:root ${env.ENV_FILE}"
                        """
                    }
                }
            }
        }
        
        stage('Install Dependencies') {
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: env.SSH_CRED_ID,
                        keyFileVariable: 'SSH_KEY'
                    )]) {
                        sh """
                            ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                root@${env.REMOTE_HOST} \
                                "su - ${APP_USER} -c 'cd ${env.REMOTE_DIR} && source ~/.nvm/nvm.sh && npm install --production'"

                            ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                root@${env.REMOTE_HOST} '
                                if [ ! -d ${env.REMOTE_DIR}/node_modules ]; then
                                    echo "ERROR: node_modules not found"
                                    exit 1
                                fi
                            '
                        """
                    }
                }
            }
        }
        
        stage('Start Service') {
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: env.SSH_CRED_ID,
                        keyFileVariable: 'SSH_KEY'
                    )]) {
                        sh """
                            ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                root@${env.REMOTE_HOST} \
                                "systemctl daemon-reload && systemctl start ${SERVICE_NAME}"
                            sleep 5
                        """
                    }
                }
            }
        }
        
        stage('Verify Deployment') {
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: env.SSH_CRED_ID,
                        keyFileVariable: 'SSH_KEY'
                    )]) {
                        def serviceStatus = sh(
                            script: """
                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                    root@${env.REMOTE_HOST} \
                                    "systemctl is-active --quiet ${SERVICE_NAME} && echo 'active' || echo 'inactive'"
                            """,
                            returnStdout: true
                        ).trim()

                        if (serviceStatus == 'active') {
                            echo 'Service is running successfully!'
                            sh """
                                ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                                    root@${env.REMOTE_HOST} \
                                    "journalctl -u ${SERVICE_NAME} -n 20 --no-pager"
                            """
                        } else {
                            error('Service failed to start!')
                        }
                    }
                }
            }
        }
        
        stage('Health Check') {
            steps {
                script {
                    echo "Running health checks for ${env.DEPLOY_ENV}..."
                    sleep 10

                    def healthCheckUrl = "https://${env.REMOTE_HOST}/api/health"
                    def maxRetries = env.IS_PRODUCTION == 'true' ? 5 : 3
                    def retryCount = 0
                    def healthy = false

                    while (retryCount < maxRetries && !healthy) {
                        try {
                            def response = sh(
                                script: "curl -f -s -o /dev/null -w '%{http_code}' -k ${healthCheckUrl}",
                                returnStdout: true
                            ).trim()

                            if (response == '200') {
                                healthy = true
                                echo "✓ Health check passed (HTTP ${response})"
                            } else {
                                echo "Health check attempt ${retryCount + 1}/${maxRetries}: HTTP ${response}"
                                retryCount++
                                sleep 5
                            }
                        } catch (Exception e) {
                            echo "Health check attempt ${retryCount + 1}/${maxRetries} failed: ${e.message}"
                            retryCount++
                            sleep 5
                        }
                    }

                    if (!healthy) {
                        if (env.IS_PRODUCTION == 'true') {
                            error('Production health check failed!')
                        } else {
                            echo 'WARNING: Staging health check failed, but continuing...'
                        }
                    }
                }
            }
        }
    }
    
    post {
        always {
            sh "rm -rf ${DEPLOY_DIR}"
        }
        success {
            script {
                def envName = env.DEPLOY_ENV.toUpperCase()
                echo """
========================================
DEPLOYMENT SUCCESSFUL!
========================================
Environment: ${envName}
Server: ${env.REMOTE_HOST}
Build: ${BUILD_NUMBER}
========================================
"""
            }
        }
        failure {
            script {
                echo "DEPLOYMENT FAILED!"
                withCredentials([sshUserPrivateKey(
                    credentialsId: env.SSH_CRED_ID,
                    keyFileVariable: 'SSH_KEY'
                )]) {
                    sh """
                        ssh -i \${SSH_KEY} -o StrictHostKeyChecking=no \
                            root@${env.REMOTE_HOST} \
                            "journalctl -u ${SERVICE_NAME} -n 100 --no-pager" || true
                    """
                }
            }
        }
    }
}