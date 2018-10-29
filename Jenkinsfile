def label = "cognite-grafana-datasource-${UUID.randomUUID().toString().substring(0, 5)}"
def imageName = "cognite/grafana-cdp"
def devImageName = "cognite/grafana-cdp-dev"

podTemplate(
  label: label,
  containers: [
    containerTemplate(
      name: 'node',
      image: 'node:9',
      ttyEnabled: true
    ),
    containerTemplate(
      name: 'docker',
      command: '/bin/cat -',
      image: 'docker:17.06.2-ce',
      resourceRequestCpu: '100m',
      resourceRequestMemory: '500Mi',
      resourceLimitCpu: '300m',
      resourceLimitMemory: '500Mi',
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
          shortSha = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
        }

        stage('Prepare') {
          sh('cp /npm-credentials/npm-public-credentials.txt ~/.npmrc')
          sh('yarn')
          sh('yarn build');
        }
      }
      container('docker') {
        stage('Build docker image') {
          sh("docker build -t ${imageName}:${shortSha} .")
        }

        stage('Login to docker hub') {
          sh('docker login -u "$(cat /dockerhub-credentials/DOCKER_USERNAME)" -p "$(cat /dockerhub-credentials/DOCKER_PASSWORD"')
        }

        if (env.CHANGE_ID) {
          stage("Publish PR image") {
            def prImage = "${devImageName}:pr-${env.CHANGE_ID}"
            sh("docker tag ${imageName}:${shortSha} ${prImage}")
            sh("docker push ${prImage}")
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
