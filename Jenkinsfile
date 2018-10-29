def label = "cognite-grafana-datasource-${UUID.randomUUID().toString().substring(0, 5)}"
def imageName = "cognite/grafana-cdp"
def devImageName = "cognite/grafana-cdp-dev"

podTemplate(
  label: label,
  containers: [containerTemplate(name: 'node',
    image: 'node:9',
    ttyEnabled: true)
  ],
  volumes: [
    secretVolume(secretName: 'npm-credentials',
                 mountPath: '/npm-credentials',
                 readOnly: true),
    secretVolume(secretName: 'jenkins-docker-builder', mountPath: '/jenkins-docker-builder'),
  ],
  envVars: [
    envVar(key: 'CHANGE_ID', value: env.CHANGE_ID),
  ],
  ) {
    node(label) {
      container('node') {
        stage('Checkout') {
          checkout(scm)
        }

        stage('Prepare') {
          sh('cp /npm-credentials/npm-public-credentials.txt ~/.npmrc')
          sh('yarn')
          sh('yarn build');
        }
      }
      container('docker') {
        def shortSha
        stage('Build docker image') {
          shortSha = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
          sh("docker build -t ${imageName}:${shortSha} .")
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
