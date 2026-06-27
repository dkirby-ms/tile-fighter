using './main.bicep'

param managedEnvironmentName = 'aca-env-prod'
param containerAppName = 'tile-fighter-server-prod'
param imageName = 'ghcr.io/example/tile-fighter-server:prod'
param containerPort = 3000
param revisionMode = 'Multiple'
param databaseUrlSecret = 'postgres://replace-prod'
param entraIssuerSecret = 'https://replace-prod-issuer'
param entraAudienceSecret = 'api://replace-prod-audience'
param entraJwksUrlSecret = 'https://replace-prod-jwks'
param entraTenantIdSecret = '00000000-0000-0000-0000-000000000000'
