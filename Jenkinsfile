@Library('jenkins-helpers@v0.1.19') _

def label = "cognite-grafana-datasource-${UUID.randomUUID().toString().substring(0, 5)}"
def imageName = "cognite/grafana-cdp"
def devImageName = "cognite/grafana-cdp-dev"

podTemplate(
  label: label,
  containers: [
    containerTemplate(
      name: 'node',
      image: 'node:10',
      resourceLimitCpu: '2000m',
      resourceLimitMemory: '1000Mi',
      ttyEnabled: true
    ),
    containerTemplate(
      name: 'docker',
      command: '/bin/cat -',
      image: 'docker:18.06.1-ce',
      resourceLimitCpu: '1000m',
      resourceLimitMemory: '1000Mi',
      ttyEnabled: true
    ),
  ],
  volumes: [
    secretVolume(secretName: 'npm-credentials',
                 mountPath: '/npm-credentials',
                 readOnly: true),
    secretVolume(secretName: 'cognitecicd-dockerhub', mountPath: '/dockerhub-credentials'),
    hostPathVolume(hostPath: '/var/run/docker.sock', mountPath: '/var/run/docker.sock'),
  ],
  envVars: [
    envVar(key: 'CHANGE_ID', value: env.CHANGE_ID),
  ],
  ) {
    node(label) {
      def shortSha
      container('node') {
        stage('Checkout') {
          checkout(scm)
          shortSha = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
        }

        stage('Prepare') {
          sh('cp /npm-credentials/npm-public-credentials.txt ~/.npmrc')
          sh('yarn')
        }

        stage('Build') {
          // Prepares artifacts (/dist) for the docker builds
          sh('yarn build')
        }

        stage('Test') {
          sh('yarn test')
        }
      }

      container('docker') {
        stage('Build docker image') {
          sh("docker build -t ${imageName}:${shortSha} .")
        }

        stage('Login to docker hub') {
          sh('cat /dockerhub-credentials/DOCKER_PASSWORD | docker login -u "$(cat /dockerhub-credentials/DOCKER_USERNAME)" --password-stdin')
        }

        if (env.CHANGE_ID) {
          stage("Publish PR image") {
            def prImage = "${devImageName}:pr-${env.CHANGE_ID}"
            sh("docker tag ${imageName}:${shortSha} ${prImage}")
            sh("docker push ${prImage}")
            pullRequest.comment("[pr-bot]\nRun this build with `docker run --rm -p 3000:3000 ${prImage}`")
          }

        } else if (env.BRANCH_NAME == 'master') {
          stage('Push to GCR') {
            sh("docker tag ${imageName}:${shortSha} ${imageName}")
            sh("docker push ${imageName}:${shortSha}")
            sh("docker push ${imageName}")
          }
        }
      }
    }
  }
