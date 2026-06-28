using './main.bicep'

param managedEnvironmentName = 'aca-env-prod'
param containerAppName = 'tile-fighter-server-prod'
param imageName = 'ghcr.io/example/tile-fighter-server:prod'
param containerPort = 3000
param revisionMode = 'Multiple'
param tenantMode = 'single'
