pipeline {
    agent any

    environment {
        IMAGE_NAME = 'rdp-soundboard'
        IMAGE_TAG = "${env.BUILD_NUMBER}"
        CONTAINER_NAME = 'discord-bot'
        NETWORK_NAME = 'soundboard_bot-network'
        DOCKER_BUILDKIT = '1'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    echo "Building commit: ${env.GIT_COMMIT}"
                }
            }
        }

        stage('Detect Changes') {
            steps {
                script {
                    def changed = true
                    try {
                        def changes = sh(
                            script: 'git diff --name-only HEAD~1 HEAD -- src/ Dockerfile Jenkinsfile package.json pnpm-lock.yaml tsconfig.json',
                            returnStdout: true
                        ).trim()
                        changed = changes.length() > 0
                    } catch (Exception e) {
                        echo "Could not detect changes (first run?), proceeding with build"
                        changed = true
                    }

                    if (!changed) {
                        echo "No relevant changes detected, skipping build"
                        currentBuild.result = 'NOT_BUILT'
                        error("No changes detected — skipping build")
                    }

                    echo "Changes detected, proceeding with build"
                }
            }
        }

        stage('Validate Credentials') {
            steps {
                script {
                    def missing = []
                    def requiredCreds = [
                        'soundboard-discord-token',
                        'soundboard-client-id',
                        'soundboard-aws-access-key',
                        'soundboard-aws-secret-key',
                        'soundboard-aws-region',
                        'soundboard-s3-endpoint',
                        'soundboard-s3-bucket',
                        'soundboard-s3-base-url',
                        'soundboard-postgres-user',
                        'soundboard-postgres-password',
                        'soundboard-postgres-db'
                    ]

                    for (credId in requiredCreds) {
                        try {
                            withCredentials([string(credentialsId: credId, variable: 'TEST_VAR')]) {
                                // credential exists
                            }
                        } catch (Exception e) {
                            missing.add(credId)
                        }
                    }

                    if (missing.size() > 0) {
                        echo "Missing Jenkins credentials:"
                        missing.each { echo "  - ${it}" }
                        error("${missing.size()} credential(s) missing. Add them in Jenkins > Manage Credentials before deploying.")
                    }

                    echo "All ${requiredCreds.size()} credentials validated"
                }
            }
        }

        stage('Build Image') {
            steps {
                script {
                    withCredentials([
                        string(credentialsId: 'soundboard-aws-access-key',  variable: 'AWS_ACCESS_KEY_ID'),
                        string(credentialsId: 'soundboard-aws-secret-key',  variable: 'AWS_SECRET_ACCESS_KEY'),
                        string(credentialsId: 'soundboard-aws-region',      variable: 'AWS_REGION'),
                        string(credentialsId: 'soundboard-s3-endpoint',     variable: 'S3_ENDPOINT'),
                        string(credentialsId: 'soundboard-s3-bucket',       variable: 'S3_BUCKET_NAME'),
                        string(credentialsId: 'soundboard-s3-base-url',     variable: 'S3_BASE_URL')
                    ]) {
                        withEnv(["BUILD_IMAGE_NAME=${IMAGE_NAME}", "BUILD_IMAGE_TAG=${IMAGE_TAG}"]) {
                            sh '''
                                echo "Pulling latest image for cache..."
                                docker pull $BUILD_IMAGE_NAME:latest || true

                                echo "Building Docker image (includes tests)..."

                                docker build \
                                    --cache-from $BUILD_IMAGE_NAME:latest \
                                    --build-arg AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
                                    --build-arg AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
                                    --build-arg AWS_REGION=$AWS_REGION \
                                    --build-arg S3_ENDPOINT=$S3_ENDPOINT \
                                    --build-arg S3_BUCKET_NAME=$S3_BUCKET_NAME \
                                    --build-arg S3_BASE_URL=$S3_BASE_URL \
                                    --build-arg S3_FOLDER= \
                                    -t $BUILD_IMAGE_NAME:$BUILD_IMAGE_TAG \
                                    -t $BUILD_IMAGE_NAME:latest \
                                    .

                                echo "Docker image built successfully: $BUILD_IMAGE_NAME:$BUILD_IMAGE_TAG"
                            '''
                        }
                    }
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    // Stop and remove old container
                    sh """
                        echo "Checking for existing container..."

                        if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
                            echo "Found existing container ${CONTAINER_NAME}, removing it..."

                            docker stop ${CONTAINER_NAME} || docker kill ${CONTAINER_NAME} || true
                            sleep 2
                            docker rm -f ${CONTAINER_NAME} || true
                            sleep 1

                            if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
                                echo "ERROR: Container ${CONTAINER_NAME} still exists after removal attempt"
                                docker ps -a | grep ${CONTAINER_NAME} || true
                                exit 1
                            fi

                            echo "Container successfully removed"
                        else
                            echo "No existing container found, proceeding with fresh deployment"
                        fi

                        # Ensure network exists
                        docker network inspect ${NETWORK_NAME} > /dev/null 2>&1 || \
                            docker network create ${NETWORK_NAME}
                    """

                    // Ensure postgres container is running (persistent — not recreated on each deploy)
                    withCredentials([
                        string(credentialsId: 'soundboard-postgres-user',     variable: 'POSTGRES_USER'),
                        string(credentialsId: 'soundboard-postgres-password', variable: 'POSTGRES_PASSWORD'),
                        string(credentialsId: 'soundboard-postgres-db',       variable: 'POSTGRES_DB')
                    ]) {
                        sh """
                            if ! docker ps --format '{{.Names}}' | grep -q "^soundboard-postgres\$"; then
                                echo "Starting postgres container..."

                                # Remove stopped container if it exists
                                docker rm -f soundboard-postgres 2>/dev/null || true

                                docker run -d \
                                    --name soundboard-postgres \
                                    --restart unless-stopped \
                                    --network ${NETWORK_NAME} \
                                    -e POSTGRES_USER=\$POSTGRES_USER \
                                    -e POSTGRES_PASSWORD=\$POSTGRES_PASSWORD \
                                    -e POSTGRES_DB=\$POSTGRES_DB \
                                    -v soundboard_postgres-data:/var/lib/postgresql/data \
                                    postgres:17-alpine

                                echo "Waiting for postgres to be ready..."
                                for i in \$(seq 1 30); do
                                    if docker exec soundboard-postgres pg_isready -U \$POSTGRES_USER > /dev/null 2>&1; then
                                        echo "Postgres is ready"
                                        break
                                    fi
                                    if [ \$i -eq 30 ]; then
                                        echo "ERROR: Postgres did not become ready in time"
                                        docker logs soundboard-postgres 2>&1
                                        exit 1
                                    fi
                                    sleep 2
                                done
                            else
                                echo "Postgres container already running, skipping start"
                            fi
                        """
                    }

                    // Start new bot container with credentials
                    withCredentials([
                        string(credentialsId: 'soundboard-discord-token',     variable: 'DISCORD_TOKEN'),
                        string(credentialsId: 'soundboard-client-id',         variable: 'CLIENT_ID'),
                        string(credentialsId: 'soundboard-aws-access-key',    variable: 'AWS_ACCESS_KEY_ID'),
                        string(credentialsId: 'soundboard-aws-secret-key',    variable: 'AWS_SECRET_ACCESS_KEY'),
                        string(credentialsId: 'soundboard-aws-region',        variable: 'AWS_REGION'),
                        string(credentialsId: 'soundboard-s3-endpoint',       variable: 'S3_ENDPOINT'),
                        string(credentialsId: 'soundboard-s3-bucket',         variable: 'S3_BUCKET_NAME'),
                        string(credentialsId: 'soundboard-s3-base-url',       variable: 'S3_BASE_URL'),
                        string(credentialsId: 'soundboard-postgres-user',     variable: 'POSTGRES_USER'),
                        string(credentialsId: 'soundboard-postgres-password', variable: 'POSTGRES_PASSWORD'),
                        string(credentialsId: 'soundboard-postgres-db',       variable: 'POSTGRES_DB')
                    ]) {
                        sh """
                            echo "Starting new container..."

                            if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
                                echo "ERROR: Container ${CONTAINER_NAME} still exists!"
                                exit 1
                            fi

                            docker run -d \
                                --name ${CONTAINER_NAME} \
                                --restart unless-stopped \
                                --network ${NETWORK_NAME} \
                                -e DISCORD_TOKEN=\$DISCORD_TOKEN \
                                -e CLIENT_ID=\$CLIENT_ID \
                                -e AWS_ACCESS_KEY_ID=\$AWS_ACCESS_KEY_ID \
                                -e AWS_SECRET_ACCESS_KEY=\$AWS_SECRET_ACCESS_KEY \
                                -e AWS_REGION=\$AWS_REGION \
                                -e S3_ENDPOINT=\$S3_ENDPOINT \
                                -e S3_BUCKET_NAME=\$S3_BUCKET_NAME \
                                -e S3_BASE_URL=\$S3_BASE_URL \
                                -e S3_FOLDER= \
                                -e DATABASE_URL=postgresql://\$POSTGRES_USER:\$POSTGRES_PASSWORD@soundboard-postgres:5432/\$POSTGRES_DB \
                                -e NODE_ENV=production \
                                ${IMAGE_NAME}:${IMAGE_TAG}

                            if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
                                echo "ERROR: Container failed to start"
                                docker logs ${CONTAINER_NAME} 2>&1 || true
                                exit 1
                            fi

                            echo "Container started successfully: ${CONTAINER_NAME}"

                            echo "Waiting for container to initialize..."
                            sleep 5

                            if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
                                echo "ERROR: Container started but immediately crashed"
                                echo "Container logs:"
                                docker logs ${CONTAINER_NAME} 2>&1
                                exit 1
                            fi
                        """
                    }
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    sh """
                        echo "Running health checks..."
                        sleep 10

                        # Check container is still running
                        if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
                            echo "ERROR: Container is not running"
                            docker logs ${CONTAINER_NAME} 2>&1 || true
                            exit 1
                        fi

                        # Check bot logged in successfully by looking for ready message in logs
                        max_attempts=12
                        attempt=0

                        while [ \$attempt -lt \$max_attempts ]; do
                            if docker logs ${CONTAINER_NAME} 2>&1 | grep -q "RDP Soundboard is ready"; then
                                echo "Bot is online and ready!"
                                docker ps | grep ${CONTAINER_NAME}
                                exit 0
                            fi
                            attempt=\$((attempt + 1))
                            echo "Attempt \$attempt/\$max_attempts: Bot not ready yet..."
                            sleep 5
                        done

                        echo "Health check failed — bot did not become ready"
                        echo "Container logs:"
                        docker logs ${CONTAINER_NAME} 2>&1
                        exit 1
                    """
                }
            }
        }

        stage('Cleanup') {
            steps {
                script {
                    sh """
                        echo "Pruning old images..."

                        docker images ${IMAGE_NAME} --format "{{.ID}} {{.Tag}}" | \
                            grep -v -E "^.* (${IMAGE_TAG}|latest)\$" | \
                            awk '{print \$1}' | xargs -r docker rmi -f 2>/dev/null || true

                        echo "Cleanup completed"
                    """
                }
            }
        }
    }

    post {
        success {
            script {
                echo """
                ====================================
                Deployment Successful!
                ====================================
                Image: ${IMAGE_NAME}:${IMAGE_TAG}
                Container: ${CONTAINER_NAME}
                Build: #${env.BUILD_NUMBER}
                Commit: ${env.GIT_COMMIT}
                ====================================
                """
            }
        }

        failure {
            script {
                echo """
                ====================================
                Deployment Failed
                ====================================
                Build: #${env.BUILD_NUMBER}
                ====================================
                """

                sh """
                    if docker ps -a | grep -q ${CONTAINER_NAME}; then
                        echo "Container logs:"
                        docker logs ${CONTAINER_NAME} 2>&1 || echo "Could not retrieve container logs"
                    else
                        echo "Container was not created"
                    fi
                """
            }
        }
    }
}
