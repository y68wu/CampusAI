@description('Globally unique, lowercase Azure Container Registry name (5-50 alphanumeric characters).')
@minLength(5)
@maxLength(50)
param registryName string

@description('Globally unique Container App name.')
param appName string

@description('Azure region for the resources.')
param location string = resourceGroup().location

@description('Container image used for initial provisioning. GitHub Actions replaces this with a commit-tagged image.')
param initialImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Optional Waterloo Open Data API v3 key. Keep this value in a secure parameter file or deploy from a secret store.')
@secure()
param waterlooApiKey string = ''

@description('Optional OpenAI key for the LangChain agent. The deterministic MCP demo works without it.')
@secure()
param openAiApiKey string = ''

var environmentName = '${appName}-env'
var workspaceName = '${appName}-logs'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: registry.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: concat(
        empty(waterlooApiKey) ? [] : [{ name: 'waterloo-api-key', value: waterlooApiKey }],
        empty(openAiApiKey) ? [] : [{ name: 'openai-api-key', value: openAiApiKey }]
      )
      ingress: {
        external: true
        targetPort: 4000
        transport: 'auto'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'campus-ai'
          image: initialImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat(
            [
              { name: 'PORT', value: '4000' }
              { name: 'NODE_ENV', value: 'production' }
            ],
            empty(waterlooApiKey) ? [] : [{ name: 'WATERLOO_API_KEY', secretRef: 'waterloo-api-key' }],
            empty(openAiApiKey) ? [] : [{ name: 'OPENAI_API_KEY', secretRef: 'openai-api-key' }]
          )
          probes: [
            {
              type: 'Readiness'
              httpGet: { path: '/api/health', port: 4000, scheme: 'HTTP' }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
            {
              type: 'Liveness'
              httpGet: { path: '/api/health', port: 4000, scheme: 'HTTP' }
              initialDelaySeconds: 20
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
      }
    }
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, app.id, acrPullRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output registryLoginServer string = registry.properties.loginServer
output containerAppName string = app.name
output resourceGroupName string = resourceGroup().name
