targetScope = 'resourceGroup'

param location string = resourceGroup().location
param containerAppEnvironmentName string = 'alive-env'
param containerRegistryName string = 'alive'
@minLength(1)
param image string
@description('Server trace probability; release validates 0 through 0.1. Zero disables trace export.')
param sentryTracesSampleRate string = '0.01'

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: containerAppEnvironmentName
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: containerRegistryName
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: 'hhc-web-identity'
}

resource app 'Microsoft.App/containerApps@2025-01-01' = {
  name: 'hhc-web'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      dapr: {
        enabled: true
        appId: 'hhc-web'
        appPort: 10000
        appProtocol: 'http'
        logLevel: 'warn'
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'hhc-web'
          image: image
          env: [
            {
              name: 'SENTRY_TRACES_SAMPLE_RATE'
              value: sentryTracesSampleRate
            }
            {
              name: 'HHC_WEB_API_BASE_URL'
              value: 'http://127.0.0.1:3500/v1.0/invoke/hhc-web-api/method/api'
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/health', port: 10000 }
              initialDelaySeconds: 1
              periodSeconds: 2
              timeoutSeconds: 3
              failureThreshold: 30
            }
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 10000 }
              initialDelaySeconds: 20
              periodSeconds: 30
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              // Dapr must accept incoming invocation before the revision becomes ready.
              httpGet: { path: '/v1.0/healthz', port: 3501 }
              initialDelaySeconds: 20
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 8
        rules: [
          {
            name: 'cpu-scaler'
            custom: {
              type: 'cpu'
              metadata: {
                type: 'Utilization'
                value: '50'
              }
            }
          }
          {
            name: 'http-scaler'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
        cooldownPeriod: 300
        pollingInterval: 30
      }
    }
  }
}

output appName string = app.name
