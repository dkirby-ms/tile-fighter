metadata name = 'tile-fighter-container-app'
metadata description = 'Deploys Tile Fighter server into Azure Container Apps with health probes and secret references.'

targetScope = 'resourceGroup'

@description('Azure region for resources.')
param location string = resourceGroup().location

@description('Container Apps managed environment name.')
param managedEnvironmentName string

@description('Container app name.')
param containerAppName string

@description('Container image URI including tag.')
param imageName string

@description('Runtime port exposed by the server.')
param containerPort int = 3000

@description('Container app revision mode.')
@allowed([
  'Single'
  'Multiple'
])
param revisionMode string = 'Multiple'

@description('Tenant mode for runtime auth behavior.')
@allowed([
  'single'
  'multi'
  'both'
])
param tenantMode string = 'single'

@description('Database URL secret value.')
@secure()
param databaseUrlSecret string

@description('Entra issuer secret value.')
@secure()
param entraIssuerSecret string

@description('Entra audience secret value.')
@secure()
param entraAudienceSecret string

@description('Entra JWKS URL secret value.')
@secure()
param entraJwksUrlSecret string

@description('Entra tenant ID secret value.')
@secure()
param entraTenantIdSecret string

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: managedEnvironmentName
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  properties: {
    managedEnvironmentId: managedEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: revisionMode
      ingress: {
        external: true
        targetPort: containerPort
        transport: 'auto'
      }
      secrets: [
        {
          name: 'database-url'
          value: databaseUrlSecret
        }
        {
          name: 'entra-issuer'
          value: entraIssuerSecret
        }
        {
          name: 'entra-audience'
          value: entraAudienceSecret
        }
        {
          name: 'entra-jwks-url'
          value: entraJwksUrlSecret
        }
        {
          name: 'entra-tenant-id'
          value: entraTenantIdSecret
        }
      ]
    }
    template: {
      scale: {
        minReplicas: 1
        maxReplicas: 5
      }
      containers: [
        {
          name: 'server'
          image: imageName
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: string(containerPort)
            }
            {
              name: 'TENANT_MODE'
              value: tenantMode
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'ENTRA_ISSUER'
              secretRef: 'entra-issuer'
            }
            {
              name: 'ENTRA_AUDIENCE'
              secretRef: 'entra-audience'
            }
            {
              name: 'ENTRA_JWKS_URL'
              secretRef: 'entra-jwks-url'
            }
            {
              name: 'ENTRA_TENANT_ID'
              secretRef: 'entra-tenant-id'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: containerPort
              }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/readyz'
                port: containerPort
              }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
            {
              type: 'Startup'
              httpGet: {
                path: '/healthz'
                port: containerPort
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
    }
  }
}

@description('Container app default ingress URL.')
output ingressUrl string = containerApp.properties.configuration.ingress.fqdn
