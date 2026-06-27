using './main.bicep'

param managedEnvironmentName = 'aca-env-dev'
param containerAppName = 'tile-fighter-server-dev'
param imageName = 'ghcr.io/example/tile-fighter-server:dev'
param containerPort = 3000
param revisionMode = 'Multiple'
param databaseUrlSecret = 'postgres://replace-dev'
param entraIssuerSecret = 'https://replace-dev-issuer'
param entraAudienceSecret = 'api://replace-dev-audience'
param entraJwksUrlSecret = 'https://replace-dev-jwks'
param entraTenantIdSecret = '00000000-0000-0000-0000-000000000000'
